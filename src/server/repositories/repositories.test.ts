import { afterEach, describe, expect, it, vi } from "vitest";
import { writeAuditLog } from "./auditLogsRepository";
import { insertBookingIfNoConflict, listBlockingBookings } from "./bookingsRepository";
import { createRoom } from "./roomsRepository";
import type { Booking, Room } from "../../shared/types";

interface QueryCall {
  sql: string;
  binds: unknown[];
  method: "all" | "run";
}

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

  async all<T>(): Promise<{ results: T[] }> {
    this.db.calls.push({ sql: this.sql, binds: this.binds, method: "all" });
    return { results: this.db.rows as T[] };
  }

  async run(): Promise<{ meta: { changes: number } }> {
    this.db.calls.push({ sql: this.sql, binds: this.binds, method: "run" });
    return { meta: { changes: this.db.changes } };
  }
}

class FakeD1Database {
  readonly calls: QueryCall[] = [];

  constructor(
    readonly rows: unknown[] = [],
    readonly changes = 1,
  ) {}

  prepare(sql: string): FakePreparedStatement {
    return new FakePreparedStatement(this, sql);
  }

  asD1(): D1Database {
    return this as unknown as D1Database;
  }
}

const bookingRow = {
  id: "booking-1",
  room_id: "room-1",
  title: "Planning",
  contact_name: "Alice",
  phone: "13800000000",
  email: "alice@example.com",
  start_time: "2026-04-29T01:00:00.000Z",
  end_time: "2026-04-29T02:00:00.000Z",
  status: "confirmed",
  source: "public",
  created_at: "2026-04-28T01:00:00.000Z",
  updated_at: "2026-04-28T01:30:00.000Z",
  cancelled_at: null,
  cancelled_by: null,
  reviewed_by_admin_id: "admin-1",
  reviewed_at: "2026-04-28T01:20:00.000Z",
};

afterEach(() => {
  vi.useRealTimers();
});

describe("bookingsRepository", () => {
  it("binds overlap window and maps blocking booking rows", async () => {
    const db = new FakeD1Database([bookingRow]);

    const bookings = await listBlockingBookings(
      db.asD1(),
      "room-1",
      "2026-04-29T01:30:00.000Z",
      "2026-04-29T02:30:00.000Z",
    );

    expect(db.calls).toHaveLength(1);
    expect(db.calls[0].binds).toEqual([
      "room-1",
      "2026-04-29T02:30:00.000Z",
      "2026-04-29T01:30:00.000Z",
    ]);
    expect(bookings).toEqual([
      {
        id: "booking-1",
        roomId: "room-1",
        title: "Planning",
        contactName: "Alice",
        email: "alice@example.com",
        startTime: "2026-04-29T01:00:00.000Z",
        endTime: "2026-04-29T02:00:00.000Z",
        status: "confirmed",
        source: "public",
        createdAt: "2026-04-28T01:00:00.000Z",
        updatedAt: "2026-04-28T01:30:00.000Z",
        cancelledAt: null,
        cancelledBy: null,
        reviewedByAdminId: "admin-1",
        reviewedAt: "2026-04-28T01:20:00.000Z",
      },
    ]);
  });

  it("atomically inserts bookings only when no active overlap exists", async () => {
    const db = new FakeD1Database([], 1);
    const booking: Booking = {
      id: "booking-2",
      roomId: "room-1",
      title: "Planning",
      contactName: "Bob",
      email: null,
      startTime: "2026-04-29T03:00:00.000Z",
      endTime: "2026-04-29T04:00:00.000Z",
      status: "confirmed",
      source: "public",
      createdAt: "2026-04-28T02:00:00.000Z",
      updatedAt: "2026-04-28T02:00:00.000Z",
      cancelledAt: null,
      cancelledBy: null,
      reviewedByAdminId: null,
      reviewedAt: null,
    };

    const didInsert = await insertBookingIfNoConflict(db.asD1(), booking);

    expect(didInsert).toBe(true);
    expect(db.calls).toHaveLength(1);
    const normalizedSql = db.calls[0].sql.replace(/\s+/g, " ");
    expect(normalizedSql).toContain("INSERT INTO bookings");
    expect(normalizedSql).toContain("SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?");
    expect(normalizedSql).toContain("WHERE NOT EXISTS");
    expect(normalizedSql).toContain("room_id = ?");
    expect(normalizedSql).toContain("status IN ('confirmed', 'pending_approval')");
    expect(normalizedSql).toContain("start_time < ?");
    expect(normalizedSql).toContain("end_time > ?");
    expect(db.calls[0].binds).toEqual([
      "booking-2",
      "room-1",
      "Planning",
      "Bob",
      "",
      null,
      "2026-04-29T03:00:00.000Z",
      "2026-04-29T04:00:00.000Z",
      "confirmed",
      "public",
      "2026-04-28T02:00:00.000Z",
      "2026-04-28T02:00:00.000Z",
      null,
      null,
      null,
      null,
      "room-1",
      "2026-04-29T04:00:00.000Z",
      "2026-04-29T03:00:00.000Z",
    ]);
  });
});

describe("roomsRepository", () => {
  it("converts booleans to database values and returns created timestamps", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-28T09:00:00.000Z"));
    const db = new FakeD1Database();
    const room: Omit<Room, "createdAt" | "updatedAt"> = {
      id: "room-1",
      name: "Board Room",
      location: "2F",
      capacity: 8,
      equipmentNotes: "Projector",
      isEnabled: false,
      openingHours: '{"days":[1,2,3,4,5],"start":"09:00","end":"18:00"}',
      bufferMinutes: 5,
      minDurationMinutes: 30,
      maxDurationMinutes: 240,
      maxAdvanceDays: 30,
      requiresApproval: true,
    };

    const created = await createRoom(db.asD1(), room);

    expect(db.calls).toHaveLength(1);
    expect(db.calls[0].binds).toEqual([
      "room-1",
      "Board Room",
      "2F",
      8,
      "Projector",
      0,
      '{"days":[1,2,3,4,5],"start":"09:00","end":"18:00"}',
      5,
      30,
      240,
      30,
      1,
      "2026-04-28T09:00:00.000Z",
      "2026-04-28T09:00:00.000Z",
    ]);
    expect(created).toEqual({
      ...room,
      createdAt: "2026-04-28T09:00:00.000Z",
      updatedAt: "2026-04-28T09:00:00.000Z",
    });
  });
});

describe("auditLogsRepository", () => {
  it("stringifies metadata and binds audit log values", async () => {
    const db = new FakeD1Database();

    await writeAuditLog(db.asD1(), {
      id: "audit-1",
      actorType: "admin",
      actorId: "admin-1",
      action: "booking.created",
      targetType: "booking",
      targetId: "booking-1",
      metadata: { roomId: "room-1", approved: true },
      createdAt: "2026-04-28T10:00:00.000Z",
    });

    expect(db.calls).toHaveLength(1);
    expect(db.calls[0].binds).toEqual([
      "audit-1",
      "admin",
      "admin-1",
      "booking.created",
      "booking",
      "booking-1",
      JSON.stringify({ roomId: "room-1", approved: true }),
      "2026-04-28T10:00:00.000Z",
    ]);
  });
});
