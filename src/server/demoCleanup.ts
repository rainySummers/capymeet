export const demoCleanupTables = [
  "audit_logs",
  "booking_links",
  "bookings",
  "devices",
  "rooms",
  "email_settings",
  "business_settings",
] as const;

export async function cleanupDemoDatabase(db: D1Database): Promise<void> {
  for (const table of demoCleanupTables) {
    await db.prepare(`DELETE FROM ${table}`).run();
  }
}
