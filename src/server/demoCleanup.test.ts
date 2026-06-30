import { describe, expect, it } from "vitest";

import { cleanupDemoDatabase, demoCleanupTables } from "./demoCleanup";

describe("cleanupDemoDatabase", () => {
  it("clears demo data while preserving admins", async () => {
    const statements: string[] = [];
    const db = {
      prepare: (sql: string) => ({
        run: async () => {
          statements.push(sql);
          return { success: true };
        },
      }),
    } as unknown as D1Database;

    await cleanupDemoDatabase(db);

    expect(statements).toEqual(demoCleanupTables.map((table) => `DELETE FROM ${table}`));
    expect(statements).not.toContain("DELETE FROM admins");
  });
});
