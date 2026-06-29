import { boolFromDb, boolToDb, nowIso } from "../db";

export interface Device {
  id: string;
  deviceCode: string;
  name: string;
  defaultRoomId: string | null;
  isEnabled: boolean;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DeviceRow {
  id: string;
  device_code: string;
  name: string;
  default_room_id: string | null;
  is_enabled: number;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapDevice(row: DeviceRow): Device {
  return {
    id: row.id,
    deviceCode: row.device_code,
    name: row.name,
    defaultRoomId: row.default_room_id,
    isEnabled: boolFromDb(row.is_enabled),
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getDeviceByCode(db: D1Database, deviceCode: string): Promise<Device | null> {
  const row = await db
    .prepare("SELECT * FROM devices WHERE device_code = ?")
    .bind(deviceCode)
    .first<DeviceRow>();
  return row ? mapDevice(row) : null;
}

export async function listDevices(db: D1Database): Promise<Device[]> {
  const result = await db.prepare("SELECT * FROM devices ORDER BY name").all<DeviceRow>();
  return result.results.map(mapDevice);
}

export async function createDevice(
  db: D1Database,
  input: Omit<Device, "createdAt" | "updatedAt" | "lastSeenAt">,
): Promise<Device> {
  const now = nowIso();
  await db
    .prepare(
      `INSERT INTO devices (id, device_code, name, default_room_id, is_enabled, last_seen_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`,
    )
    .bind(
      input.id,
      input.deviceCode,
      input.name,
      input.defaultRoomId,
      boolToDb(input.isEnabled),
      now,
      now,
    )
    .run();

  return { ...input, lastSeenAt: null, createdAt: now, updatedAt: now };
}

export async function updateDevice(
  db: D1Database,
  input: Omit<Device, "createdAt" | "updatedAt" | "lastSeenAt">,
): Promise<Device | null> {
  const now = nowIso();
  const result = await db
    .prepare(
      `UPDATE devices
       SET device_code = ?, name = ?, default_room_id = ?, is_enabled = ?, updated_at = ?
       WHERE id = ?`,
    )
    .bind(
      input.deviceCode,
      input.name,
      input.defaultRoomId,
      boolToDb(input.isEnabled),
      now,
      input.id,
    )
    .run();

  if ((result.meta?.changes ?? 0) === 0) {
    return null;
  }

  const updated = await getDeviceByCode(db, input.deviceCode);
  return updated;
}

export async function deleteDevice(db: D1Database, id: string): Promise<boolean> {
  const result = await db.prepare("DELETE FROM devices WHERE id = ?").bind(id).run();
  return (result.meta?.changes ?? 0) > 0;
}

export async function updateDeviceHeartbeat(db: D1Database, deviceCode: string): Promise<boolean> {
  const now = nowIso();
  const result = await db
    .prepare("UPDATE devices SET last_seen_at = ? WHERE device_code = ? AND is_enabled = 1")
    .bind(now, deviceCode)
    .run();
  return (result.meta?.changes ?? 0) > 0;
}
