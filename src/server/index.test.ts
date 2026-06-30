// @vitest-environment node

import bcrypt from "bcryptjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import app from "./index";
import { createAdminToken } from "./services/authService";
import type { BookingStatus } from "../shared/types";

const TEST_JWT_SECRET = "test-secret-test-secret-test-secret-1234";

type BookingRow = {
  id: string;
  room_id: string;
  title: string;
  contact_name: string;
  phone: string;
  email: string | null;
  start_time: string;
  end_time: string;
  status: BookingStatus;
  source: "public" | "tablet" | "admin";
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
  cancelled_by: string | null;
  reviewed_by_admin_id: string | null;
  reviewed_at: string | null;
};

type RoomRow = {
  id: string;
  name: string;
  location: string;
  capacity: number | null;
  equipment_notes: string | null;
  is_enabled: number;
  opening_hours: string;
  min_duration_minutes: number;
  max_duration_minutes: number;
  max_advance_days: number;
  requires_approval: number;
  created_at: string;
  updated_at: string;
};

type AdminRow = {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  is_enabled: number;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
};

type DeviceRow = {
  id: string;
  device_code: string;
  name: string;
  default_room_id: string | null;
  is_enabled: number;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
};

type BookingLinkRow = {
  id: string;
  type: "global" | "room_specific";
  token: string;
  room_id: string | null;
  is_enabled: number;
  created_by_admin_id: string;
  created_at: string;
  updated_at: string;
};

type EmailSettingsRow = {
  id: "default";
  sender_email: string;
  email_subject: string;
  reply_instructions: string;
  is_email_enabled: number;
  updated_at: string;
  updated_by_admin_id: string | null;
};

type BusinessSettingsRow = {
  id: "default";
  business_time_zone: string;
  updated_at: string;
  updated_by_admin_id: string | null;
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

  async all<T>(): Promise<{ results: T[] }> {
    if (this.sql.includes("FROM bookings b")) {
      let results = this.db.bookings.map((booking) => {
        const joinedRoom = this.db.rooms.find((candidate) => candidate.id === booking.room_id);
        return {
          ...booking,
          room_name: joinedRoom?.name ?? null,
          room_location: joinedRoom?.location ?? null,
        };
      });
      if (this.sql.includes("b.status = ?")) {
        const [status] = this.binds as [BookingStatus];
        results = results.filter((booking) => booking.status === status);
      }
      return { results: results as T[] };
    }
    if (this.sql.includes("FROM admins") && !this.sql.includes("WHERE")) {
      return {
        results: [...this.db.admins]
          .sort((a, b) => a.email.localeCompare(b.email))
          .map((admin) => ({
            id: admin.id,
            email: admin.email,
            name: admin.name,
            is_enabled: admin.is_enabled,
            last_login_at: admin.last_login_at,
            created_at: admin.created_at,
            updated_at: admin.updated_at,
          })) as T[],
      };
    }
    if (this.sql.includes("FROM rooms") && this.sql.includes("WHERE is_enabled = 1")) {
      return { results: this.db.rooms.filter((room) => room.is_enabled === 1) as T[] };
    }
    if (this.sql.includes("FROM rooms")) {
      return { results: [...this.db.rooms].sort((a, b) => a.name.localeCompare(b.name)) as T[] };
    }
    if (this.sql.includes("FROM bookings") && this.sql.includes("phone = ?")) {
      const [phone, now] = this.binds as [string, string];
      return {
        results: this.db.bookings.filter(
          (booking) =>
            booking.phone === phone &&
            (booking.status === "confirmed" || booking.status === "pending_approval") &&
            booking.end_time > now,
        ) as T[],
      };
    }
    if (this.sql.includes("FROM bookings") && this.sql.includes("room_id = ?")) {
      const [roomId, endTime, startTime] = this.binds as [string, string, string];
      return {
        results: this.db.bookings.filter(
          (booking) =>
            booking.room_id === roomId &&
            (booking.status === "confirmed" || booking.status === "pending_approval") &&
            booking.start_time < endTime &&
            booking.end_time > startTime,
        ).sort((a, b) => a.start_time.localeCompare(b.start_time)) as T[],
      };
    }
    if (this.sql.includes("FROM booking_links")) {
      return {
        results: [...this.db.bookingLinks]
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .map((link) => {
            const joinedRoom = this.db.rooms.find((room) => room.id === link.room_id);
            return {
              id: link.id,
              type: link.type,
              token: link.token,
              room_id: link.room_id,
              room_name: joinedRoom?.name ?? null,
              is_enabled: link.is_enabled,
              created_at: link.created_at,
              updated_at: link.updated_at,
            };
          }) as T[],
      };
    }
    if (this.sql.includes("FROM email_settings")) {
      return { results: this.db.emailSettings ? ([this.db.emailSettings] as T[]) : [] };
    }
    if (this.sql.includes("FROM business_settings")) {
      return { results: this.db.businessSettings ? ([this.db.businessSettings] as T[]) : [] };
    }
    return { results: [] };
  }

  async first<T>(): Promise<T | null> {
    if (this.sql.includes("FROM business_settings")) {
      return (this.db.businessSettings as T | null) ?? null;
    }
    if (this.sql.includes("FROM email_settings")) {
      return (this.db.emailSettings as T | null) ?? null;
    }
    if (this.sql.includes("FROM bookings") && this.sql.includes("room_id = ?")) {
      const [roomId] = this.binds as [string];
      return (this.db.bookings.find((booking) => booking.room_id === roomId) ? ({ 1: 1 } as T) : null);
    }
    if (this.sql.includes("FROM bookings b") && this.sql.includes("b.id = ?")) {
      const [id] = this.binds as [string];
      const booking = this.db.bookings.find((candidate) => candidate.id === id);
      if (!booking) {
        return null;
      }
      const joinedRoom = this.db.rooms.find((candidate) => candidate.id === booking.room_id);
      return {
        ...booking,
        room_name: joinedRoom?.name ?? null,
        room_location: joinedRoom?.location ?? null,
      } as T;
    }
    if (this.sql.includes("FROM rooms")) {
      const [id] = this.binds as [string];
      return (this.db.rooms.find((room) => room.id === id) as T | undefined) ?? null;
    }
    if (this.sql.includes("FROM bookings") && this.sql.includes("WHERE id = ?")) {
      const [id] = this.binds as [string];
      return (this.db.bookings.find((candidate) => candidate.id === id) as T | undefined) ?? null;
    }
    if (this.sql.includes("FROM admins") && this.sql.includes("WHERE id = ?")) {
      const [id] = this.binds as [string];
      const admin = this.sql.includes("is_enabled = 1")
        ? this.db.admins.find((candidate) => candidate.id === id && candidate.is_enabled === 1)
        : this.db.admins.find((candidate) => candidate.id === id);
      return (admin as T | undefined) ?? null;
    }
    if (this.sql.includes("FROM admins")) {
      const [email] = this.binds as [string];
      return (this.db.admins.find((admin) => admin.email === email) as T | undefined) ?? null;
    }
    if (this.sql.includes("FROM devices") && this.sql.includes("device_code = ?")) {
      const [deviceCode] = this.binds as [string];
      return (this.db.devices.find((device) => device.device_code === deviceCode) as T | undefined) ?? null;
    }
    if (this.sql.includes("FROM devices") && this.sql.includes("default_room_id = ?")) {
      const [roomId] = this.binds as [string];
      return (this.db.devices.find((device) => device.default_room_id === roomId) ? ({ 1: 1 } as T) : null);
    }
    if (this.sql.includes("FROM booking_links") && this.sql.includes("room_id = ?")) {
      const [roomId] = this.binds as [string];
      return (this.db.bookingLinks.find((link) => link.room_id === roomId) ? ({ 1: 1 } as T) : null);
    }
    if (this.sql.includes("FROM booking_links") && this.sql.includes("WHERE bl.id = ?")) {
      const [id] = this.binds as [string];
      const link = this.db.bookingLinks.find((candidate) => candidate.id === id);
      if (!link) {
        return null;
      }
      const joinedRoom = this.db.rooms.find((room) => room.id === link.room_id);
      return {
        id: link.id,
        type: link.type,
        token: link.token,
        room_id: link.room_id,
        room_name: joinedRoom?.name ?? null,
        is_enabled: link.is_enabled,
        created_at: link.created_at,
        updated_at: link.updated_at,
      } as T;
    }
    if (this.sql.includes("FROM booking_links") && this.sql.includes("WHERE bl.token = ?")) {
      const [token] = this.binds as [string];
      const link = this.db.bookingLinks.find((candidate) => candidate.token === token && candidate.is_enabled === 1);
      if (!link) {
        return null;
      }
      const joinedRoom = this.db.rooms.find((candidate) => candidate.id === link.room_id);
      return {
        id: link.id,
        type: link.type,
        token: link.token,
        room_id: link.room_id,
        room_name: joinedRoom?.name ?? null,
        is_enabled: link.is_enabled,
        created_at: link.created_at,
        updated_at: link.updated_at,
      } as T;
    }
    return null;
  }

  async run(): Promise<{ meta: { changes: number } }> {
    if (this.sql.includes("INSERT INTO bookings")) {
      const [
        id,
        roomId,
        title,
        contactName,
        phone,
        email,
        startTime,
        endTime,
        status,
        source,
        createdAt,
        updatedAt,
        cancelledAt,
        cancelledBy,
        reviewedByAdminId,
        reviewedAt,
      ] = this.binds as [
        string,
        string,
        string,
        string,
        string,
        string | null,
        string,
        string,
        BookingStatus,
        "public" | "tablet" | "admin",
        string,
        string,
        string | null,
        string | null,
        string | null,
        string | null,
      ];
      this.db.bookings.push({
        id,
        room_id: roomId,
        title,
        contact_name: contactName,
        phone,
        email,
        start_time: startTime,
        end_time: endTime,
        status,
        source,
        created_at: createdAt,
        updated_at: updatedAt,
        cancelled_at: cancelledAt,
        cancelled_by: cancelledBy,
        reviewed_by_admin_id: reviewedByAdminId,
        reviewed_at: reviewedAt,
      });
      return { meta: { changes: 1 } };
    }
    if (this.sql.includes("INSERT INTO booking_links")) {
      const [id, type, token, roomId, adminId, createdAt, updatedAt] = this.binds as [
        string,
        "global" | "room_specific",
        string,
        string | null,
        string,
        string,
        string,
      ];
      this.db.bookingLinks.push({
        id,
        type,
        token,
        room_id: roomId,
        is_enabled: 1,
        created_by_admin_id: adminId,
        created_at: createdAt,
        updated_at: updatedAt,
      });
      return { meta: { changes: 1 } };
    }
    if (this.sql.includes("INSERT INTO admins")) {
      const [id, email, name, passwordHash, isEnabled, createdAt, updatedAt] = this.binds as [
        string,
        string,
        string,
        string,
        number,
        string,
        string,
      ];
      this.db.admins.push({
        id,
        email,
        name,
        password_hash: passwordHash,
        is_enabled: isEnabled,
        last_login_at: null,
        created_at: createdAt,
        updated_at: updatedAt,
      });
      return { meta: { changes: 1 } };
    }
    if (this.sql.includes("INSERT INTO audit_logs")) {
      return { meta: { changes: 1 } };
    }
    if (this.sql.includes("INSERT INTO email_settings")) {
      const [id, senderEmail, emailSubject, replyInstructions, isEmailEnabled, updatedAt, updatedByAdminId] = this.binds as [
        "default",
        string,
        string,
        string,
        number,
        string,
        string,
      ];
      this.db.emailSettings = {
        id,
        sender_email: senderEmail,
        email_subject: emailSubject,
        reply_instructions: replyInstructions,
        is_email_enabled: isEmailEnabled,
        updated_at: updatedAt,
        updated_by_admin_id: updatedByAdminId,
      };
      return { meta: { changes: 1 } };
    }
    if (this.sql.includes("INSERT INTO business_settings")) {
      const [id, businessTimeZone, updatedAt, updatedByAdminId] = this.binds as [
        "default",
        string,
        string,
        string,
      ];
      this.db.businessSettings = {
        id,
        business_time_zone: businessTimeZone,
        updated_at: updatedAt,
        updated_by_admin_id: updatedByAdminId,
      };
      return { meta: { changes: 1 } };
    }
    if (this.sql.includes("UPDATE booking_links")) {
      const [isEnabled, updatedAt, id] = this.binds as [number, string, string];
      const link = this.db.bookingLinks.find((candidate) => candidate.id === id);
      if (!link) {
        return { meta: { changes: 0 } };
      }
      link.is_enabled = isEnabled;
      link.updated_at = updatedAt;
      return { meta: { changes: 1 } };
    }
    if (this.sql.includes("DELETE FROM booking_links")) {
      const [id] = this.binds as [string];
      const index = this.db.bookingLinks.findIndex((candidate) => candidate.id === id);
      if (index === -1) {
        return { meta: { changes: 0 } };
      }
      this.db.bookingLinks.splice(index, 1);
      return { meta: { changes: 1 } };
    }
    if (this.sql.includes("DELETE FROM bookings")) {
      const [id] = this.binds as [string];
      const index = this.db.bookings.findIndex((candidate) => candidate.id === id);
      if (index === -1) {
        return { meta: { changes: 0 } };
      }
      this.db.bookings.splice(index, 1);
      return { meta: { changes: 1 } };
    }
    if (this.sql.includes("DELETE FROM devices")) {
      const [id] = this.binds as [string];
      const index = this.db.devices.findIndex((candidate) => candidate.id === id);
      if (index === -1) {
        return { meta: { changes: 0 } };
      }
      this.db.devices.splice(index, 1);
      return { meta: { changes: 1 } };
    }
    if (this.sql.includes("DELETE FROM rooms")) {
      const [id] = this.binds as [string];
      const index = this.db.rooms.findIndex((candidate) => candidate.id === id);
      if (index === -1) {
        return { meta: { changes: 0 } };
      }
      this.db.rooms.splice(index, 1);
      return { meta: { changes: 1 } };
    }
    if (this.sql.includes("UPDATE devices") && this.sql.includes("last_seen_at")) {
      const [lastSeenAt, deviceCode] = this.binds as [string, string];
      const device = this.db.devices.find(
        (candidate) => candidate.device_code === deviceCode && candidate.is_enabled === 1,
      );
      if (!device) {
        return { meta: { changes: 0 } };
      }
      device.last_seen_at = lastSeenAt;
      return { meta: { changes: 1 } };
    }
    if (this.sql.includes("UPDATE admins")) {
      const passwordUpdate = this.sql.includes("password_hash");
      const [name, maybePasswordHash, maybeIsEnabled, maybeUpdatedAt, maybeId] = this.binds as [
        string,
        string | number,
        number | string,
        string,
        string | undefined,
      ];
      const id = passwordUpdate ? maybeId : (maybeUpdatedAt as string);
      const admin = this.db.admins.find((candidate) => candidate.id === id);
      if (!admin) {
        return { meta: { changes: 0 } };
      }
      admin.name = name;
      if (passwordUpdate) {
        admin.password_hash = maybePasswordHash as string;
        admin.is_enabled = maybeIsEnabled as number;
        admin.updated_at = maybeUpdatedAt;
      } else {
        admin.is_enabled = maybePasswordHash as number;
        admin.updated_at = maybeIsEnabled as string;
      }
      return { meta: { changes: 1 } };
    }
    if (this.sql.includes("UPDATE bookings")) {
      if (this.sql.includes("status = 'confirmed'")) {
        const [adminId, reviewedAt, updatedAt, id] = this.binds as [string, string, string, string];
        const booking = this.db.bookings.find(
          (candidate) => candidate.id === id && candidate.status === "pending_approval",
        );
        if (!booking) {
          return { meta: { changes: 0 } };
        }
        booking.status = "confirmed";
        booking.reviewed_by_admin_id = adminId;
        booking.reviewed_at = reviewedAt;
        booking.updated_at = updatedAt;
        return { meta: { changes: 1 } };
      }
      if (this.sql.includes("status = 'rejected'")) {
        const [adminId, reviewedAt, updatedAt, id] = this.binds as [string, string, string, string];
        const booking = this.db.bookings.find(
          (candidate) => candidate.id === id && candidate.status === "pending_approval",
        );
        if (!booking) {
          return { meta: { changes: 0 } };
        }
        booking.status = "rejected";
        booking.reviewed_by_admin_id = adminId;
        booking.reviewed_at = reviewedAt;
        booking.updated_at = updatedAt;
        return { meta: { changes: 1 } };
      }
      if (!this.sql.includes("phone = ?")) {
        const [cancelledAt, cancelledBy, updatedAt, id] = this.binds as [string, string, string, string];
        const booking = this.db.bookings.find(
          (candidate) =>
            candidate.id === id && (candidate.status === "confirmed" || candidate.status === "pending_approval"),
        );
        if (!booking) {
          return { meta: { changes: 0 } };
        }
        booking.status = "cancelled";
        booking.cancelled_at = cancelledAt;
        booking.cancelled_by = cancelledBy;
        booking.updated_at = updatedAt;
        return { meta: { changes: 1 } };
      }
      const [cancelledAt, cancelledBy, updatedAt, id, phone] = this.binds as [string, string, string, string, string];
      const booking = this.db.bookings.find(
        (candidate) =>
          candidate.id === id &&
          candidate.phone === phone &&
          (candidate.status === "confirmed" || candidate.status === "pending_approval"),
      );
      if (!booking) {
        return { meta: { changes: 0 } };
      }
      booking.status = "cancelled";
      booking.cancelled_at = cancelledAt;
      booking.cancelled_by = cancelledBy;
      booking.updated_at = updatedAt;
      return { meta: { changes: 1 } };
    }
    return { meta: { changes: 0 } };
  }
}

class FakeD1Database {
  constructor(
    readonly rooms: RoomRow[] = [],
    readonly bookings: BookingRow[] = [],
    readonly admins: AdminRow[] = [],
    readonly devices: DeviceRow[] = [],
    readonly bookingLinks: BookingLinkRow[] = [],
    public emailSettings: EmailSettingsRow | null = null,
    public businessSettings: BusinessSettingsRow | null = null,
  ) {}

  prepare(sql: string): FakePreparedStatement {
    return new FakePreparedStatement(this, sql);
  }

  asD1(): D1Database {
    return this as unknown as D1Database;
  }
}

const room: RoomRow = {
  id: "room-1",
  name: "Board Room",
  location: "2F",
  capacity: 8,
  equipment_notes: null,
  is_enabled: 1,
  opening_hours: '{"days":[1,2,3,4,5],"start":"09:00","end":"18:00"}',
  min_duration_minutes: 30,
  max_duration_minutes: 240,
  max_advance_days: 30,
  requires_approval: 0,
  created_at: "2026-04-28T00:00:00.000Z",
  updated_at: "2026-04-28T00:00:00.000Z",
};

const booking: BookingRow = {
  id: "booking-1",
  room_id: "room-1",
  title: "Planning",
  contact_name: "Alice",
  phone: "13800000000",
  email: "alice@example.com",
  start_time: "2026-04-29T08:00:00.000Z",
  end_time: "2026-04-29T09:00:00.000Z",
  status: "confirmed",
  source: "public",
  created_at: "2026-04-28T01:00:00.000Z",
  updated_at: "2026-04-28T01:30:00.000Z",
  cancelled_at: null,
  cancelled_by: null,
  reviewed_by_admin_id: null,
  reviewed_at: null,
};

function jsonRequest(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

function resendEnv(overrides: Record<string, string> = {}) {
  return {
    RESEND_API_KEY: "resend-api-key",
    EMAIL_FROM: "noreply@example.com",
    ...overrides,
  };
}

describe("public API routes", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-28T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns health status", async () => {
    const response = await app.request("/api/health", {}, { DB: new FakeD1Database().asD1() });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("returns default public business settings", async () => {
    const response = await app.request("/api/public/settings", {}, { DB: new FakeD1Database().asD1() });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      settings: {
        businessTimeZone: "Europe/Berlin",
      },
    });
  });

  it("returns enabled rooms", async () => {
    const db = new FakeD1Database([room, { ...room, id: "disabled-room", is_enabled: 0 }]);

    const response = await app.request("/api/public/rooms", {}, { DB: db.asD1() });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      rooms: [
        {
          id: "room-1",
          name: "Board Room",
          location: "2F",
          capacity: 8,
          equipmentNotes: null,
          isEnabled: true,
          openingHours: '{"days":[1,2,3,4,5],"start":"09:00","end":"18:00"}',
          minDurationMinutes: 30,
          maxDurationMinutes: 240,
          maxAdvanceDays: 30,
          requiresApproval: false,
          createdAt: "2026-04-28T00:00:00.000Z",
          updatedAt: "2026-04-28T00:00:00.000Z",
        },
      ],
    });
  });

  it("returns public room bookings for the requested room and date", async () => {
    const otherRoomBooking: BookingRow = {
      ...booking,
      id: "other-room-booking",
      room_id: "room-2",
      title: "Other room",
    };
    const nextDayBooking: BookingRow = {
      ...booking,
      id: "next-day-booking",
      start_time: "2026-04-30T08:00:00.000Z",
      end_time: "2026-04-30T09:00:00.000Z",
    };
    const cancelledBooking: BookingRow = {
      ...booking,
      id: "cancelled-booking",
      status: "cancelled",
    };
    const pendingBooking: BookingRow = {
      ...booking,
      id: "pending-booking",
      title: "Design review",
      contact_name: "Bob",
      start_time: "2026-04-29T10:00:00.000Z",
      end_time: "2026-04-29T11:00:00.000Z",
      status: "pending_approval",
    };
    const db = new FakeD1Database(
      [room, { ...room, id: "room-2", name: "Focus Room" }],
      [pendingBooking, otherRoomBooking, cancelledBooking, nextDayBooking, booking],
    );

    const response = await app.request(
      "/api/public/bookings?roomId=room-1&date=2026-04-29",
      {},
      { DB: db.asD1() },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      bookings: [
        {
          id: "booking-1",
          roomId: "room-1",
          title: "Planning",
          contactName: "Alice",
          startTime: "2026-04-29T08:00:00.000Z",
          endTime: "2026-04-29T09:00:00.000Z",
          status: "confirmed",
        },
        {
          id: "pending-booking",
          roomId: "room-1",
          title: "Design review",
          contactName: "Bob",
          startTime: "2026-04-29T10:00:00.000Z",
          endTime: "2026-04-29T11:00:00.000Z",
          status: "pending_approval",
        },
      ],
    });
  });

  it("uses Germany time when listing public bookings by date even if another timezone is requested", async () => {
    const newYorkEveningBooking: BookingRow = {
      ...booking,
      id: "new-york-evening",
      start_time: "2026-04-30T02:00:00.000Z",
      end_time: "2026-04-30T03:00:00.000Z",
    };
    const db = new FakeD1Database([room], [newYorkEveningBooking]);

    const response = await app.request(
      "/api/public/bookings?roomId=room-1&date=2026-04-29&timeZone=America%2FNew_York",
      {},
      { DB: db.asD1() },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ bookings: [] });
  });

  it("uses the saved business timezone when listing public bookings by date", async () => {
    const newYorkEveningBooking: BookingRow = {
      ...booking,
      id: "new-york-evening",
      start_time: "2026-04-30T02:00:00.000Z",
      end_time: "2026-04-30T03:00:00.000Z",
    };
    const db = new FakeD1Database([room], [newYorkEveningBooking], [], [], [], null, {
      id: "default",
      business_time_zone: "America/New_York",
      updated_at: "2026-04-28T00:00:00.000Z",
      updated_by_admin_id: null,
    });

    const response = await app.request(
      "/api/public/bookings?roomId=room-1&date=2026-04-29",
      {},
      { DB: db.asD1() },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      bookings: [
        {
          id: "new-york-evening",
          roomId: "room-1",
          title: "Planning",
          contactName: "Alice",
          startTime: "2026-04-30T02:00:00.000Z",
          endTime: "2026-04-30T03:00:00.000Z",
          status: "confirmed",
        },
      ],
    });
  });

  it("does not expose public bookings for disabled rooms", async () => {
    const disabledRoom: RoomRow = { ...room, is_enabled: 0 };
    const db = new FakeD1Database([disabledRoom], [booking]);

    const response = await app.request(
      "/api/public/bookings?roomId=room-1&date=2026-04-29",
      {},
      { DB: db.asD1() },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "room_not_found" });
  });

  it("rejects invalid public booking dates", async () => {
    const response = await app.request(
      "/api/public/bookings?roomId=room-1&date=2026-99-99",
      {},
      { DB: new FakeD1Database([room], [booking]).asD1() },
    );

    expect(response.status).toBe(400);
  });

  it("rejects invalid public booking timezones", async () => {
    const response = await app.request(
      "/api/public/bookings?roomId=room-1&date=2026-04-29&timeZone=not-a-timezone",
      {},
      { DB: new FakeD1Database([room], [booking]).asD1() },
    );

    expect(response.status).toBe(400);
  });

  it("creates a booking and returns booking id with status", async () => {
    const db = new FakeD1Database([room]);

    const response = await app.request(
      "/api/public/bookings",
      jsonRequest({
        roomId: "room-1",
        title: "Planning",
        contactName: "Alice",
        email: "alice@example.com",
        startTime: "2026-04-29T08:00:00.000Z",
        endTime: "2026-04-29T09:00:00.000Z",
      }),
      { DB: db.asD1() },
    );

    expect(response.status).toBe(201);
    const body = (await response.json()) as { bookingId: string; status: string };
    expect(body.bookingId).toEqual(expect.any(String));
    expect(body.status).toBe("confirmed");
    expect(db.bookings[0]).toMatchObject({
      id: body.bookingId,
      room_id: "room-1",
      email: "alice@example.com",
      source: "public",
    });
  });

  it("rejects public bookings without a contact email", async () => {
    const db = new FakeD1Database([room]);

    const response = await app.request(
      "/api/public/bookings",
      jsonRequest({
        roomId: "room-1",
        title: "Planning",
        contactName: "Alice",
        startTime: "2026-04-29T08:00:00.000Z",
        endTime: "2026-04-29T09:00:00.000Z",
      }),
      { DB: db.asD1() },
    );

    expect(response.status).toBe(400);
    expect(db.bookings).toHaveLength(0);
  });

  it("restricts room-specific public booking links to their room", async () => {
    const otherRoom: RoomRow = { ...room, id: "room-2", name: "Focus Room" };
    const link: BookingLinkRow = {
      id: "link-1",
      type: "room_specific",
      token: "roomtoken",
      room_id: "room-1",
      is_enabled: 1,
      created_by_admin_id: "admin-1",
      created_at: "2026-04-28T09:00:00.000Z",
      updated_at: "2026-04-28T09:00:00.000Z",
    };
    const db = new FakeD1Database([room, otherRoom], [], [], [], [link]);

    const linkResponse = await app.request("/api/public/links/roomtoken", {}, { DB: db.asD1() });
    expect(linkResponse.status).toBe(200);
    const linkBody = (await linkResponse.json()) as { rooms: Array<{ id: string }> };
    expect(linkBody.rooms.map((candidate) => candidate.id)).toEqual(["room-1"]);

    const mismatch = await app.request(
      "/api/public/links/roomtoken/bookings",
      jsonRequest({
        roomId: "room-2",
        title: "Wrong room",
        contactName: "Alice",
        email: "alice@example.com",
        startTime: "2026-04-29T08:00:00.000Z",
        endTime: "2026-04-29T09:00:00.000Z",
      }),
      { DB: db.asD1() },
    );
    expect(mismatch.status).toBe(400);
    expect(await mismatch.json()).toEqual({ error: "booking_link_room_mismatch" });
  });

  it("returns conflict when booking overlaps an active booking", async () => {
    const db = new FakeD1Database([room], [booking]);

    const response = await app.request(
      "/api/public/bookings",
      jsonRequest({
        roomId: "room-1",
        title: "Overlap",
        contactName: "Bob",
        email: "bob@example.com",
        startTime: "2026-04-29T08:30:00.000Z",
        endTime: "2026-04-29T09:30:00.000Z",
      }),
      { DB: db.asD1() },
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "booking_conflict" });
  });

  it("returns a bad request instead of a conflict for invalid booking time ranges", async () => {
    const db = new FakeD1Database([room]);

    const response = await app.request(
      "/api/public/bookings",
      jsonRequest({
        roomId: "room-1",
        title: "Invalid range",
        contactName: "Bob",
        email: "bob@example.com",
        startTime: "2026-04-29T02:00:00.000Z",
        endTime: "2026-04-29T02:00:00.000Z",
      }),
      { DB: db.asD1() },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_time_range" });
  });

  it("does not expose phone-based public cancellation routes", async () => {
    const response = await app.request(
      "/api/public/cancellations/search",
      jsonRequest({}),
      { DB: new FakeD1Database([room], [booking]).asD1() },
    );

    expect(response.status).toBe(404);
  });
});

describe("public API email notifications", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-28T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function bookingPayload(overrides: Partial<{ email: string }> = {}) {
    return {
      roomId: "room-1",
      title: "Planning",
      contactName: "Alice",
      email: "alice@example.com",
      startTime: "2026-04-29T08:00:00.000Z",
      endTime: "2026-04-29T09:00:00.000Z",
      ...overrides,
    };
  }

  it("rejects email notifications when contact email is missing because booking email is required", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const db = new FakeD1Database([room]);

    const response = await app.request(
      "/api/public/bookings",
      jsonRequest({
        roomId: "room-1",
        title: "Planning",
        contactName: "Alice",
        startTime: "2026-04-29T08:00:00.000Z",
        endTime: "2026-04-29T09:00:00.000Z",
      }),
      {
        DB: db.asD1(),
        ...resendEnv(),
      },
    );

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("calls Resend with from/to/subject and meeting details when booking has email and provider is configured", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const db = new FakeD1Database([room]);

    const response = await app.request(
      "/api/public/bookings",
      jsonRequest(bookingPayload({ email: "alice@example.com" })),
      { DB: db.asD1(), ...resendEnv() },
    );

    expect(response.status).toBe(201);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [sendUrl, sendInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(sendUrl).toBe("https://api.resend.com/emails");
    expect(sendInit.method).toBe("POST");
    expect((sendInit.headers as Record<string, string>).Authorization).toBe("Bearer resend-api-key");
    const sendBody = JSON.parse(sendInit.body as string) as { from: string; to: string; subject: string; text: string };
    expect(sendBody.from).toBe("noreply@example.com");
    expect(sendBody.to).toBe("alice@example.com");
    expect(sendBody.subject).toBe("Meeting Booking Notification");
    expect(sendBody.text).toContain("Your meeting booking has been confirmed.");
    expect(sendBody.text).toContain("Meeting: Planning");
    expect(sendBody.text).toContain("Room: Board Room");
    expect(sendBody.text).toContain("Time zone: Europe/Berlin (Berlin time)");
    expect(sendBody.text).toContain("Start: 2026-04-29 10:00");
    expect(sendBody.text).toContain("End: 2026-04-29 11:00");
    expect(sendBody.text).toContain("This is an automated email.");
    expect(sendBody.text).toContain("Contact your meeting room administrator if your meeting details change.");
  });

  it("does not send email when a public booking is only submitted for approval", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const db = new FakeD1Database([{ ...room, requires_approval: 1 }]);

    const response = await app.request(
      "/api/public/bookings",
      jsonRequest(bookingPayload({ email: "alice@example.com" })),
      { DB: db.asD1(), ...resendEnv() },
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ status: "pending_approval" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not call Resend when email notifications are disabled", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const db = new FakeD1Database([room], [], [], [], [], {
      id: "default",
      sender_email: "noreply@example.com",
      email_subject: "Meeting Booking Notification",
      reply_instructions: "Email body",
      is_email_enabled: 0,
      updated_at: "2026-04-28T00:00:00.000Z",
      updated_by_admin_id: null,
    });

    const response = await app.request(
      "/api/public/bookings",
      jsonRequest(bookingPayload({ email: "alice@example.com" })),
      { DB: db.asD1(), ...resendEnv() },
    );

    expect(response.status).toBe(201);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not call fetch on booking when provider is not configured", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const db = new FakeD1Database([room]);

    const response = await app.request(
      "/api/public/bookings",
      jsonRequest(bookingPayload({ email: "alice@example.com" })),
      { DB: db.asD1() },
    );

    expect(response.status).toBe(201);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns booking success even when the email provider returns 500", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 500 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const db = new FakeD1Database([room]);

    const response = await app.request(
      "/api/public/bookings",
      jsonRequest(bookingPayload({ email: "alice@example.com" })),
      { DB: db.asD1(), ...resendEnv() },
    );

    expect(response.status).toBe(201);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(db.bookings).toHaveLength(1);
  });
});

describe("admin API routes", () => {
  const enabledAdmin: AdminRow = {
    id: "admin-1",
    email: "admin@example.com",
    name: "Admin User",
    password_hash: bcrypt.hashSync("correct-password", 12),
    is_enabled: 1,
    last_login_at: null,
    created_at: "2026-04-28T00:00:00.000Z",
    updated_at: "2026-04-28T00:00:00.000Z",
  };

  async function adminHeaders(): Promise<HeadersInit> {
    const token = await createAdminToken(enabledAdmin.id, TEST_JWT_SECRET);
    return { Authorization: `Bearer ${token}` };
  }

  async function adminJsonRequest(body: unknown): Promise<RequestInit> {
    return {
      ...jsonRequest(body),
      headers: { "content-type": "application/json", ...(await adminHeaders()) },
    };
  }

  it("logs in enabled admins and lists all rooms with a bearer token", async () => {
    const db = new FakeD1Database(
      [room, { ...room, id: "disabled-room", name: "Quiet Room", is_enabled: 0 }],
      [],
      [enabledAdmin],
    );

    const loginResponse = await app.request(
      "/api/admin/login",
      jsonRequest({ email: "admin@example.com", password: "correct-password" }),
      { DB: db.asD1(), JWT_SECRET: TEST_JWT_SECRET },
    );

    expect(loginResponse.status).toBe(200);
    const loginBody = (await loginResponse.json()) as { token: string };
    expect(loginBody.token).toEqual(expect.any(String));

    const roomsResponse = await app.request(
      "/api/admin/rooms",
      { headers: { Authorization: `Bearer ${loginBody.token}` } },
      { DB: db.asD1(), JWT_SECRET: TEST_JWT_SECRET },
    );

    expect(roomsResponse.status).toBe(200);
    const roomsBody = (await roomsResponse.json()) as { rooms: Array<{ id: string; isEnabled: boolean }> };
    expect(roomsBody.rooms.map((candidate) => ({ id: candidate.id, isEnabled: candidate.isEnabled }))).toEqual([
      { id: "room-1", isEnabled: true },
      { id: "disabled-room", isEnabled: false },
    ]);
  });

  it("rejects missing bearer tokens on protected admin routes", async () => {
    const response = await app.request(
      "/api/admin/rooms",
      {},
      { DB: new FakeD1Database().asD1(), JWT_SECRET: TEST_JWT_SECRET },
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
  });

  it("returns and updates business settings for authenticated admins", async () => {
    const db = new FakeD1Database([], [], [enabledAdmin]);

    const defaultResponse = await app.request(
      "/api/admin/business-settings",
      { headers: await adminHeaders() },
      { DB: db.asD1(), JWT_SECRET: TEST_JWT_SECRET },
    );
    expect(defaultResponse.status).toBe(200);
    expect(await defaultResponse.json()).toEqual({
      settings: {
        businessTimeZone: "Europe/Berlin",
      },
    });

    const updateResponse = await app.request(
      "/api/admin/business-settings",
      {
        ...(await adminJsonRequest({ businessTimeZone: "America/New_York" })),
        method: "PUT",
      },
      { DB: db.asD1(), JWT_SECRET: TEST_JWT_SECRET },
    );
    expect(updateResponse.status).toBe(200);
    expect(await updateResponse.json()).toEqual({
      settings: {
        businessTimeZone: "America/New_York",
      },
    });
    expect(db.businessSettings).toMatchObject({
      id: "default",
      business_time_zone: "America/New_York",
      updated_by_admin_id: "admin-1",
    });
  });

  it("rejects invalid business timezones", async () => {
    const db = new FakeD1Database([], [], [enabledAdmin]);

    const response = await app.request(
      "/api/admin/business-settings",
      {
        ...(await adminJsonRequest({ businessTimeZone: "not-a-timezone" })),
        method: "PUT",
      },
      { DB: db.asD1(), JWT_SECRET: TEST_JWT_SECRET },
    );

    expect(response.status).toBe(400);
    expect(db.businessSettings).toBeNull();
  });

  it("requires auth before listing booking links", async () => {
    const response = await app.request(
      "/api/admin/links",
      {},
      { DB: new FakeD1Database().asD1(), JWT_SECRET: TEST_JWT_SECRET },
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
  });

  it("returns booking links to authenticated admins", async () => {
    const db = new FakeD1Database([], [], [enabledAdmin], [], [
      {
        id: "link-1",
        type: "global",
        token: "abc123",
        room_id: null,
        is_enabled: 1,
        created_by_admin_id: "admin-1",
        created_at: "2026-04-28T09:00:00.000Z",
        updated_at: "2026-04-28T09:00:00.000Z",
      },
    ]);

    const response = await app.request(
      "/api/admin/links",
      { headers: await adminHeaders() },
      { DB: db.asD1(), JWT_SECRET: TEST_JWT_SECRET },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      links: [
        expect.objectContaining({
          id: "link-1",
          type: "global",
          token: "abc123",
          roomId: null,
          roomName: null,
          isEnabled: true,
          url: "http://localhost/book/abc123",
        }),
      ],
    });
  });

  it("creates a global booking link and returns its URL and QR code", async () => {
    const db = new FakeD1Database([], [], [enabledAdmin]);

    const response = await app.request(
      "/api/admin/links",
      await adminJsonRequest({ type: "global" }),
      { DB: db.asD1(), JWT_SECRET: TEST_JWT_SECRET, PUBLIC_BASE_URL: "https://book.example.com" },
    );

    expect(response.status).toBe(201);
    const body = (await response.json()) as { id: string; token: string; url: string; qrCodeDataUrl: string };
    expect(body.id).toEqual(expect.any(String));
    expect(body.token).toMatch(/^[a-f0-9]{32}$/);
    expect(body.url).toBe(`https://book.example.com/book/${body.token}`);
    expect(body.qrCodeDataUrl).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
    expect(db.bookingLinks).toHaveLength(1);
    expect(db.bookingLinks[0]).toMatchObject({
      id: body.id,
      type: "global",
      token: body.token,
      room_id: null,
      created_by_admin_id: "admin-1",
    });
  });

  it("returns booking links with full URLs, QR codes, and room names", async () => {
    const db = new FakeD1Database([room], [], [enabledAdmin], [], [
      {
        id: "link-1",
        type: "room_specific",
        token: "roomtoken",
        room_id: "room-1",
        is_enabled: 1,
        created_by_admin_id: "admin-1",
        created_at: "2026-04-28T09:00:00.000Z",
        updated_at: "2026-04-28T09:00:00.000Z",
      },
    ]);

    const response = await app.request(
      "/api/admin/links",
      { headers: await adminHeaders() },
      { DB: db.asD1(), JWT_SECRET: TEST_JWT_SECRET, PUBLIC_BASE_URL: "https://book.example.com" },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      links: Array<{ url: string; qrCodeDataUrl: string; roomName: string | null; createdAt: string }>;
    };
    expect(body.links[0]).toMatchObject({
      url: "https://book.example.com/book/roomtoken",
      roomName: "Board Room",
      createdAt: "2026-04-28T09:00:00.000Z",
    });
    expect(body.links[0].qrCodeDataUrl).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
  });

  it("toggles booking link availability", async () => {
    const db = new FakeD1Database([], [], [enabledAdmin], [], [
      {
        id: "link-1",
        type: "global",
        token: "abc123",
        room_id: null,
        is_enabled: 1,
        created_by_admin_id: "admin-1",
        created_at: "2026-04-28T09:00:00.000Z",
        updated_at: "2026-04-28T09:00:00.000Z",
      },
    ]);

    const response = await app.request(
      "/api/admin/links/link-1",
      {
        method: "PATCH",
        headers: { "content-type": "application/json", ...(await adminHeaders()) },
        body: JSON.stringify({ isEnabled: false }),
      },
      { DB: db.asD1(), JWT_SECRET: TEST_JWT_SECRET, PUBLIC_BASE_URL: "https://book.example.com" },
    );

    expect(response.status).toBe(200);
    expect(db.bookingLinks[0].is_enabled).toBe(0);
  });

  it("deletes a booking link", async () => {
    const db = new FakeD1Database([], [], [enabledAdmin], [], [
      {
        id: "link-1",
        type: "global",
        token: "abc123",
        room_id: null,
        is_enabled: 1,
        created_by_admin_id: "admin-1",
        created_at: "2026-04-28T09:00:00.000Z",
        updated_at: "2026-04-28T09:00:00.000Z",
      },
    ]);

    const response = await app.request(
      "/api/admin/links/link-1",
      { method: "DELETE", headers: await adminHeaders() },
      { DB: db.asD1(), JWT_SECRET: TEST_JWT_SECRET },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(db.bookingLinks).toHaveLength(0);
  });

  it("returns not found when deleting a missing booking link", async () => {
    const db = new FakeD1Database([], [], [enabledAdmin]);

    const response = await app.request(
      "/api/admin/links/missing-link",
      { method: "DELETE", headers: await adminHeaders() },
      { DB: db.asD1(), JWT_SECRET: TEST_JWT_SECRET },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "link_not_found" });
  });

  it("deletes an admin booking", async () => {
    const db = new FakeD1Database([room], [{ ...booking, status: "confirmed" }], [enabledAdmin]);

    const response = await app.request(
      "/api/admin/bookings/booking-1",
      { method: "DELETE", headers: await adminHeaders() },
      { DB: db.asD1(), JWT_SECRET: TEST_JWT_SECRET },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(db.bookings).toHaveLength(0);
  });

  it("deletes an admin device", async () => {
    const db = new FakeD1Database([], [], [enabledAdmin], [
      {
        id: "device-1",
        device_code: "pad-1",
        name: "Lobby Pad",
        default_room_id: null,
        is_enabled: 1,
        last_seen_at: null,
        created_at: "2026-04-28T09:00:00.000Z",
        updated_at: "2026-04-28T09:00:00.000Z",
      },
    ]);

    const response = await app.request(
      "/api/admin/devices/device-1",
      { method: "DELETE", headers: await adminHeaders() },
      { DB: db.asD1(), JWT_SECRET: TEST_JWT_SECRET },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(db.devices).toHaveLength(0);
  });

  it("blocks deleting rooms that still have dependent records", async () => {
    const db = new FakeD1Database([room], [{ ...booking, status: "confirmed" }], [enabledAdmin]);

    const response = await app.request(
      "/api/admin/rooms/room-1",
      { method: "DELETE", headers: await adminHeaders() },
      { DB: db.asD1(), JWT_SECRET: TEST_JWT_SECRET },
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "room_has_dependencies" });
    expect(db.rooms).toHaveLength(1);
  });

  it("lists bookings and lets admins cancel active bookings", async () => {
    const db = new FakeD1Database([room], [{ ...booking, status: "confirmed" }], [enabledAdmin]);

    const listResponse = await app.request(
      "/api/admin/bookings",
      { headers: await adminHeaders() },
      { DB: db.asD1(), JWT_SECRET: TEST_JWT_SECRET },
    );
    expect(listResponse.status).toBe(200);
    const listBody = (await listResponse.json()) as { bookings: Array<{ roomName: string; title: string }> };
    expect(listBody.bookings[0]).toMatchObject({ title: "Planning", roomName: "Board Room" });

    const cancelResponse = await app.request(
      "/api/admin/bookings/booking-1/cancel",
      { method: "POST", headers: await adminHeaders() },
      { DB: db.asD1(), JWT_SECRET: TEST_JWT_SECRET },
    );
    expect(cancelResponse.status).toBe(200);
    expect(db.bookings[0]).toMatchObject({ status: "cancelled", cancelled_by: "admin:admin-1" });
  });

  it("creates admin bookings with source admin", async () => {
    const db = new FakeD1Database([room], [], [enabledAdmin]);

    const response = await app.request(
      "/api/admin/bookings",
      await adminJsonRequest({
        roomId: "room-1",
        title: "Admin hold",
        contactName: "Admin",
        startTime: "2026-04-29T08:00:00.000Z",
        endTime: "2026-04-29T09:00:00.000Z",
      }),
      { DB: db.asD1(), JWT_SECRET: TEST_JWT_SECRET },
    );

    expect(response.status).toBe(201);
    expect(db.bookings[0]).toMatchObject({ title: "Admin hold", source: "admin", status: "confirmed" });
  });

  it("approves and rejects pending booking requests", async () => {
    const pendingBooking: BookingRow = { ...booking, id: "pending-booking", status: "pending_approval" };
    const rejectedBooking: BookingRow = { ...booking, id: "reject-booking", status: "pending_approval" };
    const db = new FakeD1Database([room], [pendingBooking, rejectedBooking], [enabledAdmin]);

    const listResponse = await app.request(
      "/api/admin/approvals",
      { headers: await adminHeaders() },
      { DB: db.asD1(), JWT_SECRET: TEST_JWT_SECRET },
    );
    expect(listResponse.status).toBe(200);
    const listBody = (await listResponse.json()) as { bookings: Array<{ id: string }> };
    expect(listBody.bookings.map((candidate) => candidate.id)).toEqual(["pending-booking", "reject-booking"]);

    const approveResponse = await app.request(
      "/api/admin/approvals/pending-booking/approve",
      { method: "POST", headers: await adminHeaders() },
      { DB: db.asD1(), JWT_SECRET: TEST_JWT_SECRET },
    );
    expect(approveResponse.status).toBe(200);

    const rejectResponse = await app.request(
      "/api/admin/approvals/reject-booking/reject",
      { method: "POST", headers: await adminHeaders() },
      { DB: db.asD1(), JWT_SECRET: TEST_JWT_SECRET },
    );
    expect(rejectResponse.status).toBe(200);
    expect(db.bookings.map((candidate) => candidate.status)).toEqual(["confirmed", "rejected"]);
    expect(db.bookings[0].reviewed_by_admin_id).toBe("admin-1");
  });

  it("saves and returns email notification settings", async () => {
    const db = new FakeD1Database([], [], [enabledAdmin]);
    const updateRequest = await adminJsonRequest({
      isEmailEnabled: false,
      emailSubject: "Meeting booking approved",
      replyInstructions: "Please reply to this email if your meeting details change.",
    });

    const updateResponse = await app.request(
      "/api/admin/email-settings",
      { ...updateRequest, method: "PUT" },
      { DB: db.asD1(), JWT_SECRET: TEST_JWT_SECRET },
    );
    expect(updateResponse.status).toBe(200);

    const getResponse = await app.request(
      "/api/admin/email-settings",
      { headers: await adminHeaders() },
      { DB: db.asD1(), JWT_SECRET: TEST_JWT_SECRET, ...resendEnv() },
    );
    expect(getResponse.status).toBe(200);
    expect(await getResponse.json()).toEqual({
      settings: {
        isEmailEnabled: false,
        emailSubject: "Meeting booking approved",
        replyInstructions: "Please reply to this email if your meeting details change.",
        providerConfigured: true,
      },
    });
  });

  it("sends approved booking emails with configured sender and reply instructions", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const pendingBooking: BookingRow = { ...booking, id: "pending-booking", status: "pending_approval" };
    const db = new FakeD1Database([room], [pendingBooking], [enabledAdmin], [], [], {
      id: "default",
      sender_email: "rooms@example.com",
      email_subject: "Meeting booking approved",
      reply_instructions: "Please reply to this email if your meeting details change.",
      is_email_enabled: 1,
      updated_at: "2026-04-28T00:00:00.000Z",
      updated_by_admin_id: "admin-1",
    });

    try {
      const response = await app.request(
        "/api/admin/approvals/pending-booking/approve",
        { method: "POST", headers: await adminHeaders() },
        { DB: db.asD1(), JWT_SECRET: TEST_JWT_SECRET, ...resendEnv() },
      );

      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [sendUrl, sendInit] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(sendUrl).toBe("https://api.resend.com/emails");
      const sendBody = JSON.parse(sendInit.body as string) as { from: string; to: string; subject: string; text: string };
      expect(sendBody.from).toBe("noreply@example.com");
      expect(sendBody.to).toBe("alice@example.com");
      expect(sendBody.subject).toBe("Meeting booking approved");
      expect(sendBody.text).toContain("Your meeting booking has been approved.");
      expect(sendBody.text).toContain("Meeting: Planning");
      expect(sendBody.text).toContain("Room: Board Room");
      expect(sendBody.text).toContain("Time zone: Europe/Berlin (Berlin time)");
      expect(sendBody.text).toContain("Start: 2026-04-29 10:00");
      expect(sendBody.text).toContain("End: 2026-04-29 11:00");
      expect(sendBody.text).toContain("Please reply to this email if your meeting details change.");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("returns Resend errors when sending a test email fails", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValueOnce(
      Response.json({ message: "The from domain is not verified." }, { status: 403 }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const db = new FakeD1Database([], [], [enabledAdmin], [], [], {
      id: "default",
      sender_email: "rooms@example.com",
      email_subject: "Meeting Booking Notification",
      reply_instructions: "Email body",
      is_email_enabled: 1,
      updated_at: "2026-04-28T00:00:00.000Z",
      updated_by_admin_id: "admin-1",
    });

    try {
      const response = await app.request(
        "/api/admin/email-settings/test",
        await adminJsonRequest({ to: "alice@example.com" }),
        { DB: db.asD1(), JWT_SECRET: TEST_JWT_SECRET, ...resendEnv({ EMAIL_FROM: "rooms@example.com" }) },
      );

      expect(response.status).toBe(502);
      expect(await response.json()).toEqual({
        ok: false,
        reason: "resend_403",
        details: "{\"message\":\"The from domain is not verified.\"}",
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [, sendInit] = fetchMock.mock.calls[0] as [string, RequestInit];
      const sendBody = JSON.parse(sendInit.body as string) as { to: string; text: string };
      expect(sendBody.to).toBe("alice@example.com");
      expect(sendBody.text).toContain("Time zone: Europe/Berlin (Berlin time)");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("lists, creates, and updates admin users", async () => {
    const db = new FakeD1Database([], [], [enabledAdmin]);

    const createResponse = await app.request(
      "/api/admin/admins",
      await adminJsonRequest({
        email: "second@example.com",
        name: "Second Admin",
        password: "second-password",
        isEnabled: true,
      }),
      { DB: db.asD1(), JWT_SECRET: TEST_JWT_SECRET },
    );
    expect(createResponse.status).toBe(201);

    const listResponse = await app.request(
      "/api/admin/admins",
      { headers: await adminHeaders() },
      { DB: db.asD1(), JWT_SECRET: TEST_JWT_SECRET },
    );
    expect(listResponse.status).toBe(200);
    const listBody = (await listResponse.json()) as { admins: Array<{ email: string; passwordHash?: string }> };
    expect(listBody.admins.map((admin) => admin.email)).toContain("second@example.com");
    expect(listBody.admins[0]).not.toHaveProperty("passwordHash");

    const updateResponse = await app.request(
      `/api/admin/admins/${db.admins[1].id}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json", ...(await adminHeaders()) },
        body: JSON.stringify({ name: "Renamed Admin", isEnabled: false, password: "updated-password" }),
      },
      { DB: db.asD1(), JWT_SECRET: TEST_JWT_SECRET },
    );
    expect(updateResponse.status).toBe(200);
    expect(db.admins[1]).toMatchObject({ name: "Renamed Admin", is_enabled: 0 });
  });

  it("rejects room-specific booking link requests without a room id", async () => {
    const db = new FakeD1Database([], [], [enabledAdmin]);

    const response = await app.request(
      "/api/admin/links",
      await adminJsonRequest({ type: "room_specific" }),
      { DB: db.asD1(), JWT_SECRET: TEST_JWT_SECRET, PUBLIC_BASE_URL: "https://book.example.com" },
    );

    expect(response.status).toBe(400);
    expect(db.bookingLinks).toHaveLength(0);
  });

  it("falls back to the request origin when the public base URL is missing", async () => {
    const db = new FakeD1Database([], [], [enabledAdmin]);

    const response = await app.request(
      "/api/admin/links",
      await adminJsonRequest({ type: "global" }),
      { DB: db.asD1(), JWT_SECRET: TEST_JWT_SECRET, PUBLIC_BASE_URL: "" },
    );

    expect(response.status).toBe(201);
    const body = (await response.json()) as { url: string };
    expect(body.url).toMatch(/^http:\/\/localhost\/book\//);
    expect(db.bookingLinks).toHaveLength(1);
  });

  it("rejects login when password is wrong", async () => {
    const db = new FakeD1Database([], [], [enabledAdmin]);

    const response = await app.request(
      "/api/admin/login",
      jsonRequest({ email: "admin@example.com", password: "wrong-password" }),
      { DB: db.asD1(), JWT_SECRET: TEST_JWT_SECRET },
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "invalid_credentials" });
  });

  it("rejects login when admin is disabled", async () => {
    const db = new FakeD1Database([], [], [{ ...enabledAdmin, is_enabled: 0 }]);

    const response = await app.request(
      "/api/admin/login",
      jsonRequest({ email: "admin@example.com", password: "correct-password" }),
      { DB: db.asD1(), JWT_SECRET: TEST_JWT_SECRET },
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "invalid_credentials" });
  });

  it("rejects login when admin email is unknown", async () => {
    const db = new FakeD1Database([], [], []);

    const response = await app.request(
      "/api/admin/login",
      jsonRequest({ email: "nobody@example.com", password: "correct-password" }),
      { DB: db.asD1(), JWT_SECRET: TEST_JWT_SECRET },
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "invalid_credentials" });
  });

  it("rejects malformed bearer tokens on protected routes", async () => {
    const db = new FakeD1Database([room], [], [enabledAdmin]);

    const response = await app.request(
      "/api/admin/rooms",
      { headers: { Authorization: "Bearer not-a-real-token" } },
      { DB: db.asD1(), JWT_SECRET: TEST_JWT_SECRET },
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
  });

  it("rejects valid tokens for now-disabled admins on protected routes", async () => {
    const token = await createAdminToken(enabledAdmin.id, TEST_JWT_SECRET);
    const db = new FakeD1Database([room], [], [{ ...enabledAdmin, is_enabled: 0 }]);

    const response = await app.request(
      "/api/admin/rooms",
      { headers: { Authorization: `Bearer ${token}` } },
      { DB: db.asD1(), JWT_SECRET: TEST_JWT_SECRET },
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
  });

  it("returns server_misconfigured when JWT secret is too weak on login", async () => {
    const db = new FakeD1Database([], [], [enabledAdmin]);

    const response = await app.request(
      "/api/admin/login",
      jsonRequest({ email: "admin@example.com", password: "correct-password" }),
      { DB: db.asD1(), JWT_SECRET: "too-short" },
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "server_misconfigured" });
  });

  it("returns server_misconfigured on protected routes when JWT secret is missing", async () => {
    const db = new FakeD1Database([room], [], [enabledAdmin]);

    const response = await app.request(
      "/api/admin/rooms",
      { headers: { Authorization: "Bearer any-token-value" } },
      { DB: db.asD1(), JWT_SECRET: "" },
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "server_misconfigured" });
  });
});

describe("tablet API routes", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-28T05:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const enabledDevice: DeviceRow = {
    id: "device-1",
    device_code: "ABC123",
    name: "Lobby Tablet",
    default_room_id: "room-1",
    is_enabled: 1,
    last_seen_at: null,
    created_at: "2026-04-28T00:00:00.000Z",
    updated_at: "2026-04-28T00:00:00.000Z",
  };

  it("returns device, defaultRoom, and enabled rooms for an enabled device", async () => {
    const disabledRoom: RoomRow = { ...room, id: "disabled-room", name: "Quiet Room", is_enabled: 0 };
    const db = new FakeD1Database([room, disabledRoom], [], [], [enabledDevice]);

    const response = await app.request("/api/tablet/ABC123", {}, { DB: db.asD1() });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      device: Record<string, unknown>;
      defaultRoom: { id: string } | null;
      rooms: Array<{ id: string; isEnabled: boolean }>;
    };
    expect(body.device).toEqual({
      deviceCode: "ABC123",
      name: "Lobby Tablet",
      defaultRoomId: "room-1",
      isEnabled: true,
    });
    expect(body.device).not.toHaveProperty("id");
    expect(body.device).not.toHaveProperty("createdAt");
    expect(body.device).not.toHaveProperty("updatedAt");
    expect(body.device).not.toHaveProperty("lastSeenAt");
    expect(body.defaultRoom).toMatchObject({ id: "room-1" });
    expect(body.rooms.map((candidate) => candidate.id)).toEqual(["room-1"]);
  });

  it("returns null defaultRoom when device has no default room", async () => {
    const db = new FakeD1Database(
      [room],
      [],
      [],
      [{ ...enabledDevice, default_room_id: null }],
    );

    const response = await app.request("/api/tablet/ABC123", {}, { DB: db.asD1() });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { defaultRoom: unknown };
    expect(body.defaultRoom).toBeNull();
  });

  it("returns 404 device_not_found when device is unknown", async () => {
    const db = new FakeD1Database([room], [], [], []);

    const response = await app.request("/api/tablet/UNKNOWN", {}, { DB: db.asD1() });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "device_not_found" });
  });

  it("returns 404 device_not_found when device is disabled", async () => {
    const db = new FakeD1Database([room], [], [], [{ ...enabledDevice, is_enabled: 0 }]);

    const response = await app.request("/api/tablet/ABC123", {}, { DB: db.asD1() });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "device_not_found" });
  });

  it("updates last_seen_at when receiving a heartbeat", async () => {
    const db = new FakeD1Database([], [], [], [enabledDevice]);

    const response = await app.request(
      "/api/tablet/ABC123/heartbeat",
      { method: "POST" },
      { DB: db.asD1() },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(db.devices[0].last_seen_at).toBe("2026-04-28T05:00:00.000Z");
    expect(db.devices[0].updated_at).toBe("2026-04-28T00:00:00.000Z");
  });

  it("returns 404 device_not_found on heartbeat for unknown device and does not touch last_seen_at", async () => {
    const db = new FakeD1Database([], [], [], [{ ...enabledDevice, last_seen_at: null }]);

    const response = await app.request(
      "/api/tablet/UNKNOWN/heartbeat",
      { method: "POST" },
      { DB: db.asD1() },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "device_not_found" });
    expect(db.devices[0].last_seen_at).toBeNull();
  });

  it("returns 404 device_not_found on heartbeat for disabled device", async () => {
    const db = new FakeD1Database([], [], [], [{ ...enabledDevice, is_enabled: 0, last_seen_at: null }]);

    const response = await app.request(
      "/api/tablet/ABC123/heartbeat",
      { method: "POST" },
      { DB: db.asD1() },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "device_not_found" });
    expect(db.devices[0].last_seen_at).toBeNull();
  });
});
