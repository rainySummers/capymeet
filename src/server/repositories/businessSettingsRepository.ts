import { BUSINESS_TIME_ZONE, isValidTimeZone } from "../../shared/time";
import { nowIso } from "../db";

interface BusinessSettingsRow {
  business_time_zone: string | null;
}

export interface BusinessSettings {
  businessTimeZone: string;
}

function settingsOrDefault(row: BusinessSettingsRow | null): BusinessSettings {
  const timeZone = row?.business_time_zone ?? BUSINESS_TIME_ZONE;
  return {
    businessTimeZone: isValidTimeZone(timeZone) ? timeZone : BUSINESS_TIME_ZONE,
  };
}

export async function getBusinessSettings(db: D1Database): Promise<BusinessSettings> {
  const row = await db
    .prepare("SELECT business_time_zone FROM business_settings WHERE id = 'default'")
    .first<BusinessSettingsRow>();
  return settingsOrDefault(row);
}

export async function saveBusinessSettings(
  db: D1Database,
  input: BusinessSettings & { adminId: string },
): Promise<BusinessSettings> {
  const updatedAt = nowIso();
  await db
    .prepare(
      `INSERT INTO business_settings (id, business_time_zone, updated_at, updated_by_admin_id)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         business_time_zone = excluded.business_time_zone,
         updated_at = excluded.updated_at,
         updated_by_admin_id = excluded.updated_by_admin_id`,
    )
    .bind("default", input.businessTimeZone, updatedAt, input.adminId)
    .run();

  return { businessTimeZone: input.businessTimeZone };
}
