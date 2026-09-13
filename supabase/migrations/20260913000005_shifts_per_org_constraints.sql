-- =====================================================================
-- MULTI-TENANT FASE 1D — shifts & shift_schedules per instansi
-- Constraint lama global (UNIQUE(code) / UNIQUE(shift_code, day_of_week))
-- diganti composite per organization_id supaya tiap instansi punya
-- konfigurasi shiftnya sendiri. Jalankan SETELAH migration 1.
-- =====================================================================

-- 1. Lepas FK yang menunjuk shifts(code)
ALTER TABLE employee_schedules DROP CONSTRAINT IF EXISTS employee_schedules_shift_code_fkey;
ALTER TABLE shift_schedules DROP CONSTRAINT IF EXISTS shift_schedules_shift_code_fkey;
-- Tabel legacy 'schedules' (tidak dipakai UI saat ini) juga menunjuk shifts(code)
ALTER TABLE schedules DROP CONSTRAINT IF EXISTS schedules_shift_code_fkey;

-- 2. Ganti unique shifts: code global → (organization_id, code)
ALTER TABLE shifts DROP CONSTRAINT IF EXISTS shifts_code_key;
ALTER TABLE shifts DROP CONSTRAINT IF EXISTS shifts_org_code_key;
ALTER TABLE shifts ADD CONSTRAINT shifts_org_code_key UNIQUE (organization_id, code);

-- 3. Ganti unique shift_schedules: (shift_code, day) → (org, shift_code, day)
ALTER TABLE shift_schedules DROP CONSTRAINT IF EXISTS shift_schedules_shift_code_day_of_week_key;
ALTER TABLE shift_schedules DROP CONSTRAINT IF EXISTS shift_schedules_org_code_day_key;
ALTER TABLE shift_schedules ADD CONSTRAINT shift_schedules_org_code_day_key
  UNIQUE (organization_id, shift_code, day_of_week);

-- 4. Pasang ulang FK composite ke shifts(organization_id, code)
ALTER TABLE shift_schedules ADD CONSTRAINT shift_schedules_shift_code_fkey
  FOREIGN KEY (organization_id, shift_code)
  REFERENCES shifts (organization_id, code) ON DELETE CASCADE;

ALTER TABLE employee_schedules ADD CONSTRAINT employee_schedules_shift_code_fkey
  FOREIGN KEY (organization_id, shift_code)
  REFERENCES shifts (organization_id, code);

-- Tabel legacy schedules: pasang ulang composite (tabel kosong, tidak dipakai UI)
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS organization_id UUID;
UPDATE schedules SET organization_id = (SELECT id FROM organizations LIMIT 1)
WHERE organization_id IS NULL;
ALTER TABLE schedules ADD CONSTRAINT schedules_shift_code_fkey
  FOREIGN KEY (organization_id, shift_code)
  REFERENCES shifts (organization_id, code);
