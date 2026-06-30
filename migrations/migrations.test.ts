import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migrationsDir = dirname(fileURLToPath(import.meta.url));

function readMigration(name: string): string {
  return readFileSync(join(migrationsDir, name), "utf8");
}

describe("database migrations", () => {
  it("adds room buffer minutes in a migration after the initial schema", () => {
    const migrationFiles = readdirSync(migrationsDir)
      .filter((file) => /^\d+_.+\.sql$/.test(file))
      .sort();

    const initialMigration = readMigration("0001_initial.sql");
    const followUpMigrations = migrationFiles
      .filter((file) => file !== "0001_initial.sql")
      .map(readMigration)
      .join("\n");

    expect(initialMigration).not.toContain("buffer_minutes");
    expect(followUpMigrations).toContain("ADD COLUMN buffer_minutes");
  });

  it("adds email settings outside the initial schema", () => {
    const migrationFiles = readdirSync(migrationsDir)
      .filter((file) => /^\d+_.+\.sql$/.test(file))
      .sort();

    const initialMigration = readMigration("0001_initial.sql");
    const followUpMigrations = migrationFiles
      .filter((file) => file !== "0001_initial.sql")
      .map(readMigration)
      .join("\n");

    expect(initialMigration).not.toContain("email_settings");
    expect(followUpMigrations).toContain("CREATE TABLE email_settings");
  });

  it("adds business settings outside the initial schema", () => {
    const migrationFiles = readdirSync(migrationsDir)
      .filter((file) => /^\d+_.+\.sql$/.test(file))
      .sort();

    const initialMigration = readMigration("0001_initial.sql");
    const followUpMigrations = migrationFiles
      .filter((file) => file !== "0001_initial.sql")
      .map(readMigration)
      .join("\n");

    expect(initialMigration).not.toContain("business_settings");
    expect(followUpMigrations).toContain("CREATE TABLE business_settings");
  });
});
