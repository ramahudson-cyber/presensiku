-- =====================================================================
-- HARDENING KEAMANAN & ANTI-FRAUD (hasil audit 2026-09-15)
-- K1 : pegawai tidak bisa promote diri (role/email/username/org) sendiri
-- K2 : absensi direkayasa via client → nilai sensitif dihitung SERVER
-- K3 : kode OTP tidak bisa dibaca pemiliknya dari tabel
-- T1 : user_devices tidak bisa dibongkar-pasang sendiri
-- T4 : validasi radius sadar-tenant + akurasi GPS dibatasi
-- Semua idempotent. SECURITY DEFINER/service role TIDAK kena guard
-- (alur admin, RPC approval, dan sync cuti tetap jalan).
-- =====================================================================

-- ────────────────────────────────────────────────────────────────────
-- 1. K1 — Guard kolom identitas pada profiles
--    Self-update boleh: full_name, avatar_url, dll.
--    Dilarang kecuali platform admin: role, email, username, auth_email,
--    organization_id. Admin instansi boleh mengubah role anggota orgnya
--    (pegawai/kepala_unit) — selaras policy profiles_org_admin_update.
-- ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION guard_profiles_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  -- service_role / job internal: tanpa auth.uid() → bebas
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- platform super_admin bebas
  IF is_platform_admin() THEN
    RETURN NEW;
  END IF;

  -- Kolom yang hanya boleh platform admin: organisasi & email autentikasi
  IF NEW.auth_email  IS DISTINCT FROM OLD.auth_email
     OR NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'Kolom identitas tidak dapat diubah dari sisi aplikasi';
  END IF;

  -- email/username: platform admin bebas; admin instansi boleh mengoreksi
  -- anggota org-nya sendiri (bukan sesama admin ke atas). Self-service: terkunci.
  IF (NEW.email IS DISTINCT FROM OLD.email
      OR NEW.username IS DISTINCT FROM OLD.username) THEN
    IF NOT (
      is_org_admin()
      AND OLD.organization_id = current_org_id()
      AND NEW.organization_id = OLD.organization_id
      AND OLD.id <> auth.uid()
      AND OLD.role NOT IN ('super_admin')
    ) THEN
      RAISE EXCEPTION 'Email/username tidak dapat diubah dari sisi aplikasi';
    END IF;
  END IF;

  -- perubahan role: hanya lewat jalur admin yang sah
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT (
      is_org_admin()
      AND OLD.organization_id = current_org_id()
      AND NEW.organization_id = current_org_id()
      AND OLD.role <> 'super_admin'
      AND NEW.role IN ('pegawai', 'kepala_unit')
    ) THEN
      RAISE EXCEPTION 'Perubahan role tidak diizinkan dari sisi aplikasi';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profiles_identity ON profiles;
CREATE TRIGGER trg_guard_profiles_identity
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION guard_profiles_identity();

-- ────────────────────────────────────────────────────────────────────
-- 2. K3 — OTP: user tidak lagi bisa SELECT baris otp_codes miliknya.
--    Verifikasi tetap via RPC verify_otp_code (SECURITY DEFINER).
-- ────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  DROP POLICY IF EXISTS otp_self_select ON otp_codes;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ────────────────────────────────────────────────────────────────────
-- 3. T1 — user_devices: self hanya boleh MELIHAT daftar device sendiri.
--    Lepas/pasang device adalah wewenang admin (org) / platform.
--    Alur super_admin auto-approve di klien lolos via
--    user_devices_platform_all yang tetap FOR ALL.
-- ────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  DROP POLICY IF EXISTS user_devices_self_all ON user_devices;
  DROP POLICY IF EXISTS user_devices_self_read ON user_devices;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

CREATE POLICY user_devices_self_read ON user_devices FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- ────────────────────────────────────────────────────────────────────
-- 4. K2 — attendance: kebijakan self dipersempit (tanpa DELETE),
--    lalu guard trigger menormalkan/memblokir rekayasa.
--    Admin (platform) & service role bypass; INSERT dari RPC cuti
--    (status izin/sakit) tidak disentuh guard.
-- ────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  DROP POLICY IF EXISTS attendance_self_all ON attendance;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                 AND tablename='attendance' AND policyname='attendance_self_select') THEN
    CREATE POLICY attendance_self_select ON attendance FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                 AND tablename='attendance' AND policyname='attendance_self_insert') THEN
    CREATE POLICY attendance_self_insert ON attendance FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                 AND tablename='attendance' AND policyname='attendance_self_update') THEN
    CREATE POLICY attendance_self_update ON attendance FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Helper jarak Haversine (meter) — dipakai trigger & RPC verifikasi.
CREATE OR REPLACE FUNCTION geo_distance_m(
  p_lat1 DOUBLE PRECISION, p_lon1 DOUBLE PRECISION,
  p_lat2 DOUBLE PRECISION, p_lon2 DOUBLE PRECISION
) RETURNS DOUBLE PRECISION
LANGUAGE sql IMMUTABLE
SET search_path = public, extensions
AS $$
  SELECT 6371000 * 2 * asin(sqrt(
    power(sin(radians(p_lat2 - p_lat1) / 2), 2)
    + cos(radians(p_lat1)) * cos(radians(p_lat2))
    * power(sin(radians(p_lon2 - p_lon1) / 2), 2)
  ));
$$;

-- Lokasi absensi aktif untuk org pemanggil (fallback lokasi warisan NULL).
CREATE OR REPLACE FUNCTION active_attendance_location()
RETURNS attendance_locations
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT * FROM attendance_locations
  WHERE is_active = true
    AND (organization_id = current_org_id() OR organization_id IS NULL)
  ORDER BY organization_id NULLS LAST
  LIMIT 1;
$$;

-- Cek radius server-side; melempar exception bila curiga/di luar radius.
-- Toleransi akurasi GPS dibatasi 30 m supaya tidak bisa diperlebar.
CREATE OR REPLACE FUNCTION assert_within_radius(p_loc JSONB)
RETURNS JSONB
LANGUAGE plpgsql STABLE
SET search_path = public, extensions
AS $$
DECLARE
  v_site    attendance_locations;
  v_lat     DOUBLE PRECISION := (p_loc->>'latitude')::double precision;
  v_lon     DOUBLE PRECISION := (p_loc->>'longitude')::double precision;
  v_acc     DOUBLE PRECISION := COALESCE((p_loc->>'accuracy')::double precision, 0);
  v_dist    DOUBLE PRECISION;
  v_tolerance DOUBLE PRECISION;
BEGIN
  IF p_loc IS NULL OR v_lat IS NULL OR v_lon IS NULL THEN
    RAISE EXCEPTION 'Lokasi wajib dikirim saat absen';
  END IF;

  -- Akurasi wajib dikirim dan "terlalu sempurna" (< 5 m) = indikasi Fake GPS.
  IF v_acc <= 0 THEN
    RAISE EXCEPTION 'Akurasi GPS tidak dikirim perangkat';
  END IF;
  IF v_acc < 5 THEN
    RAISE EXCEPTION 'Akurasi GPS mencurigakan (% m)', round(v_acc::numeric, 1);
  END IF;

  v_site := active_attendance_location();
  IF v_site.id IS NULL THEN
    RAISE EXCEPTION 'Tidak ada lokasi puskesmas aktif';
  END IF;

  v_dist      := geo_distance_m(v_lat, v_lon, v_site.latitude, v_site.longitude);
  v_tolerance := LEAST(v_acc, 30);

  IF v_dist > v_site.radius_meter + v_tolerance THEN
    RAISE EXCEPTION 'Anda berada % m dari % (radius % m)',
      round(v_dist)::int, v_site.name, v_site.radius_meter;
  END IF;

  RETURN jsonb_set(p_loc, '{distance_from_puskesmas}', to_jsonb(round(v_dist)::int));
END;
$$;

-- Guard tulis-mandiri attendance:
--  INSERT (pegawai): jam/tanggal/shift/status/late SELALU hasil hitung server.
--  UPDATE (pegawai): hanya kolom checkout (jam pulang, lokasi keluar,
--                    selfie keluar, info device). Kolom lain terkunci.
CREATE OR REPLACE FUNCTION guard_attendance_self_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_now        TIMESTAMPTZ := now();
  v_wita       TIMESTAMP   := v_now AT TIME ZONE 'Asia/Makassar';
  v_date       DATE        := v_wita::date;
  v_dow        INT         := (EXTRACT(DOW FROM v_wita)::int + 6) % 7; -- Senin=0
  v_minutes    INT         := EXTRACT(HOUR FROM v_wita)::int * 60
                            + EXTRACT(MINUTE FROM v_wita)::int;
  v_shift      TEXT;
  v_start      TIME;
  v_latest     TIME;
  v_workday    BOOLEAN;
  v_start_min  INT;
  v_late_min   INT;
BEGIN
  -- Bypass: service role & platform admin
  IF auth.uid() IS NULL OR is_platform_admin() THEN
    RETURN NEW;
  END IF;

  -- Bypass: baris milik orang lain (mis. INSERT izin/sakit dari RPC
  -- approval admin) — guard ini hanya mengurangi tulis-mandiri.
  IF TG_OP = 'INSERT' THEN
    IF NEW.user_id <> auth.uid() THEN
      RETURN NEW;
    END IF;
  ELSIF OLD.user_id <> auth.uid() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Status non-reguler (izin/sakit/alpha) hanya boleh dibuat sistem/admin,
    -- bukan self-insert langsung — kalau tidak, riwayat cuti bisa dipalsukan.
    IF NEW.attendance_status NOT IN ('hadir', 'terlambat') THEN
      IF NOT is_org_admin() THEN
        RAISE EXCEPTION 'Status non-reguler hanya dibuat melalui pengajuan cuti yang disetujui admin';
      END IF;
      RETURN NEW;
    END IF;

    -- Jam & tanggal dipaksakan dari clock server WITA
    NEW.clock_in_time := v_now;
    NEW.date          := v_date;

    -- Shift = jadwal hari ini (satu sumber kebenaran: DB)
    SELECT es.shift_code INTO v_shift
    FROM employee_schedules es
    WHERE es.user_id = NEW.user_id AND es.date = v_date
    LIMIT 1;

    IF v_shift IS NULL THEN
      RAISE EXCEPTION 'Tidak ada jadwal kerja hari ini — hubungi admin';
    END IF;
    NEW.shift_code := v_shift;

    SELECT ss.start_time, ss.latest_check_in, ss.is_working_day
      INTO v_start, v_latest, v_workday
    FROM shift_schedules ss
    WHERE ss.shift_code = v_shift
      AND ss.day_of_week = v_dow
      AND (ss.organization_id = current_org_id() OR ss.organization_id IS NULL)
    ORDER BY ss.organization_id NULLS LAST
    LIMIT 1;

    -- Non-working/placeholder → pakai jam hari kerja shift yang sama
    IF v_start IS NULL OR v_start = '00:00' OR NOT v_workday THEN
      SELECT ss.start_time, ss.latest_check_in INTO v_start, v_latest
      FROM shift_schedules ss
      WHERE ss.shift_code = v_shift
        AND ss.is_working_day = true
        AND (ss.organization_id = current_org_id() OR ss.organization_id IS NULL)
      ORDER BY ss.organization_id NULLS LAST
      LIMIT 1;
    END IF;

    -- Jam shift harus ada — tanpa ini, nilai klien lolos tanpa normalisasi.
    IF v_start IS NULL THEN
      RAISE EXCEPTION 'Konfigurasi jam shift belum lengkap — hubungi admin';
    END IF;

    v_start_min := EXTRACT(HOUR FROM v_start)::int * 60 + EXTRACT(MINUTE FROM v_start)::int;
    v_late_min  := EXTRACT(HOUR FROM COALESCE(v_latest, v_start))::int * 60
                 + EXTRACT(MINUTE FROM COALESCE(v_latest, v_start))::int;
    NEW.is_late         := v_minutes > v_late_min;
    NEW.late_minutes    := GREATEST(v_minutes - v_start_min, 0);
    IF NOT NEW.is_late THEN
      NEW.late_minutes := 0;
    END IF;
    NEW.attendance_status := CASE WHEN NEW.is_late THEN 'terlambat' ELSE 'hadir' END;

    NEW.schedule_match := true;
    NEW.clock_out_time := NULL;
    NEW.location_in    := assert_within_radius(NEW.location_in);
    RETURN NEW;
  END IF;

  -- ── TG_OP = 'UPDATE' ────────────────────────────────────────────
  -- Hanya proses checkout yang boleh: kolom di luar daftar ini terkunci.
  IF OLD.clock_in_time IS NULL THEN
    RAISE EXCEPTION 'Record ini bukan absensi reguler dan tidak dapat diubah dari aplikasi';
  END IF;

  IF NEW.user_id           IS DISTINCT FROM OLD.user_id
     OR NEW.date           IS DISTINCT FROM OLD.date
     OR NEW.shift_code     IS DISTINCT FROM OLD.shift_code
     OR NEW.clock_in_time  IS DISTINCT FROM OLD.clock_in_time
     OR NEW.location_in    IS DISTINCT FROM OLD.location_in
     OR NEW.selfie_in_url  IS DISTINCT FROM OLD.selfie_in_url
     OR NEW.attendance_status IS DISTINCT FROM OLD.attendance_status
     OR NEW.is_late        IS DISTINCT FROM OLD.is_late
     OR NEW.late_minutes   IS DISTINCT FROM OLD.late_minutes
     OR NEW.schedule_match IS DISTINCT FROM OLD.schedule_match
     OR NEW.notes          IS DISTINCT FROM OLD.notes THEN
    RAISE EXCEPTION 'Data absensi tidak dapat diubah dari sisi aplikasi';
  END IF;

  -- Lokasi keluar divalidasi server setiap kali ditulis (tanpa ini,
  -- jalur update lama yang tidak mengirim clock_out_time lolos tanpa cek).
  IF NEW.location_out IS DISTINCT FROM OLD.location_out THEN
    NEW.location_out := assert_within_radius(NEW.location_out);
  END IF;

  -- Checkout sekali jalan; jam pulang = clock server.
  IF NEW.clock_out_time IS NOT NULL AND OLD.clock_out_time IS NULL THEN
    NEW.clock_out_time := v_now;
  END IF;
  IF NEW.clock_out_time IS NOT NULL AND OLD.clock_out_time IS NOT NULL
     AND NEW.clock_out_time <> OLD.clock_out_time THEN
    RAISE EXCEPTION 'Absen pulang sudah tercatat dan tidak dapat diubah';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_attendance_self_write ON attendance;
CREATE TRIGGER trg_guard_attendance_self_write
  BEFORE INSERT OR UPDATE ON attendance
  FOR EACH ROW EXECUTE FUNCTION guard_attendance_self_write();

-- ────────────────────────────────────────────────────────────────────
-- 5. T4 — RPC validasi lokasi: sadar-tenant, search_path dikunci,
--    toleransi akurasi dibatasi 30 m (tidak bisa diperlebar klien).
-- ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION verify_attendance_location(
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_accuracy DOUBLE PRECISION DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql STABLE
SET search_path = public, extensions
AS $$
DECLARE
  v_site      attendance_locations;
  v_distance  DOUBLE PRECISION;
  v_tolerance DOUBLE PRECISION;
  v_within    BOOLEAN;
BEGIN
  v_site := active_attendance_location();

  IF v_site.id IS NULL THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Tidak ada lokasi puskesmas aktif',
      'distance', null, 'radius', null
    );
  END IF;

  v_distance  := geo_distance_m(p_latitude, p_longitude, v_site.latitude, v_site.longitude);
  v_tolerance := LEAST(COALESCE(p_accuracy, 0), 30);
  v_within    := v_distance <= v_site.radius_meter + v_tolerance;

  -- Anti-Fake-GPS: akurasi wajib dikirim; < 5 m terlalu sempurna = curiga.
  IF p_accuracy IS NULL OR p_accuracy <= 0 THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Akurasi GPS tidak dikirim perangkat',
      'distance', round(v_distance)::INT,
      'radius', v_site.radius_meter,
      'puskesmas_name', v_site.name,
      'suspicious_accuracy', true
    );
  END IF;
  IF p_accuracy < 5 THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Akurasi GPS mencurigakan (' || round(p_accuracy::numeric, 1) || 'm)',
      'distance', round(v_distance)::INT,
      'radius', v_site.radius_meter,
      'puskesmas_name', v_site.name,
      'suspicious_accuracy', true
    );
  END IF;

  RETURN jsonb_build_object(
    'valid', v_within,
    'error', CASE WHEN v_within THEN null ELSE 'Luar radius puskesmas' END,
    'distance', round(v_distance)::INT,
    'radius', v_site.radius_meter,
    'puskesmas_name', v_site.name
  );
END;
$$;
