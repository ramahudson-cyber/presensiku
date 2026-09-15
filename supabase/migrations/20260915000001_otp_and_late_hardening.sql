-- =====================================================================
-- HARDENING TAHAP 2 (lanjutan audit 2026-09-15)
-- 1. OTP: kode disimpan sebagai hash SHA-256, hanya 6 digit angka yang
--    diterima (hash tersimpan tidak bisa dipakai sebagai passcode),
--    batas 5 tebakan salah per kode (FOR UPDATE anti balapan),
--    generate baru membatalkan kode aktif sebelumnya (satu kode aktif),
--    cek "hanya untuk diri sendiri" dipertahankan (setara wrapper
--    20260913000003), fungsi *_impl lama dihapus.
-- 2. Guard absensi: blokir check-in terlambat > 1 jam di SERVER
--    (aturan AGENTS.md; sebelumnya hanya ditegakkan di klien),
--    dengan koreksi shift lintas tengah malam (ML).
-- Idempotent. SECURITY DEFINER/service role tidak kena guard.
-- =====================================================================

-- ────────────────────────────────────────────────────────────────────
-- 1a. Kolom: pencacah percobaan + tipe code cukup untuk hash hex
-- ────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE otp_codes
    ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE otp_codes ALTER COLUMN code TYPE TEXT;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ────────────────────────────────────────────────────────────────────
-- 1b. generate_otp_code — self-only, CSPRNG, hash tersimpan,
--     kode aktif lama dibatalkan. Plaintext HANYA dikembalikan ke
--     pemanggil (untuk email); tidak pernah tersimpan di tabel.
-- ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION generate_otp_code(
  p_user_id UUID
)
RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_otp VARCHAR(6);
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Tidak berhak generate OTP user lain';
  END IF;

  -- Satu kode aktif per user: batalkan yang lama (mencegah
  -- "regenerate = reset jatah tebakan" dipakai menimbun kode).
  UPDATE otp_codes SET is_used = true
  WHERE user_id = p_user_id AND is_used = false;

  -- 6 digit dari CSPRNG (gen_random_bytes), bukan RANDOM().
  v_otp := LPAD(
    (abs(('x' || substr(encode(gen_random_bytes(4), 'hex'), 1, 8))::bit(32)::bigint)
     % 1000000)::text, 6, '0');

  INSERT INTO otp_codes (user_id, code, purpose, expires_at)
  VALUES (
    p_user_id,
    encode(digest(v_otp, 'sha256'), 'hex'),
    'device_verification',
    NOW() + INTERVAL '5 minutes'
  );
  RETURN v_otp;
END;
$$;

-- ────────────────────────────────────────────────────────────────────
-- 1c. verify_otp_code — self-only, format 6 digit wajib (menutup
--     replay hash), hash baru ATAU plaintext lama (masa transisi),
--     limit 5 tebakan salah dengan FOR UPDATE.
-- ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION verify_otp_code(
  p_user_id UUID,
  p_otp VARCHAR
)
RETURNS TABLE(is_valid BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash      TEXT;
  v_otp       RECORD;
  v_active_id UUID;
  v_attempts  INT;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN QUERY SELECT false::BOOLEAN, 'Tidak berhak'::TEXT;
    RETURN;
  END IF;

  -- Format OTP selalu 6 digit angka: hash 64-karakter tidak bisa
  -- dipakai sebagai passcode lewat cabang perbandingan plaintext.
  IF p_otp IS NULL OR p_otp !~ '^[0-9]{6}$' THEN
    RETURN QUERY SELECT false::BOOLEAN, 'Kode OTP tidak valid'::TEXT;
    RETURN;
  END IF;

  v_hash := encode(digest(p_otp, 'sha256'), 'hex');

  SELECT * INTO v_otp FROM otp_codes
  WHERE user_id = p_user_id
    AND (code = v_hash OR code = p_otp)  -- plaintext: baris lama pra-hash
    AND is_used = false
    AND expires_at > NOW()
    AND attempts < 5
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    UPDATE otp_codes SET is_used = true WHERE id = v_otp.id;
    RETURN QUERY SELECT true::BOOLEAN AS is_valid, 'OTP valid'::TEXT AS message;
    RETURN;
  END IF;

  -- Kunci baris aktif untuk mencegah dua tebakan paralel melewati
  -- batas 5 (TOCTOU).
  SELECT id, attempts INTO v_active_id, v_attempts FROM otp_codes
  WHERE user_id = p_user_id
    AND is_used = false
    AND expires_at > NOW()
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF v_attempts + 1 >= 5 THEN
      UPDATE otp_codes SET attempts = attempts + 1, is_used = true
       WHERE id = v_active_id;
      RETURN QUERY SELECT false::BOOLEAN,
        'Terlalu banyak percobaan salah — kode diblokir, silakan kirim ulang OTP.'::TEXT;
      RETURN;
    END IF;
    UPDATE otp_codes SET attempts = attempts + 1 WHERE id = v_active_id;
  END IF;

  RETURN QUERY SELECT false::BOOLEAN,
    'Kode OTP tidak valid atau sudah kedaluwarsa. Mohon kirim ulang.'::TEXT;
END;
$$;

-- ────────────────────────────────────────────────────────────────────
-- 1d. Hapus implementasi lama (plaintext, tanpa limit, tanpa self-check)
--     agar tidak bisa dipanggil langsung sebagai bypass.
-- ────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  DROP FUNCTION IF EXISTS generate_otp_code_impl(uuid);
  DROP FUNCTION IF EXISTS verify_otp_code_impl(uuid, varchar);
EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- ────────────────────────────────────────────────────────────────────
-- 2. Guard absensi: tambah blokir terlambat > 1 jam (server-side).
--    Fungsi ditulis ulang utuh — sama dengan tahap 1 plus:
--    - koreksi ML: hanya menit sebelum tengah hari yang dianggap
--      "sesudah tengah malam" (check-in awal 19:55 tidak terblokir);
--    - blokir > 1 jam dihitung dari jam mulai shift.
-- ────────────────────────────────────────────────────────────────────
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
  v_crosses    BOOLEAN := false;
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

    SELECT ss.start_time, ss.latest_check_in, ss.is_working_day,
           COALESCE(ss.crosses_midnight, false)
      INTO v_start, v_latest, v_workday, v_crosses
    FROM shift_schedules ss
    WHERE ss.shift_code = v_shift
      AND ss.day_of_week = v_dow
      AND (ss.organization_id = current_org_id() OR ss.organization_id IS NULL)
    ORDER BY ss.organization_id NULLS LAST
    LIMIT 1;

    -- Non-working/placeholder → pakai jam hari kerja shift yang sama
    IF v_start IS NULL OR v_start = '00:00' OR COALESCE(v_workday, true) = false THEN
      SELECT ss.start_time, ss.latest_check_in,
             COALESCE(ss.crosses_midnight, false)
        INTO v_start, v_latest, v_crosses
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

    -- Shift lintas tengah malam (ML, start 20:00): hanya waktu pagi buta
    -- (menit < 720 alias sebelum tengah hari) dihitung sebagai hari
    -- berikutnya. Check-in 19:55 (lebih awal) TIDAK digeser +1440.
    IF v_crosses AND v_minutes < 720 AND v_minutes < v_start_min THEN
      v_minutes := v_minutes + 1440;
    END IF;

    -- Aturan AGENTS.md: terlambat > 1 jam dari jam mulai = blokir total.
    IF v_minutes - v_start_min > 60 THEN
      RAISE EXCEPTION 'Terlambat lebih dari 1 jam — absen diblokir, hubungi admin';
    END IF;

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

  -- Lokasi keluar divalidasi server setiap kali ditulis.
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
