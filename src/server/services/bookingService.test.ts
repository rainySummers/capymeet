import { describe, expect, it } from "vitest";
import { createBooking, createBookingDecision } from "./bookingService";
import type { Booking, Room } from "../../shared/types";

const room: Room = {
  id: "room-1",
  name: "Board Room",
  location: "2F",
  capacity: 8,
  equipmentNotes: null,
  isEnabled: true,
  openingHours: '{"days":[1,2,3,4,5],"start":"09:00","end":"18:00"}',
  bufferMinutes: 5,
  minDurationMinutes: 30,
  maxDurationMinutes: 240,
  maxAdvanceDays: 30,
  requiresApproval: false,
  createdAt: "2026-04-28T00:00:00.000Z",
  updatedAt: "2026-04-28T00:00:00.000Z",
};

const existing: Booking = {
  id: "booking-1",
  roomId: "room-1",
  title: "Existing",
  contactName: "Alice",
  email: null,
  startTime: "2026-04-28T08:00:00.000Z",
  endTime: "2026-04-28T09:00:00.000Z",
  status: "confirmed",
  source: "public",
  createdAt: "2026-04-28T00:00:00.000Z",
  updatedAt: "2026-04-28T00:00:00.000Z",
  cancelledAt: null,
  cancelledBy: null,
  reviewedByAdminId: null,
  reviewedAt: null,
};

const roomRow = {
  id: "room-1",
  name: "Board Room",
  location: "2F",
  capacity: 8,
  equipment_notes: null,
  is_enabled: 1,
  opening_hours: '{"days":[1,2,3,4,5],"start":"09:00","end":"18:00"}',
  buffer_minutes: 5,
  min_duration_minutes: 30,
  max_duration_minutes: 240,
  max_advance_days: 30,
  requires_approval: 0,
  created_at: "2026-04-28T00:00:00.000Z",
  updated_at: "2026-04-28T00:00:00.000Z",
};

class FakePreparedStatement {
  private binds: unknown[] = [];

  constructor(
    private readonly db: FakeD1Database,
    private readonly sql: string,
  ) {}

  bind(...values: unknown[]): this {
    this.binds = values;
    return this;
  }

  async first<T>(): Promise<T | null> {
    return this.sql.includes("FROM rooms") ? (roomRow as T) : null;
  }

  async all<T>(): Promise<{ results: T[] }> {
    return { results: [] };
  }

  async run(): Promise<{ meta: { changes: number } }> {
    this.db.sql.push(this.sql);
    return { meta: { changes: this.db.insertChanges } };
  }
}

class FakeD1Database {
  readonly sql: string[] = [];

  constructor(readonly insertChanges: number) {}

  prepare(sql: string): FakePreparedStatement {
    return new FakePreparedStatement(this, sql);
  }

  asD1(): D1Database {
    return this as unknown as D1Database;
  }
}

describe("createBookingDecision", () => {
  it("rejects invalid timestamps", () => {
    const result = createBookingDecision({
      room,
      existingBookings: [],
      now: "2026-04-28T00:00:00.000Z",
      request: {
        title: "New",
        contactName: "Bob",
        email: null,
        startTime: "not-a-date",
        endTime: "2026-04-28T03:30:00.000Z",
        source: "public",
      },
    });

    if (result.ok) {
      throw new Error("Expected invalid time range");
    }
    expect(result.error).toBe("invalid_time_range");
  });

  it("rejects overlapping confirmed bookings", () => {
    const result = createBookingDecision({
      room,
      existingBookings: [existing],
      now: "2026-04-28T00:00:00.000Z",
      request: {
        title: "New",
        contactName: "Bob",
        email: null,
        startTime: "2026-04-28T08:30:00.000Z",
        endTime: "2026-04-28T09:30:00.000Z",
        source: "public",
      },
    });

    if (result.ok) {
      throw new Error("Expected booking conflict");
    }
    expect(result.error).toBe("booking_conflict");
  });

  it("rejects bookings that do not leave the room buffer after an existing booking", () => {
    const result = createBookingDecision({
      room,
      existingBookings: [existing],
      now: "2026-04-28T00:00:00.000Z",
      request: {
        title: "New",
        contactName: "Bob",
        email: null,
        startTime: "2026-04-28T09:04:00.000Z",
        endTime: "2026-04-28T10:00:00.000Z",
        source: "admin",
      },
    });

    if (result.ok) {
      throw new Error("Expected booking conflict");
    }
    expect(result.error).toBe("booking_conflict");
  });

  it("accepts bookings that start after the room buffer has elapsed", () => {
    const result = createBookingDecision({
      room,
      existingBookings: [existing],
      now: "2026-04-28T00:00:00.000Z",
      request: {
        title: "New",
        contactName: "Bob",
        email: null,
        startTime: "2026-04-28T09:05:00.000Z",
        endTime: "2026-04-28T10:00:00.000Z",
        source: "admin",
      },
    });

    if (!result.ok) {
      throw new Error(`Expected successful booking decision, got ${result.error}`);
    }
    expect(result.status).toBe("confirmed");
  });

  it("rejects overlapping pending approval bookings", () => {
    const result = createBookingDecision({
      room,
      existingBookings: [{ ...existing, status: "pending_approval" }],
      now: "2026-04-28T00:00:00.000Z",
      request: {
        title: "New",
        contactName: "Bob",
        email: null,
        startTime: "2026-04-28T08:30:00.000Z",
        endTime: "2026-04-28T09:30:00.000Z",
        source: "public",
      },
    });

    if (result.ok) {
      throw new Error("Expected booking conflict");
    }
    expect(result.error).toBe("booking_conflict");
  });

  it("ignores overlapping inactive bookings", () => {
    const inactiveBookings: Booking[] = [
      { ...existing, id: "booking-cancelled", status: "cancelled" },
      { ...existing, id: "booking-rejected", status: "rejected" },
      { ...existing, id: "booking-completed", status: "completed" },
    ];

    const result = createBookingDecision({
      room,
      existingBookings: inactiveBookings,
      now: "2026-04-28T00:00:00.000Z",
      request: {
        title: "New",
        contactName: "Bob",
        email: null,
        startTime: "2026-04-28T08:30:00.000Z",
        endTime: "2026-04-28T09:30:00.000Z",
        source: "public",
      },
    });

    if (!result.ok) {
      throw new Error(`Expected successful booking decision, got ${result.error}`);
    }
    expect(result.status).toBe("confirmed");
  });

  it("creates pending approval when the room requires approval", () => {
    const result = createBookingDecision({
      room: { ...room, requiresApproval: true },
      existingBookings: [],
      now: "2026-04-28T00:00:00.000Z",
      request: {
        title: "New",
        contactName: "Bob",
        email: "bob@example.com",
        startTime: "2026-04-28T08:00:00.000Z",
        endTime: "2026-04-28T09:00:00.000Z",
        source: "public",
      },
    });

    if (!result.ok) {
      throw new Error(`Expected successful booking decision, got ${result.error}`);
    }
    expect(result.status).toBe("pending_approval");
  });

  it("rejects bookings outside room opening rules", () => {
    const result = createBookingDecision({
      room,
      existingBookings: [],
      now: "2026-04-28T00:00:00.000Z",
      request: {
        title: "New",
        contactName: "Bob",
        email: null,
        startTime: "2026-04-28T00:00:00.000Z",
        endTime: "2026-04-28T01:30:00.000Z",
        source: "public",
      },
    });

    if (result.ok) {
      throw new Error("Expected room schedule rejection");
    }
    expect(result.error).toBe("outside_opening_hours");
  });

  it("accepts bookings inside Berlin summer opening hours", () => {
    const result = createBookingDecision({
      room,
      existingBookings: [],
      now: "2026-07-15T00:00:00.000Z",
      request: {
        title: "Summer afternoon",
        contactName: "Bob",
        email: null,
        startTime: "2026-07-15T15:00:00.000Z",
        endTime: "2026-07-15T16:00:00.000Z",
        source: "public",
      },
    });

    if (!result.ok) {
      throw new Error(`Expected successful booking decision, got ${result.error}`);
    }
    expect(result.status).toBe("confirmed");
  });

  it("rejects bookings before Berlin summer opening hours", () => {
    const result = createBookingDecision({
      room,
      existingBookings: [],
      now: "2026-07-15T00:00:00.000Z",
      request: {
        title: "Too early",
        contactName: "Bob",
        email: null,
        startTime: "2026-07-15T06:00:00.000Z",
        endTime: "2026-07-15T07:00:00.000Z",
        source: "public",
      },
    });

    if (result.ok) {
      throw new Error("Expected room schedule rejection");
    }
    expect(result.error).toBe("outside_opening_hours");
  });

  it("accepts admin bookings inside opening hours even when they are off slot boundaries", () => {
    const result = createBookingDecision({
      room,
      existingBookings: [],
      now: "2026-04-28T00:00:00.000Z",
      request: {
        title: "今天会议",
        contactName: "zhangshan",
        email: null,
        startTime: "2026-04-29T08:15:00.000Z",
        endTime: "2026-04-29T09:00:00.000Z",
        source: "admin",
      },
    });

    if (!result.ok) {
      throw new Error(`Expected successful booking decision, got ${result.error}`);
    }
    expect(result.status).toBe("confirmed");
  });

  it("rejects bookings on days that are not configured as open", () => {
    const result = createBookingDecision({
      room,
      existingBookings: [],
      now: "2026-05-15T00:00:00.000Z",
      request: {
        title: "Saturday booking",
        contactName: "Bob",
        email: null,
        startTime: "2026-05-16T08:00:00.000Z",
        endTime: "2026-05-16T09:00:00.000Z",
        source: "public",
      },
    });

    if (result.ok) {
      throw new Error("Expected room schedule rejection");
    }
    expect(result.error).toBe("outside_opening_hours");
  });

  it("accepts bookings on configured weekend opening days", () => {
    const result = createBookingDecision({
      room: { ...room, openingHours: '{"days":[1,2,3,4,5,6],"start":"09:00","end":"18:00"}' },
      existingBookings: [],
      now: "2026-05-15T00:00:00.000Z",
      request: {
        title: "Saturday booking",
        contactName: "Bob",
        email: null,
        startTime: "2026-05-16T08:00:00.000Z",
        endTime: "2026-05-16T09:00:00.000Z",
        source: "public",
      },
    });

    if (!result.ok) {
      throw new Error(`Expected successful booking decision, got ${result.error}`);
    }
    expect(result.status).toBe("confirmed");
  });

  it("accepts bookings inside the room opening date range", () => {
    const result = createBookingDecision({
      room: { ...room, openingHours: '{"startDate":"2026-05-01","endDate":"2026-05-31"}' },
      existingBookings: [],
      now: "2026-05-10T00:00:00.000Z",
      request: {
        title: "Date range booking",
        contactName: "Bob",
        email: null,
        startTime: "2026-05-16T08:00:00.000Z",
        endTime: "2026-05-16T09:00:00.000Z",
        source: "public",
      },
    });

    if (!result.ok) {
      throw new Error(`Expected successful booking decision, got ${result.error}`);
    }
    expect(result.status).toBe("confirmed");
  });

  it("rejects bookings outside the room opening date range", () => {
    const result = createBookingDecision({
      room: { ...room, openingHours: '{"startDate":"2026-05-01","endDate":"2026-05-31"}' },
      existingBookings: [],
      now: "2026-05-10T00:00:00.000Z",
      request: {
        title: "Out of range booking",
        contactName: "Bob",
        email: null,
        startTime: "2026-06-01T02:00:00.000Z",
        endTime: "2026-06-01T03:00:00.000Z",
        source: "public",
      },
    });

    if (result.ok) {
      throw new Error("Expected room schedule rejection");
    }
    expect(result.error).toBe("outside_opening_hours");
  });

  it("rejects bookings outside the room opening time range in date-range rules", () => {
    const result = createBookingDecision({
      room: { ...room, openingHours: '{"startDate":"2026-05-01","endDate":"2026-05-31","start":"08:30","end":"18:00"}' },
      existingBookings: [],
      now: "2026-05-10T00:00:00.000Z",
      request: {
        title: "Late booking",
        contactName: "Bob",
        email: null,
        startTime: "2026-05-16T17:00:00.000Z",
        endTime: "2026-05-16T18:00:00.000Z",
        source: "public",
      },
    });

    if (result.ok) {
      throw new Error("Expected room schedule rejection");
    }
    expect(result.error).toBe("outside_opening_hours");
  });

  it("rejects bookings beyond the advance window", () => {
    const result = createBookingDecision({
      room: { ...room, maxAdvanceDays: 1 },
      existingBookings: [],
      now: "2026-04-28T00:00:00.000Z",
      request: {
        title: "New",
        contactName: "Bob",
        email: null,
        startTime: "2026-04-30T04:00:00.000Z",
        endTime: "2026-04-30T05:00:00.000Z",
        source: "public",
      },
    });

    if (result.ok) {
      throw new Error("Expected advance window rejection");
    }
    expect(result.error).toBe("booking_too_far_in_advance");
  });
});

describe("createBooking", () => {
  it("returns booking conflict when the atomic insert inserts no rows", async () => {
    const db = new FakeD1Database(0);

    const result = await createBooking(db.asD1(), {
      roomId: "room-1",
      title: "Concurrent",
      contactName: "Bob",
      email: null,
      startTime: "2026-04-28T08:00:00.000Z",
      endTime: "2026-04-28T09:00:00.000Z",
      source: "public",
    });

    expect(result).toEqual({ ok: false, error: "booking_conflict" });
    expect(db.sql.some((sql) => sql.includes("WHERE NOT EXISTS"))).toBe(true);
  });
});
