CREATE TABLE email_settings (
  id TEXT PRIMARY KEY CHECK (id = 'default'),
  sender_email TEXT NOT NULL,
  reply_instructions TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by_admin_id TEXT REFERENCES admins(id)
);
