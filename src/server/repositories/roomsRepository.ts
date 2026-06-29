import type { Room } from "../../shared/types";
import { boolFromDb, boolToDb, nowIso } from "../db";

interface RoomRow {
  id: string;
  name: string;
  location: string;
  capacity: number | null;
  equipment_notes: string | null;
  is_enabled: number;
  opening_hours: string;
  buffer_minutes: number;
  min_duration_minutes: number;
  max_duration_minutes: number;
  max_advance_days: number;
  requires_approval: number;
  created_at: string;
  updated_at: string;
}

function mapRoom(row: RoomRow): Room {
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    capacity: row.capacity,
    equipmentNotes: row.equipment_notes,
    isEnabled: boolFromDb(row.is_enabled),
    openingHours: row.opening_hours,
    bufferMinutes: row.buffer_minutes,
    minDurationMinutes: row.min_duration_minutes,
    maxDurationMinutes: row.max_duration_minutes,
    maxAdvanceDays: row.max_advance_days,
    requiresApproval: boolFromDb(row.requires_approval),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listEnabledRooms(db: D1Database): Promise<Room[]> {
  const result = await db.prepare("SELECT * FROM rooms WHERE is_enabled = 1 ORDER BY name").all<RoomRow>();
  return result.results.map(mapRoom);
}

export async function listAllRooms(db: D1Database): Promise<Room[]> {
  const result = await db.prepare("SELECT * FROM rooms ORDER BY name").all<RoomRow>();
  return result.results.map(mapRoom);
}

export async function getRoomById(db: D1Database, id: string): Promise<Room | null> {
  const row = await db.prepare("SELECT * FROM rooms WHERE id = ?").bind(id).first<RoomRow>();
  return row ? mapRoom(row) : null;
}

export async function createRoom(db: D1Database, room: Omit<Room, "createdAt" | "updatedAt">): Promise<Room> {
  const now = nowIso();
  await db.prepare(
    `INSERT INTO rooms (id, name, location, capacity, equipment_notes, is_enabled, opening_hours, buffer_minutes, min_duration_minutes, max_duration_minutes, max_advance_days, requires_approval, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      room.id,
      room.name,
      room.location,
      room.capacity,
      room.equipmentNotes,
      boolToDb(room.isEnabled),
      room.openingHours,
      room.bufferMinutes,
      room.minDurationMinutes,
      room.maxDurationMinutes,
      room.maxAdvanceDays,
      boolToDb(room.requiresApproval),
      now,
      now,
    )
    .run();

  return { ...room, createdAt: now, updatedAt: now };
}

export async function updateRoom(
  db: D1Database,
  room: Omit<Room, "createdAt" | "updatedAt">,
): Promise<Room | null> {
  const now = nowIso();
  const result = await db.prepare(
    `UPDATE rooms
     SET name = ?, location = ?, capacity = ?, equipment_notes = ?, is_enabled = ?,
         opening_hours = ?, buffer_minutes = ?, min_duration_minutes = ?,
         max_duration_minutes = ?, max_advance_days = ?, requires_approval = ?,
         updated_at = ?
     WHERE id = ?`,
  )
    .bind(
      room.name,
      room.location,
      room.capacity,
      room.equipmentNotes,
      boolToDb(room.isEnabled),
      room.openingHours,
      room.bufferMinutes,
      room.minDurationMinutes,
      room.maxDurationMinutes,
      room.maxAdvanceDays,
      boolToDb(room.requiresApproval),
      now,
      room.id,
    )
    .run();

  if ((result.meta?.changes ?? 0) === 0) {
    return null;
  }

  const updated = await getRoomById(db, room.id);
  return updated;
}

export async function roomHasDependencies(db: D1Database, id: string): Promise<boolean> {
  const booking = await db.prepare("SELECT 1 FROM bookings WHERE room_id = ? LIMIT 1").bind(id).first();
  if (booking) {
    return true;
  }

  const device = await db.prepare("SELECT 1 FROM devices WHERE default_room_id = ? LIMIT 1").bind(id).first();
  if (device) {
    return true;
  }

  const link = await db.prepare("SELECT 1 FROM booking_links WHERE room_id = ? LIMIT 1").bind(id).first();
  return Boolean(link);
}

export async function deleteRoom(db: D1Database, id: string): Promise<"deleted" | "not_found" | "has_dependencies"> {
  if (!(await getRoomById(db, id))) {
    return "not_found";
  }

  if (await roomHasDependencies(db, id)) {
    return "has_dependencies";
  }

  const result = await db.prepare("DELETE FROM rooms WHERE id = ?").bind(id).run();
  return (result.meta?.changes ?? 0) > 0 ? "deleted" : "not_found";
}
