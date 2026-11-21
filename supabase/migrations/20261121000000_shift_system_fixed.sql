-- ============================================================
-- SHIFT TETAP: 4 jenis kanonik (PG/SR/SI/ML) + aktif/nonaktif
--
-- Admin instansi tidak lagi membuat kode/nama shift sendiri.
-- Keempat jenis menjadi bawaan sistem (is_system) dan admin hanya
-- menyalakan/mematikan (is_active) serta mengatur jam kerjanya
-- di shift_schedules.
--
-- Data lama dipetakan otomatis: kode legacy (mis. SNG = "siang")
-- dipindahkan ke kode kanonik (SI) di employee_schedules dan
-- shift_schedules, lalu baris legacy dinonaktifkan — riwayat
-- absensi & jadwal lama tetap valid.
-- ============================================================

-- 1) Kolom baru
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

-- 2) Pastikan 4 shift kanonik ada di setiap instansi (idempoten)
INSERT INTO shifts (organization_id, code, name, is_active, is_system)
SELECT o.id, c.code, c.name, true, true
FROM organizations o
CROSS JOIN (VALUES ('PG','Pagi'),('SR','Sore'),('SI','Siang'),('ML','Malam')) AS c(code, name)
WHERE NOT EXISTS (
  SELECT 1 FROM shifts s WHERE s.organization_id = o.id AND s.code = c.code
);

-- 3) Tandai keempat kode kanonik sebagai shift sistem & aktif
UPDATE shifts SET is_system = true, is_active = true
WHERE code IN ('PG','SR','SI','ML');

-- 4a) shift_schedules: pindah definisi hari legacy -> kanonik
--     hanya bila slot kanonik (org + kode + hari) masih kosong,
--     supaya tidak melanggar UNIQUE(organization_id, shift_code, day_of_week)
WITH legacy AS (
  SELECT s.organization_id, s.code AS old_code, m.canon
  FROM shifts s
  JOIN (VALUES ('pagi','PG'),('sore','SR'),('siang','SI'),('malam','ML')) AS m(name_lower, canon)
    ON lower(trim(s.name)) = m.name_lower
  WHERE s.code NOT IN ('PG','SR','SI','ML')
)
UPDATE shift_schedules ss
SET shift_code = legacy.canon
FROM legacy
WHERE ss.organization_id = legacy.organization_id
  AND ss.shift_code = legacy.old_code
  AND NOT EXISTS (
    SELECT 1 FROM shift_schedules x
    WHERE x.organization_id = legacy.organization_id
      AND x.shift_code = legacy.canon
      AND x.day_of_week = ss.day_of_week
  );

-- 4b) employee_schedules: petakan jadwal pegawai legacy -> kanonik
--     bila tidak ada jadwal kanonik pada (user, tanggal) yang sama
WITH legacy AS (
  SELECT s.organization_id, s.code AS old_code, m.canon
  FROM shifts s
  JOIN (VALUES ('pagi','PG'),('sore','SR'),('siang','SI'),('malam','ML')) AS m(name_lower, canon)
    ON lower(trim(s.name)) = m.name_lower
  WHERE s.code NOT IN ('PG','SR','SI','ML')
)
UPDATE employee_schedules es
SET shift_code = legacy.canon
FROM legacy
WHERE es.organization_id = legacy.organization_id
  AND es.shift_code = legacy.old_code
  AND NOT EXISTS (
    SELECT 1 FROM employee_schedules x
    WHERE x.user_id = es.user_id
      AND x.date = es.date
      AND x.shift_code = legacy.canon
  );

-- 5a) Nonaktifkan shift legacy (sudah digantikan kanonik)
UPDATE shifts SET is_active = false
WHERE code NOT IN ('PG','SR','SI','ML');

-- 5b) Nonaktifkan shift kanonik yang belum dipakai instansi
--     (tidak punya definisi jam dan tidak pernah dijadwalkan) —
--     admin bisa menyalakannya kapan pun dari Kelola Shift.
UPDATE shifts s SET is_active = false
WHERE s.is_system = true
  AND NOT EXISTS (
    SELECT 1 FROM shift_schedules ss
    WHERE ss.organization_id = s.organization_id AND ss.shift_code = s.code
  )
  AND NOT EXISTS (
    SELECT 1 FROM employee_schedules es
    WHERE es.organization_id = s.organization_id AND es.shift_code = s.code
  );
