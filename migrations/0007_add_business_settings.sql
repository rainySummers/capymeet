CREATE TABLE business_settings (
  id TEXT PRIMARY KEY CHECK (id = 'default'),
  business_time_zone TEXT NOT NULL DEFAULT 'Europe/Berlin',
  updated_at TEXT NOT NULL,
  updated_by_admin_id TEXT REFERENCES admins(id)
);

INSERT INTO business_settings (id, business_time_zone, updated_at, updated_by_admin_id)
VALUES ('default', 'Europe/Berlin', CURRENT_TIMESTAMP, NULL);
