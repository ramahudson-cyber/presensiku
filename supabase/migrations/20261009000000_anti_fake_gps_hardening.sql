-- ============================================================
-- MIGRATION: Anti Fake-GPS Hardening (berlapis)
-- ============================================================
-- Latar belakang audit:
--   Server SUDAH menolak absen di luar radius lewat trigger
--   guard_attendance_self_write -> assert_within_radius -> match_attendance_location.
--   Yang bocor adalah KEASLIAN koordinat:
--     1. Deteksi mock 100% di client & fail-open (plugin error => isMock false).
--     2. Server hanya cek radius + accuracy < 5; fake GPS di dalam radius lolos.
--     3. Android web/PWA tidak punya deteksi sama sekali.
--     4. Tidak ada attestation (Play Integrity) & device binding tidak ditegakkan.
--
-- Migration ini bersifat ADITIF (tidak menghapus kolom/tabel) dan
-- backward-compatible: payload lama tanpa field baru tetap diproses.
-- Semua kebijakan ketat di-gate lewat system_settings (default OFF) supaya
-- tidak mengunci pegawai di tengah migrasi APK.
--
-- Setting yang dibaca (via system_settings, per-instansi):
--   attendance_require_android_native  'true'/'false'  (default false)
--   attendance_require_device_binding  'true'/'false'  (default false)
--   attendance_require_integrity       'true'/'false'  (default false)
--   attendance_min_app_version_code    angka           (default 0 = bebas)
--   attendance_max_speed_kmh           angka           (default 150)
--   attendance_mock_action             'reject'|'flag' (default 'reject')
-- ============================================================

-- ----------------------------------------------------------------------------
-- 1. Kolom sinyal integritas pada tabel attendance (nullable, aman)
-- ----------------------------------------------------------------------------
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS client_integrity   JSONB,
  ADD COLUMN IF NOT EXISTS integrity_verdict  TEXT,
  ADD COLUMN IF NOT EXISTS mock_flag          BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.attendance.client_integrity IS
  'Sinyal integritas dari perangkat: {mock_detected, mock_apps[], emulator, rooted, runtime, app_version_code, platform}';
COMMENT ON COLUMN public.attendance.integrity_verdict IS
  'Hasil verifikasi Play Integrity (MEETS_DEVICE_INTEGRITY dsb.) atau NULL bila belum diverifikasi';
COMMENT ON COLUMN public.attendance.mock_flag IS
  'true bila absensi ditandai memakai lokasi palsu/mencurigakan';

CREATE INDEX IF NOT EXISTS idx_attendance_mock_flag
  ON public.attendance(mock_flag) WHERE mock_flag = true;

-- ----------------------------------------------------------------------------
-- 1a. Helper safe-cast JSONB -> tipe. Dipakai helper lain di bawah, jadi harus
--     didefinisikan lebih dulu. Payload cacat => NULL (dianggap bukan sinyal),
--     bukan error cast yang membingungkan.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.safe_bool(p JSONB)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p IS NULL OR jsonb_typeof(p) <> 'boolean' THEN NULL
    ELSE (p #>> '{}')::boolean
  END;
$$;

CREATE OR REPLACE FUNCTION public.safe_int(p JSONB)
RETURNS INT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p IS NULL THEN NULL
    WHEN jsonb_typeof(p) = 'number' THEN (p #>> '{}')::numeric::int
    WHEN jsonb_typeof(p) = 'string' AND (p #>> '{}') ~ '^-?[0-9]+$' THEN (p #>> '{}')::int
    ELSE NULL
  END;
$$;

-- ----------------------------------------------------------------------------
-- 1b. Tabel event keamanan absensi.
--     PENTING: penolakan absen memakai RAISE EXCEPTION yang me-rollback seluruh
--     transaksi. Karena itu percobaan yang DITOLAK tidak bisa dicatat lewat
--     log_audit biasa (ikut ter-rollback). Tabel ini diisi lewat RPC tersendiri
--     dengan autonomous-ish flow di sisi client/app (atau oleh Edge Function),
--     sehingga jejak percobaan fake GPS tetap tersimpan.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_security_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  organization_id UUID,
  event_type      TEXT NOT NULL,          -- MOCK_REJECTED | MOCK_FLAGGED | BINDING_REJECTED | VELOCITY_FLAGGED
  severity        TEXT NOT NULL DEFAULT 'warning', -- info | warning | critical
  violations      TEXT[],                 -- daftar pelanggaran
  signal          JSONB,                  -- sinyal integritas mentah
  latitude        DOUBLE PRECISION,
  longitude       DOUBLE PRECISION,
  accuracy        DOUBLE PRECISION,
  device_visitor_id TEXT,
  app_version_code INT,
  runtime         TEXT,
  platform        TEXT,
  ip_hint         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attendance_sec_events_user ON public.attendance_security_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_sec_events_org  ON public.attendance_security_events(organization_id, created_at DESC);

ALTER TABLE public.attendance_security_events ENABLE ROW LEVEL SECURITY;

-- Hanya admin instansi & platform admin yang boleh membaca.
DROP POLICY IF EXISTS attendance_sec_events_read ON public.attendance_security_events;
CREATE POLICY attendance_sec_events_read
  ON public.attendance_security_events FOR SELECT
  TO authenticated
  USING (
    is_platform_admin()
    OR (is_org_admin() AND (organization_id IS NULL OR organization_id = current_org_id()))
    OR user_id = auth.uid()
  );

-- Tidak ada policy INSERT untuk authenticated: penulisan HANYA lewat RPC
-- SECURITY DEFINER di bawah (mencegah pemalsuan/penghapusan dari client).

CREATE OR REPLACE FUNCTION public.log_attendance_security_event(
  p_event_type TEXT,
  p_severity   TEXT DEFAULT 'warning',
  p_loc        JSONB DEFAULT NULL,
  p_violations TEXT[] DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_id  UUID;
  v_sig JSONB;
BEGIN
  v_sig := CASE WHEN p_loc IS NULL THEN NULL
                ELSE p_loc - 'latitude' - 'longitude' END;

  INSERT INTO attendance_security_events (
    user_id, organization_id, event_type, severity, violations, signal,
    latitude, longitude, accuracy, device_visitor_id, app_version_code,
    runtime, platform
  ) VALUES (
    auth.uid(),
    current_org_id(),
    p_event_type,
    COALESCE(p_severity, 'warning'),
    p_violations,
    v_sig,
    NULLIF(p_loc->>'latitude', '')::double precision,
    NULLIF(p_loc->>'longitude', '')::double precision,
    NULLIF(p_loc->>'accuracy', '')::double precision,
    p_loc->>'device_visitor_id',
    safe_int(p_loc->'app_version_code'),
    p_loc->>'runtime',
    p_loc->>'platform'
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_attendance_security_event(text, text, jsonb, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_attendance_security_event(text, text, jsonb, text[]) TO authenticated, service_role;

GRANT SELECT ON public.attendance_security_events TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. Helper: baca setting instansi secara aman (tanpa error bila absen).
--    Fallback ke p_default bila baris setting tidak ada.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.attendance_setting(p_key TEXT, p_default TEXT DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v TEXT;
BEGIN
  SELECT value INTO v FROM system_settings
  WHERE organization_id = current_org_id() AND setting_key = p_key
  LIMIT 1;
  RETURN COALESCE(v, p_default);
END;
$$;

REVOKE ALL ON FUNCTION public.attendance_setting(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.attendance_setting(text, text) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. Helper: ekstraksi sinyal integritas dari payload lokasi (JSONB).
--    Mengembalikan baris: mock_detected, mock_apps, emulator, rooted,
--    runtime, app_version_code, platform, integrity_verdict.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.parse_client_integrity(p_loc JSONB)
RETURNS TABLE (
  mock_detected     BOOLEAN,
  mock_apps         TEXT,
  emulator          BOOLEAN,
  rooted            BOOLEAN,
  runtime           TEXT,
  app_version_code  INT,
  platform          TEXT,
  integrity_verdict TEXT
)
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    COALESCE(
      safe_bool(p_loc->'mock_detected'),
      safe_bool(p_loc->'client_integrity'->'mock_detected'),
      false
    ) AS mock_detected,
    COALESCE(
      NULLIF(p_loc->'client_integrity'->>'mock_apps', ''),
      NULLIF(p_loc->>'mock_apps', '')
    ) AS mock_apps,
    COALESCE(safe_bool(p_loc->'client_integrity'->'emulator'), false) AS emulator,
    COALESCE(safe_bool(p_loc->'client_integrity'->'rooted'), false)   AS rooted,
    COALESCE(p_loc->>'runtime', p_loc->'client_integrity'->>'runtime') AS runtime,
    COALESCE(safe_int(p_loc->'app_version_code'),
             safe_int(p_loc->'client_integrity'->'app_version_code'))  AS app_version_code,
    COALESCE(p_loc->>'platform', p_loc->'client_integrity'->>'platform') AS platform,
    p_loc->>'integrity_verdict' AS integrity_verdict;
$$;

-- ----------------------------------------------------------------------------
-- 4. Helper: enforcement integritas. Melempar exception bila kebijakan
--    dilanggar & action='reject'; mengembalikan violation bila 'flag'.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assert_client_integrity(
  p_user_id UUID,
  p_loc     JSONB,
  p_kind    TEXT DEFAULT 'in'  -- 'in' | 'out'
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v RECORD;
  v_action        TEXT := COALESCE(attendance_setting('attendance_mock_action', 'reject'), 'reject');
  v_req_native    BOOLEAN := COALESCE(attendance_setting('attendance_require_android_native', 'false'), 'false') = 'true';
  v_req_binding   BOOLEAN := COALESCE(attendance_setting('attendance_require_device_binding', 'false'), 'false') = 'true';
  v_req_integrity BOOLEAN := COALESCE(attendance_setting('attendance_require_integrity', 'false'), 'false') = 'true';
  v_min_version   INT     := COALESCE(NULLIF(regexp_replace(COALESCE(attendance_setting('attendance_min_app_version_code', '0'), '0'), '[^0-9]', '', 'g'), '')::int, 0);
  v_visitor       TEXT := p_loc->>'device_visitor_id';
  v_binding_ok    BOOLEAN;
  v_violations    TEXT[] := ARRAY[]::TEXT[];
  v_signal        JSONB;
BEGIN
  IF p_loc IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'violations', '[]'::jsonb);
  END IF;

  SELECT * INTO v FROM parse_client_integrity(p_loc);

  -- (a) mock location terdeteksi
  IF v.mock_detected THEN
    v_violations := array_append(v_violations, 'mock_location');
  END IF;

  -- (b) emulator: pelanggaran keras (fake GPS paling mudah di emulator),
  --     selalu ditolak saat action='reject'. Root hanya ditandai.
  IF v.emulator THEN v_violations := array_append(v_violations, 'emulator'); END IF;
  IF v.rooted   THEN v_violations := array_append(v_violations, 'rooted');   END IF;

  -- (c) Android wajib native (APK), bukan web/PWA
  IF v_req_native AND COALESCE(v.platform, '') = 'android'
     AND COALESCE(v.runtime, '') <> 'native' THEN
    v_violations := array_append(v_violations, 'android_not_native');
  END IF;

  -- (d) versi APK minimal
  IF v_min_version > 0 AND COALESCE(v.app_version_code, 0) < v_min_version
     AND COALESCE(v.runtime, '') = 'native' THEN
    v_violations := array_append(v_violations, 'app_version_too_old');
  END IF;

  -- (e) Play Integrity
  IF v_req_integrity THEN
    IF v.integrity_verdict IS NULL OR v.integrity_verdict <> 'MEETS_DEVICE_INTEGRITY' THEN
      v_violations := array_append(v_violations, 'integrity_failed');
    END IF;
  END IF;

  -- (f) device binding: visitor_id harus ada di user_devices aktif & trusted.
  --     Dilewati bila Android-web sudah ditolak (pesan lebih informatif).
  IF v_req_binding AND NOT ('android_not_native' = ANY(v_violations)) THEN
    SELECT EXISTS (
      SELECT 1 FROM user_devices d
      WHERE d.user_id = p_user_id
        AND d.visitor_id = v_visitor
        AND d.is_active = true
        AND d.is_trusted = true
    ) INTO v_binding_ok;
    IF v_visitor IS NULL OR NOT v_binding_ok THEN
      v_violations := array_append(v_violations, 'device_not_bound');
    END IF;
  END IF;

  v_signal := jsonb_build_object(
    'mock_detected', v.mock_detected,
    'mock_apps', v.mock_apps,
    'emulator', v.emulator,
    'rooted', v.rooted,
    'runtime', v.runtime,
    'app_version_code', v.app_version_code,
    'platform', v.platform,
    'integrity_verdict', v.integrity_verdict,
    'violations', to_jsonb(v_violations)
  );

  -- Mock/fake GPS & emulator = pelanggaran keras: default DITOLAK.
  IF (v.mock_detected OR v.emulator) AND v_action = 'reject' THEN
    IF v.emulator THEN
      RAISE EXCEPTION 'Absensi dari emulator ditolak. Gunakan perangkat HP asli.';
    END IF;
    RAISE EXCEPTION 'Terdeteksi lokasi palsu (fake GPS). Absensi ditolak.';
  END IF;

  -- Kebijakan keras lain (native/integrity/binding) juga menolak bila reject.
  IF array_length(v_violations, 1) > 0 AND v_action = 'reject'
     AND (v_req_native OR v_req_integrity OR v_req_binding) THEN
    RAISE EXCEPTION 'Absensi ditolak: %', array_to_string(v_violations, ', ');
  END IF;

  RETURN jsonb_build_object('ok', array_length(v_violations, 1) IS NULL,
                            'violations', to_jsonb(v_violations),
                            'signal', v_signal);
END;
$$;

REVOKE ALL ON FUNCTION public.assert_client_integrity(uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_client_integrity(uuid, jsonb, text) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5. Helper: velocity / teleport check antar absensi user.
--    Membandingkan koordinat & waktu baris absensi terakhir user dengan
--    koordinat baru; kecepatan tersirat > ambang => curiga.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_attendance_velocity(
  p_user_id  UUID,
  p_lat      DOUBLE PRECISION,
  p_lon      DOUBLE PRECISION,
  p_at       TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_prev_lat DOUBLE PRECISION;
  v_prev_lon DOUBLE PRECISION;
  v_prev_at  TIMESTAMPTZ;
  v_max_kmh  DOUBLE PRECISION := COALESCE(NULLIF(regexp_replace(COALESCE(attendance_setting('attendance_max_speed_kmh','150'), '150'), '[^0-9.]', '', 'g'), '')::double precision, 150);
  v_dist_m   DOUBLE PRECISION;
  v_secs     DOUBLE PRECISION;
  v_kmh      DOUBLE PRECISION;
BEGIN
  IF p_lat IS NULL OR p_lon IS NULL OR p_at IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'speed_kmh', NULL);
  END IF;

  SELECT (a.location_in->>'latitude')::double precision,
         (a.location_in->>'longitude')::double precision,
         a.clock_in_time
    INTO v_prev_lat, v_prev_lon, v_prev_at
  FROM attendance a
  WHERE a.user_id = p_user_id
    AND a.location_in IS NOT NULL
  ORDER BY COALESCE(a.clock_out_time, a.clock_in_time) DESC NULLS LAST
  LIMIT 1;

  IF v_prev_lat IS NULL OR v_prev_lon IS NULL OR v_prev_at IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'speed_kmh', NULL);
  END IF;

  v_dist_m := geo_distance_m(v_prev_lat, v_prev_lon, p_lat, p_lon);
  v_secs   := ABS(EXTRACT(EPOCH FROM (p_at - v_prev_at)));
  -- Abaikan bila jarak waktu terlalu dekat (<30 detik, kemungkinan absen ulang).
  IF v_secs < 30 THEN
    RETURN jsonb_build_object('ok', true, 'speed_kmh', NULL);
  END IF;
  v_kmh := (v_dist_m / v_secs) * 3.6;

  RETURN jsonb_build_object(
    'ok', v_kmh <= v_max_kmh,
    'speed_kmh', round(v_kmh::numeric, 1),
    'max_kmh', v_max_kmh,
    'distance_m', round(v_dist_m::numeric)::int
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_attendance_velocity(uuid, double precision, double precision, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_attendance_velocity(uuid, double precision, double precision, timestamptz) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 6. Integrasikan enforcement ke assert_within_radius.
--    assert_within_radius dipanggil oleh trigger guard untuk location_in &
--    location_out. Kita perkuat: setelah radius lolos, jalankan enforcement
--    integritas. (user_id diambil dari payload; trigger tetap otoritas akhir.)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assert_within_radius(p_loc JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_lat DOUBLE PRECISION;
  v_lon DOUBLE PRECISION;
  v_acc DOUBLE PRECISION;
  v_match JSONB;
  v_valid BOOLEAN;
  v_error TEXT;
  v_integrity JSONB;
  v_uid UUID := auth.uid();
BEGIN
  IF p_loc IS NULL THEN
    RAISE EXCEPTION 'Lokasi wajib dikirim saat absen';
  END IF;

  v_lat := (p_loc->>'latitude')::double precision;
  v_lon := (p_loc->>'longitude')::double precision;
  v_acc := (p_loc->>'accuracy')::double precision;

  IF v_lat IS NULL OR v_lon IS NULL THEN
    RAISE EXCEPTION 'Lokasi wajib dikirim saat absen';
  END IF;

  -- (A) Radius (perilaku lama, tidak diubah).
  v_match := match_attendance_location(v_lat, v_lon, v_acc);
  v_valid := COALESCE((v_match->>'valid')::boolean, false);
  v_error := COALESCE(v_match->>'error', 'Lokasi berada di luar radius absensi');

  IF NOT v_valid THEN
    RAISE EXCEPTION '%', v_error;
  END IF;

  -- (B) Integritas perangkat/lokasi (baru). Bila user_id tersedia.
  IF v_uid IS NOT NULL THEN
    v_integrity := assert_client_integrity(v_uid, p_loc, 'in');
    -- Tandai bila ada pelanggaran namun action='flag' (tidak melempar).
    IF COALESCE((v_integrity->>'ok')::boolean, true) = false THEN
      p_loc := p_loc || jsonb_build_object('integrity_violations', v_integrity->'violations');
    END IF;
  END IF;

  RETURN p_loc || jsonb_strip_nulls(jsonb_build_object(
    'distance_from_puskesmas', (v_match->>'distance')::INT,
    'distance_from_location', (v_match->>'distance')::INT,
    'matched_location_id', v_match->'location_id',
    'matched_location_name', v_match->'location_name',
    'matched_location_radius', v_match->'radius',
    'matched_location_latitude', v_match->'location_latitude',
    'matched_location_longitude', v_match->'location_longitude'
  ));
END;
$$;

REVOKE ALL ON FUNCTION public.assert_within_radius(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_within_radius(jsonb) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 7. Isi kolom sinyal pada baris attendance setelah trigger selesai.
--    Trigger AFTER (bukan BEFORE) supaya tidak mengganggu guard utama.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.populate_attendance_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_src JSONB;
  v_rec RECORD;
  v_vel JSONB;
BEGIN
  -- Pilih lokasi yang BARU berubah, bukan yang lama. Pada UPDATE (checkout),
  -- location_in sudah ada di baris lama sehingga tidak boleh dipakai sebagai
  -- sumber sinyal — gunakan location_out yang baru ditulis.
  IF TG_OP = 'UPDATE' THEN
    IF NEW.location_out IS DISTINCT FROM OLD.location_out AND NEW.location_out IS NOT NULL THEN
      v_src := NEW.location_out;
    ELSIF NEW.location_in IS DISTINCT FROM OLD.location_in AND NEW.location_in IS NOT NULL THEN
      v_src := NEW.location_in;
    END IF;
  ELSE
    v_src := COALESCE(NEW.location_in, NEW.location_out);
  END IF;

  IF v_src IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_rec FROM parse_client_integrity(v_src);

  NEW.client_integrity := jsonb_strip_nulls(jsonb_build_object(
    'mock_detected', v_rec.mock_detected,
    'mock_apps', v_rec.mock_apps,
    'emulator', v_rec.emulator,
    'rooted', v_rec.rooted,
    'runtime', v_rec.runtime,
    'app_version_code', v_rec.app_version_code,
    'platform', v_rec.platform
  ));
  NEW.integrity_verdict := v_rec.integrity_verdict;
  NEW.mock_flag := v_rec.mock_detected
    OR v_rec.emulator
    OR v_src ? 'integrity_violations';

  -- Velocity check hanya untuk check-in. Pakai waktu server (now()), bukan
  -- clock_in_time dari client yang belum dipaksakan oleh guard trigger.
  IF TG_OP = 'INSERT' AND NEW.location_in IS NOT NULL THEN
    v_vel := check_attendance_velocity(
      NEW.user_id,
      (NEW.location_in->>'latitude')::double precision,
      (NEW.location_in->>'longitude')::double precision,
      now()
    );
    IF COALESCE((v_vel->>'ok')::boolean, true) = false THEN
      NEW.mock_flag := true;
    END IF;
    NEW.client_integrity := NEW.client_integrity
      || jsonb_build_object('velocity', v_vel);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS attendance_populate_integrity ON public.attendance;
CREATE TRIGGER attendance_populate_integrity
  BEFORE INSERT OR UPDATE
  ON public.attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.populate_attendance_integrity();

-- ----------------------------------------------------------------------------
-- 8. Catat penolakan mock ke audit log lewat RPC verify (best-effort).
--    (Fungsi log_audit sudah ada di skema inti.)
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 9. Seed setting default (per instansi) — semua OFF kecuali mock action.
-- ----------------------------------------------------------------------------
INSERT INTO system_settings (organization_id, setting_key, value, category, updated_at)
SELECT o.id, s.k, s.v, 'attendance_security', NOW()
FROM organizations o
CROSS JOIN (VALUES
  ('attendance_require_android_native', 'false'),
  ('attendance_require_device_binding', 'false'),
  ('attendance_require_integrity',      'false'),
  ('attendance_min_app_version_code',   '0'),
  ('attendance_max_speed_kmh',          '150'),
  ('attendance_mock_action',            'reject')
) AS s(k, v)
ON CONFLICT (organization_id, setting_key) DO NOTHING;
