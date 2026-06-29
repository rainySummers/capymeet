import type { BookingLinkType } from "../../shared/types";
import { boolFromDb, boolToDb, nowIso } from "../db";

export interface BookingLinkRow {
  id: string;
  type: BookingLinkType;
  token: string;
  roomId: string | null;
  roomName: string | null;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface BookingLinkDbRow {
  id: string;
  type: BookingLinkType;
  token: string;
  room_id: string | null;
  room_name: string | null;
  is_enabled: number;
  created_at: string;
  updated_at: string;
}

function mapBookingLink(row: BookingLinkDbRow): BookingLinkRow {
  return {
    id: row.id,
    type: row.type,
    token: row.token,
    roomId: row.room_id,
    roomName: row.room_name,
    isEnabled: boolFromDb(row.is_enabled),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createBookingLink(
  db: D1Database,
  input: { type: BookingLinkType; roomId: string | null; adminId: string },
): Promise<{ id: string; token: string }> {
  const id = crypto.randomUUID();
  const token = crypto.randomUUID().replaceAll("-", "");
  const now = nowIso();

  await db
    .prepare(
      `INSERT INTO booking_links (id, type, token, room_id, is_enabled, created_by_admin_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?, ?)`,
    )
    .bind(id, input.type, token, input.roomId, input.adminId, now, now)
    .run();

  return { id, token };
}

export async function listBookingLinks(db: D1Database): Promise<BookingLinkRow[]> {
  const result = await db
    .prepare(
      `SELECT bl.id, bl.type, bl.token, bl.room_id, r.name AS room_name, bl.is_enabled, bl.created_at, bl.updated_at
       FROM booking_links bl
       LEFT JOIN rooms r ON r.id = bl.room_id
       ORDER BY bl.created_at DESC`,
    )
    .all<BookingLinkDbRow>();

  return result.results.map(mapBookingLink);
}

export async function getEnabledBookingLinkByToken(
  db: D1Database,
  token: string,
): Promise<BookingLinkRow | null> {
  const row = await db
    .prepare(
      `SELECT bl.id, bl.type, bl.token, bl.room_id, r.name AS room_name, bl.is_enabled, bl.created_at, bl.updated_at
       FROM booking_links bl
       LEFT JOIN rooms r ON r.id = bl.room_id
       WHERE bl.token = ?
         AND bl.is_enabled = 1`,
    )
    .bind(token)
    .first<BookingLinkDbRow>();

  return row ? mapBookingLink(row) : null;
}

export async function updateBookingLinkEnabled(
  db: D1Database,
  id: string,
  isEnabled: boolean,
): Promise<BookingLinkRow | null> {
  const now = nowIso();
  const result = await db
    .prepare("UPDATE booking_links SET is_enabled = ?, updated_at = ? WHERE id = ?")
    .bind(boolToDb(isEnabled), now, id)
    .run();

  if ((result.meta?.changes ?? 0) === 0) {
    return null;
  }

  const row = await db
    .prepare(
      `SELECT bl.id, bl.type, bl.token, bl.room_id, r.name AS room_name, bl.is_enabled, bl.created_at, bl.updated_at
       FROM booking_links bl
       LEFT JOIN rooms r ON r.id = bl.room_id
       WHERE bl.id = ?`,
    )
    .bind(id)
    .first<BookingLinkDbRow>();

  return row ? mapBookingLink(row) : null;
}

export async function deleteBookingLink(db: D1Database, id: string): Promise<boolean> {
  const result = await db.prepare("DELETE FROM booking_links WHERE id = ?").bind(id).run();
  return (result.meta?.changes ?? 0) > 0;
}
