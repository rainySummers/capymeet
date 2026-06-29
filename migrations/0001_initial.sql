CREATE TABLE rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  capacity INTEGER,
  equipment_notes TEXT,
  is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
  opening_hours TEXT NOT NULL DEFAULT '{"days":[1,2,3,4,5],"start":"09:00","end":"18:00"}',
  slot_minutes INTEGER NOT NULL DEFAULT 30,
  min_duration_minutes INTEGER NOT NULL DEFAULT 30,
  max_duration_minutes INTEGER NOT NULL DEFAULT 240,
  max_advance_days INTEGER NOT NULL DEFAULT 30,
  requires_approval INTEGER NOT NULL DEFAULT 0 CHECK (requires_approval IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE devices (
  id TEXT PRIMARY KEY,
  device_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  default_room_id TEXT REFERENCES rooms(id),
  is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
  last_seen_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE bookings (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id),
  title TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending_approval', 'confirmed', 'cancelled', 'rejected', 'completed')),
  source TEXT NOT NULL CHECK (source IN ('public', 'tablet', 'admin')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  cancelled_at TEXT,
  cancelled_by TEXT,
  reviewed_by_admin_id TEXT,
  reviewed_at TEXT,
  CHECK (end_time > start_time)
);

CREATE INDEX idx_bookings_room_time ON bookings(room_id, start_time, end_time);
CREATE INDEX idx_bookings_phone_status ON bookings(phone, status, start_time);

CREATE TABLE admins (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
  last_login_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE booking_links (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('global', 'room_specific')),
  token TEXT NOT NULL UNIQUE,
  room_id TEXT REFERENCES rooms(id),
  is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
  created_by_admin_id TEXT REFERENCES admins(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (type = 'global' AND room_id IS NULL)
    OR (type = 'room_specific' AND room_id IS NOT NULL)
  )
);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
