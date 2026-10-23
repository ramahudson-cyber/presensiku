-- ============================================================
-- MIGRATION: Radius absensi real sesuai pengaturan admin
-- ============================================================
-- Masalah:
--   Radius yang diset admin selalu DITAMBAH toleransi GPS hingga 50 m
--   (LEAST(accuracy, 50)) di match_attendance_location. Contoh: radius
--   50 m + accuracy 50 m → pegawai lolos sampai 100 m (2x radius).
--   Plus, UI membatasi radius minimal 50 m sehingga radius kecil tidak
--   pernah bisa diset. Kombinasinya membuat radius terasa "pajangan".
--
-- Keputusan (disetujui admin):
--   1. TANPA toleransi: jarak > radius_meter = langsung ditolak.
--   2. Radius minimal yang boleh diset admin: 2 meter (constraint DB
--      diperlebar dari 10 m; form UI ikut disesuaikan).
--
-- Yang tidak berubah:
--   - Semua validasi lain (accuracy wajib ada, < 5 m ditolak sebagai
--     fake-GPS, anti fake-GPS, RLS, dsb.) tetap berjalan.
--   - Jika suatu saat toleransi diperlukan lagi, cukup SET value setting
--     'gps_tolerance_meter' > 0 — tidak perlu migrasi baru.
-- ============================================================

-- ----------------------------------------------------------------------------
-- 1. Setting toleransi GPS (default 0 = tanpa toleransi)
-- ----------------------------------------------------------------------------
INSERT INTO system_settings (organization_id, setting_key, value, category)
SELECT o.id, 'gps_tolerance_meter', '0', 'attendance'
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM system_settings s
  WHERE s.organization_id = o.id
    AND s.setting_key = 'gps_tolerance_meter'
);

-- ----------------------------------------------------------------------------
-- 2. Radius minimal 2 m (dari 10 m)
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE attendance_locations DROP CONSTRAINT IF EXISTS attendance_locations_radius_check;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE attendance_locations
    ADD CONSTRAINT attendance_locations_radius_check
    CHECK (radius_meter >= 2 AND radius_meter <= 2000);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 3. Patch match_attendance_location — toleransi dari setting (default 0)
--    Body diambil dari katalog, SATU fragmen diganti. Bila fragmen tidak
--    ditemukan, migrasi gagal (tidak pernah diam-diam).
-- ----------------------------------------------------------------------------
DO $patch_tolerance$
DECLARE
  v_def TEXT;
  v_old TEXT := 'v_tolerance        DOUBLE PRECISION := LEAST(COALESCE(p_accuracy, 0), 50);';
  v_new TEXT := 'v_tolerance        DOUBLE PRECISION := LEAST(COALESCE(p_accuracy, 0), COALESCE(NULLIF(attendance_setting(''gps_tolerance_meter'', ''0''), '''')::double precision, 0));';
BEGIN
  v_def := pg_get_functiondef('public.match_attendance_location(double precision, double precision, double precision)'::regprocedure);

  IF position('gps_tolerance_meter' IN v_def) > 0 THEN
    RAISE NOTICE 'match_attendance_location sudah memakai setting toleransi — dilewati';
    RETURN;
  END IF;
  IF position(v_old IN v_def) = 0 THEN
    RAISE EXCEPTION 'Fragmen toleransi tidak ditemukan. Patch dibatalkan.';
  END IF;

  v_def := replace(v_def, v_old, v_new);
  EXECUTE v_def;
  RAISE NOTICE 'match_attendance_location: toleransi GPS mengikuti setting (default 0)';
END;
$patch_tolerance$;

NOTIFY pgrst, 'reload schema';

-- ----------------------------------------------------------------------------
-- 3b. Constraint legacy yang terlewat: attendance_locations_radius_range
--     (nama constraint asli dari tabel awal) — dua CHECK radius aktif
--     membuat radius < 10 m tetap ditolak meski constraint baru sudah 2 m.
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE attendance_locations DROP CONSTRAINT IF EXISTS attendance_locations_radius_range;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
