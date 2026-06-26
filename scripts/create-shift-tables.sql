-- ============================================================
-- SETUP SHIFT SYSTEM
-- ============================================================

-- 1. Hapus jadwal lama, insert ulang
DELETE FROM shift_schedules;

-- Shift Pagi (PG)
INSERT INTO shift_schedules (shift_code, day_of_week, start_time, end_time, latest_check_in, is_working_day, crosses_midnight) VALUES
  ('PG', 0, '07:30', '14:00', '07:35', true, false),
  ('PG', 1, '07:30', '14:00', '07:35', true, false),
  ('PG', 2, '07:30', '14:00', '07:35', true, false),
  ('PG', 3, '07:30', '14:00', '07:35', true, false),
  ('PG', 4, '07:30', '11:00', '07:35', true, false),
  ('PG', 5, '07:30', '12:30', '07:35', true, false),
  ('PG', 6, '00:00', '00:00', '00:00', false, false);

-- Shift Sore (SR)
INSERT INTO shift_schedules (shift_code, day_of_week, start_time, end_time, latest_check_in, is_working_day, crosses_midnight) VALUES
  ('SR', 0, '14:00', '16:30', '14:05', true, false),
  ('SR', 1, '14:00', '16:30', '14:05', true, false),
  ('SR', 2, '14:00', '16:30', '14:05', true, false),
  ('SR', 3, '14:00', '16:30', '14:05', true, false),
  ('SR', 4, '00:00', '00:00', '00:00', false, false),
  ('SR', 5, '00:00', '00:00', '00:00', false, false),
  ('SR', 6, '00:00', '00:00', '00:00', false, false);

-- Shift Siang (SI)
INSERT INTO shift_schedules (shift_code, day_of_week, start_time, end_time, latest_check_in, is_working_day, crosses_midnight) VALUES
  ('SI', 0, '14:00', '20:00', '14:05', true, false),
  ('SI', 1, '14:00', '20:00', '14:05', true, false),
  ('SI', 2, '14:00', '20:00', '14:05', true, false),
  ('SI', 3, '14:00', '20:00', '14:05', true, false),
  ('SI', 4, '11:00', '20:00', '11:05', true, false),
  ('SI', 5, '12:30', '20:00', '12:35', true, false),
  ('SI', 6, '00:00', '00:00', '00:00', false, false);

-- Shift Malam (ML)
INSERT INTO shift_schedules (shift_code, day_of_week, start_time, end_time, latest_check_in, is_working_day, crosses_midnight) VALUES
  ('ML', 0, '20:00', '07:00', '20:05', true, true),
  ('ML', 1, '20:00', '07:00', '20:05', true, true),
  ('ML', 2, '20:00', '07:00', '20:05', true, true),
  ('ML', 3, '20:00', '07:00', '20:05', true, true),
  ('ML', 4, '20:00', '07:00', '20:05', true, true),
  ('ML', 5, '20:00', '07:00', '20:05', true, true),
  ('ML', 6, '20:00', '07:00', '20:05', true, true);

-- 2. Buat employee_schedules jika belum ada
CREATE TABLE IF NOT EXISTS employee_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  shift_code TEXT NOT NULL REFERENCES shifts(code),
  is_manual_override BOOLEAN NOT NULL DEFAULT FALSE,
  override_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, date)
);

-- 3. Tambah kolom ke attendance
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS schedule_match BOOLEAN DEFAULT TRUE;
