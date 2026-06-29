ALTER TABLE email_settings ADD COLUMN is_email_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_email_enabled IN (0, 1));
