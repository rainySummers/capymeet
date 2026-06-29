import type { Booking, BookingSource, BookingStatus } from "../../shared/types";
import { nowIso } from "../db";

interface BookingRow {
  id: string;
  room_id: string;
  title: string;
  contact_name: string;
  phone: string;
  email: string | null;
  start_time: string;
  end_time: string;
  status: BookingStatus;
  source: BookingSource;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
  cancelled_by: string | null;
  reviewed_by_admin_id: string | null;
  reviewed_at: string | null;
}

interface AdminBookingRow extends BookingRow {
  room_name: string | null;
  room_location: string | null;
}

export interface AdminBooking extends Booking {
  roomName: string | null;
  roomLocation: string | null;
}

export interface AdminBookingFilters {
  status?: BookingStatus;
  roomId?: string;
  startTime?: string;
  endTime?: string;
}

function mapBooking(row: BookingRow): Booking {
  return {
    id: row.id,
    roomId: row.room_id,
    title: row.title,
    contactName: row.contact_name,
    email: row.email,
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    cancelledAt: row.cancelled_at,
    cancelledBy: row.cancelled_by,
    reviewedByAdminId: row.reviewed_by_admin_id,
    reviewedAt: row.reviewed_at,
  };
}

function mapAdminBooking(row: AdminBookingRow): AdminBooking {
  return {
    ...mapBooking(row),
    roomName: row.room_name,
    roomLocation: row.room_location,
  };
}

export async function listAdminBookings(
  db: D1Database,
  filters: AdminBookingFilters = {},
): Promise<AdminBooking[]> {
  const clauses: string[] = [];
  const binds: string[] = [];

  if (filters.status) {
    clauses.push("b.status = ?");
    binds.push(filters.status);
  }
  if (filters.roomId) {
    clauses.push("b.room_id = ?");
    binds.push(filters.roomId);
  }
  if (filters.startTime) {
    clauses.push("b.end_time > ?");
    binds.push(filters.startTime);
  }
  if (filters.endTime) {
    clauses.push("b.start_time < ?");
    binds.push(filters.endTime);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const result = await db
    .prepare(
      `SELECT b.*, r.name AS room_name, r.location AS room_location
       FROM bookings b
       LEFT JOIN rooms r ON r.id = b.room_id
       ${where}
       ORDER BY b.start_time DESC`,
    )
    .bind(...binds)
    .all<AdminBookingRow>();

  return result.results.map(mapAdminBooking);
}

export async function listBlockingBookings(
  db: D1Database,
  roomId: string,
  startTime: string,
  endTime: string,
): Promise<Booking[]> {
  const result = await db.prepare(
    `SELECT * FROM bookings
     WHERE room_id = ?
       AND status IN ('confirmed', 'pending_approval')
       AND start_time < ?
       AND end_time > ?
     ORDER BY start_time`,
  )
    .bind(roomId, endTime, startTime)
    .all<BookingRow>();
  return result.results.map(mapBooking);
}

export async function listActiveBookingsForRoomRange(
  db: D1Database,
  roomId: string,
  startTime: string,
  endTime: string,
): Promise<Booking[]> {
  const result = await db.prepare(
    `SELECT * FROM bookings
     WHERE room_id = ?
       AND status IN ('confirmed', 'pending_approval')
       AND start_time < ?
       AND end_time > ?
     ORDER BY start_time`,
  )
    .bind(roomId, endTime, startTime)
    .all<BookingRow>();
  return result.results.map(mapBooking);
}

export async function insertBooking(db: D1Database, booking: Booking): Promise<void> {
  await db.prepare(
    `INSERT INTO bookings (id, room_id, title, contact_name, phone, email, start_time, end_time, status, source, created_at, updated_at, cancelled_at, cancelled_by, reviewed_by_admin_id, reviewed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      booking.id,
      booking.roomId,
      booking.title,
      booking.contactName,
      "",
      booking.email,
      booking.startTime,
      booking.endTime,
      booking.status,
      booking.source,
      booking.createdAt,
      booking.updatedAt,
      booking.cancelledAt,
      booking.cancelledBy,
      booking.reviewedByAdminId,
      booking.reviewedAt,
    )
    .run();
}

export async function insertBookingIfNoConflict(
  db: D1Database,
  booking: Booking,
  conflictStartTime = booking.startTime,
  conflictEndTime = booking.endTime,
): Promise<boolean> {
  const result = await db.prepare(
    `INSERT INTO bookings (id, room_id, title, contact_name, phone, email, start_time, end_time, status, source, created_at, updated_at, cancelled_at, cancelled_by, reviewed_by_admin_id, reviewed_at)
     SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
     WHERE NOT EXISTS (
       SELECT 1 FROM bookings
       WHERE room_id = ?
         AND status IN ('confirmed', 'pending_approval')
         AND start_time < ?
         AND end_time > ?
     )`,
  )
    .bind(
      booking.id,
      booking.roomId,
      booking.title,
      booking.contactName,
      "",
      booking.email,
      booking.startTime,
      booking.endTime,
      booking.status,
      booking.source,
      booking.createdAt,
      booking.updatedAt,
      booking.cancelledAt,
      booking.cancelledBy,
      booking.reviewedByAdminId,
      booking.reviewedAt,
      booking.roomId,
      conflictEndTime,
      conflictStartTime,
    )
    .run();

  return result.meta.changes > 0;
}

export async function getBookingById(db: D1Database, id: string): Promise<Booking | null> {
  const row = await db.prepare("SELECT * FROM bookings WHERE id = ?").bind(id).first<BookingRow>();
  return row ? mapBooking(row) : null;
}

export async function getAdminBookingById(db: D1Database, id: string): Promise<AdminBooking | null> {
  const row = await db
    .prepare(
      `SELECT b.*, r.name AS room_name, r.location AS room_location
       FROM bookings b
       LEFT JOIN rooms r ON r.id = b.room_id
       WHERE b.id = ?`,
    )
    .bind(id)
    .first<AdminBookingRow>();
  return row ? mapAdminBooking(row) : null;
}

export async function deleteBookingById(db: D1Database, id: string): Promise<boolean> {
  const result = await db.prepare("DELETE FROM bookings WHERE id = ?").bind(id).run();
  return (result.meta?.changes ?? 0) > 0;
}

export async function createAdminBooking(db: D1Database, input: {
  id: string;
  roomId: string;
  title: string;
  contactName: string;
  email: string | null;
  startTime: string;
  endTime: string;
}): Promise<Booking | null> {
  const now = nowIso();
  const booking: Booking = {
    ...input,
    status: "confirmed",
    source: "admin",
    createdAt: now,
    updatedAt: now,
    cancelledAt: null,
    cancelledBy: null,
    reviewedByAdminId: null,
    reviewedAt: null,
  };

  const inserted = await insertBookingIfNoConflict(db, booking);
  return inserted ? booking : null;
}

export async function cancelBookingById(db: D1Database, id: string, cancelledBy: string, now: string): Promise<void> {
  await db.prepare(
    `UPDATE bookings
     SET status = 'cancelled', cancelled_at = ?, cancelled_by = ?, updated_at = ?
     WHERE id = ?`,
  )
    .bind(now, cancelledBy, now, id)
    .run();
}

export async function cancelActiveBookingById(
  db: D1Database,
  id: string,
  cancelledBy: string,
  now: string,
): Promise<boolean> {
  const result = await db.prepare(
    `UPDATE bookings
     SET status = 'cancelled', cancelled_at = ?, cancelled_by = ?, updated_at = ?
     WHERE id = ?
       AND status IN ('confirmed', 'pending_approval')`,
  )
    .bind(now, cancelledBy, now, id)
    .run();

  return result.meta.changes > 0;
}

export async function approvePendingBooking(
  db: D1Database,
  id: string,
  adminId: string,
  now: string,
): Promise<"approved" | "conflict" | "not_found"> {
  const booking = await getBookingById(db, id);
  if (!booking || booking.status !== "pending_approval") {
    return "not_found";
  }

  const result = await db.prepare(
    `UPDATE bookings
     SET status = 'confirmed', reviewed_by_admin_id = ?, reviewed_at = ?, updated_at = ?
     WHERE id = ?
       AND status = 'pending_approval'
       AND NOT EXISTS (
         SELECT 1 FROM bookings
         WHERE room_id = ?
           AND id != ?
           AND status = 'confirmed'
           AND start_time < ?
           AND end_time > ?
       )`,
  )
    .bind(adminId, now, now, id, booking.roomId, id, booking.endTime, booking.startTime)
    .run();

  return result.meta.changes > 0 ? "approved" : "conflict";
}

export async function rejectPendingBooking(
  db: D1Database,
  id: string,
  adminId: string,
  now: string,
): Promise<boolean> {
  const result = await db.prepare(
    `UPDATE bookings
     SET status = 'rejected', reviewed_by_admin_id = ?, reviewed_at = ?, updated_at = ?
     WHERE id = ?
       AND status = 'pending_approval'`,
  )
    .bind(adminId, now, now, id)
    .run();

  return result.meta.changes > 0;
}
