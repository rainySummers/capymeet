import { boolFromDb, boolToDb, nowIso } from "../db";
import { hashPassword } from "../services/authService";

export interface AdminAccount {
  id: string;
  email: string;
  name: string;
  isEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AdminRow {
  id: string;
  email: string;
  name: string;
  is_enabled: number;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapAdmin(row: AdminRow): AdminAccount {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    isEnabled: boolFromDb(row.is_enabled),
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listAdmins(db: D1Database): Promise<AdminAccount[]> {
  const result = await db
    .prepare("SELECT id, email, name, is_enabled, last_login_at, created_at, updated_at FROM admins ORDER BY email")
    .all<AdminRow>();
  return result.results.map(mapAdmin);
}

export async function createAdmin(
  db: D1Database,
  input: { id: string; email: string; name: string; password: string; isEnabled: boolean },
): Promise<AdminAccount> {
  const now = nowIso();
  const passwordHash = await hashPassword(input.password);

  await db
    .prepare(
      `INSERT INTO admins (id, email, name, password_hash, is_enabled, last_login_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`,
    )
    .bind(input.id, input.email, input.name, passwordHash, boolToDb(input.isEnabled), now, now)
    .run();

  return {
    id: input.id,
    email: input.email,
    name: input.name,
    isEnabled: input.isEnabled,
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateAdmin(
  db: D1Database,
  input: { id: string; name: string; password?: string; isEnabled: boolean },
): Promise<AdminAccount | null> {
  const now = nowIso();
  const passwordHash = input.password ? await hashPassword(input.password) : null;
  const result = passwordHash
    ? await db
        .prepare("UPDATE admins SET name = ?, password_hash = ?, is_enabled = ?, updated_at = ? WHERE id = ?")
        .bind(input.name, passwordHash, boolToDb(input.isEnabled), now, input.id)
        .run()
    : await db
        .prepare("UPDATE admins SET name = ?, is_enabled = ?, updated_at = ? WHERE id = ?")
        .bind(input.name, boolToDb(input.isEnabled), now, input.id)
        .run();

  if ((result.meta?.changes ?? 0) === 0) {
    return null;
  }

  const row = await db
    .prepare("SELECT id, email, name, is_enabled, last_login_at, created_at, updated_at FROM admins WHERE id = ?")
    .bind(input.id)
    .first<AdminRow>();

  return row ? mapAdmin(row) : null;
}
