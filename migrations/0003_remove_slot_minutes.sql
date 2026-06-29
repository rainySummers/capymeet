-- D1 supports direct DROP COLUMN; avoid rebuilding rooms because existing bookings/devices/links reference it.
ALTER TABLE rooms DROP COLUMN slot_minutes;
PRAGMA foreign_key_check;
