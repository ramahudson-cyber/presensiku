-- =====================================================================
-- BATAS ABSEN PULANG 1 JAM + KOMPENSASI KETERLAMBATAN:
-- 1. Checkout hanya berlaku sampai 1 jam setelah jam selesai shift
--    (shift malam lintas malam: jam pulang besok + 1 jam). Lewat batas →
--    checkout ditolak.
-- 2. Kompensasi telat: check-in telat X menit → bila absen pulang dilakukan
--    >= (jam selesai shift + X menit), status otomatis dikoreksi menjadi
--    'hadir' (is_late=false, late_minutes=0) → tanpa potongan telat.
--    Bila target tidak tercapai → tetap 'terlambat' sesuai menit.
-- Salinan guard_attendance_self_write dari 20261005010000 (kontinuasi
-- shift malam kemarin tetap utuh); modifikasi hanya di branch checkout.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.guard_attendance_self_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_now        TIMESTAMPTZ := now();
  v_wita       TIMESTAMP   := v_now AT TIME ZONE 'Asia/Makassar';
  v_date       DATE        := v_wita::date;
  v_dow        INT         := (EXTRACT(DOW FROM v_wita)::int + 6) % 7;
  v_minutes    INT         := EXTRACT(HOUR FROM v_wita)::int * 60
                            + EXTRACT(MINUTE FROM v_wita)::int;
  v_shift      TEXT;
  v_start      TIME;
  v_latest     TIME;
  v_end        TIME;
  v_workday    BOOLEAN;
  v_crosses    BOOLEAN := false;
  v_end_at     TIMESTAMP;
  v_existing_status TEXT;
  v_start_min  INT;
  v_late_min   INT;
  v_y_date     DATE;
  v_y_shift    TEXT;
  v_y_dow      INT;
  v_cont       BOOLEAN := false;
  v_first_checkout BOOLEAN := false;
  v_c_dow      INT;
BEGIN
  -- Bypass: service role & platform admin.
  IF auth.uid() IS NULL OR is_platform_admin() THEN
    RETURN NEW;
  END IF;

  -- Bypass rows milik user lain, misalnya hasil approval izin/sakit admin.
  IF TG_OP = 'INSERT' THEN
    IF NEW.user_id <> auth.uid() THEN
      RETURN NEW;
    END IF;
  ELSIF OLD.user_id <> auth.uid() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Status non-reguler hanya boleh dibuat sistem/admin.
    IF NEW.attendance_status NOT IN ('hadir', 'terlambat') THEN
      IF NOT is_org_admin() THEN
        RAISE EXCEPTION 'Status non-reguler hanya dibuat melalui pengajuan cuti yang disetujui admin';
      END IF;
      RETURN NEW;
    END IF;

    -- Jam dan tanggal dipaksakan dari server WITA.
    NEW.clock_in_time := v_now;
    NEW.date          := v_date;

    -- Shift harus berasal dari jadwal pegawai pada hari berjalan.
    SELECT es.shift_code INTO v_shift
    FROM employee_schedules es
    WHERE es.user_id = NEW.user_id AND es.date = v_date
    LIMIT 1;

    -- Jam mulai shift hari ini (untuk memutuskan kontinuasi dini hari).
    v_start_min := NULL;
    IF v_shift IS NOT NULL THEN
      SELECT EXTRACT(HOUR FROM ss.start_time)::int * 60 + EXTRACT(MINUTE FROM ss.start_time)::int
        INTO v_start_min
      FROM shift_schedules ss
      WHERE ss.shift_code = v_shift
        AND ss.day_of_week = v_dow
        AND (ss.organization_id = current_org_id() OR ss.organization_id IS NULL)
      ORDER BY ss.organization_id NULLS LAST
      LIMIT 1;
      IF v_start_min IS NULL THEN
        SELECT EXTRACT(HOUR FROM ss.start_time)::int * 60 + EXTRACT(MINUTE FROM ss.start_time)::int
          INTO v_start_min
        FROM shift_schedules ss
        WHERE ss.shift_code = v_shift
          AND ss.is_working_day = true
          AND (ss.organization_id = current_org_id() OR ss.organization_id IS NULL)
        ORDER BY ss.organization_id NULLS LAST
        LIMIT 1;
      END IF;
    END IF;

    -- ── Kontinuasi shift malam kemarin (dini hari) ──
    -- Syarat: dini hari (< 12:00), kemarin ada jadwal lintas malam yang
    -- BELUM punya baris absensi, dan shift hari ini (bila ada) belum mulai.
    IF v_minutes < 720 THEN
      v_y_date := v_date - 1;
      v_y_dow  := (EXTRACT(DOW FROM v_y_date)::int + 6) % 7;
      IF NOT EXISTS (
        SELECT 1 FROM attendance a
        WHERE a.user_id = NEW.user_id AND a.date = v_y_date
      ) THEN
        SELECT es.shift_code INTO v_y_shift
        FROM employee_schedules es
        WHERE es.user_id = NEW.user_id AND es.date = v_y_date
        LIMIT 1;
        IF v_y_shift IS NOT NULL THEN
          SELECT COALESCE(ss.crosses_midnight, false) OR (ss.end_time <= ss.start_time)
            INTO v_cont
          FROM shift_schedules ss
          WHERE ss.shift_code = v_y_shift
            AND ss.day_of_week = v_y_dow
            AND (ss.organization_id = current_org_id() OR ss.organization_id IS NULL)
          ORDER BY ss.organization_id NULLS LAST
          LIMIT 1;
          v_cont := COALESCE(v_cont, false);
          -- Shift hari ini sudah mulai → bukan kontinuasi
          IF v_cont AND v_shift IS NOT NULL AND v_start_min IS NOT NULL
             AND v_minutes >= v_start_min THEN
            v_cont := false;
          END IF;
          IF v_cont THEN
            v_date  := v_y_date;
            NEW.date := v_y_date;
            v_shift := v_y_shift;
            v_dow   := v_y_dow;
          END IF;
        END IF;
      END IF;
    END IF;

    IF v_shift IS NULL THEN
      RAISE EXCEPTION 'Tidak ada jadwal kerja hari ini — hubungi admin';
    END IF;
    NEW.shift_code := v_shift;

    SELECT ss.start_time, ss.latest_check_in, ss.end_time, ss.is_working_day,
           COALESCE(ss.crosses_midnight, false)
      INTO v_start, v_latest, v_end, v_workday, v_crosses
    FROM shift_schedules ss
    WHERE ss.shift_code = v_shift
      AND ss.day_of_week = v_dow
      AND (ss.organization_id = current_org_id() OR ss.organization_id IS NULL)
    ORDER BY ss.organization_id NULLS LAST
    LIMIT 1;

    -- Non-working/placeholder memakai jam hari kerja shift yang sama.
    IF v_start IS NULL OR v_start = '00:00' OR COALESCE(v_workday, true) = false THEN
      SELECT ss.start_time, ss.latest_check_in, ss.end_time,
             COALESCE(ss.crosses_midnight, false)
        INTO v_start, v_latest, v_end, v_crosses
      FROM shift_schedules ss
      WHERE ss.shift_code = v_shift
        AND ss.is_working_day = true
        AND (ss.organization_id = current_org_id() OR ss.organization_id IS NULL)
      ORDER BY ss.organization_id NULLS LAST
      LIMIT 1;
    END IF;

    IF v_start IS NULL THEN
      RAISE EXCEPTION 'Konfigurasi jam shift belum lengkap — hubungi admin';
    END IF;

    v_start_min := EXTRACT(HOUR FROM v_start)::int * 60 + EXTRACT(MINUTE FROM v_start)::int;
    v_late_min  := EXTRACT(HOUR FROM COALESCE(v_latest, v_start))::int * 60
                 + EXTRACT(MINUTE FROM COALESCE(v_latest, v_start))::int;

    -- Shift lintas tengah malam: waktu pagi buta dihitung sebagai lanjutan
    -- dari shift malam sebelumnya. Check-in sebelum jam mulai tidak digeser.
    IF v_crosses AND v_minutes < 720 AND v_minutes < v_start_min THEN
      v_minutes := v_minutes + 1440;
    END IF;

    -- Jendela waktu absen masuk: dibuka 15 menit sebelum jam mulai shift.
    -- Kontinuasi dini hari shift malam otomatis lolos (v_minutes sudah +1440).
    IF v_minutes < v_start_min - 15 THEN
      RAISE EXCEPTION
        'Waktu absensi belum dimulai — absen masuk dibuka pukul % WITA (15 menit sebelum jam shift)',
        to_char(v_date + v_start - INTERVAL '15 minutes', 'HH24:MI');
    END IF;

    -- Alpha bersifat terminal untuk pegawai biasa: jadwal yang sudah lewat
    -- jam selesai tidak menerima check-in regular lagi. Admin/platform tetap
    -- melewati guard ini melalui bypass di awal function.
    SELECT a.attendance_status INTO v_existing_status
    FROM attendance a
    WHERE a.user_id = NEW.user_id AND a.date = v_date
    LIMIT 1;

    IF v_existing_status = 'alpha' THEN
      RAISE EXCEPTION 'Absensi sudah berstatus Alpha dan tidak dapat diubah';
    END IF;

    IF v_end IS NULL THEN
      RAISE EXCEPTION 'Konfigurasi jam selesai shift belum lengkap — hubungi admin';
    END IF;

    v_end_at := v_date + v_end;
    IF v_crosses AND v_end <= v_start THEN
      v_end_at := v_end_at + INTERVAL '1 day';
    END IF;

    IF v_wita >= v_end_at THEN
      RAISE EXCEPTION 'Absensi ditutup karena jadwal hari ini sudah berstatus Alpha';
    END IF;

    -- Tidak ada lagi penolakan berdasarkan jumlah keterlambatan.
    -- Keterlambatan tetap dinormalisasi dan disimpan oleh server.
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

  -- Hanya proses checkout yang boleh dilakukan dari sisi pegawai.
  IF OLD.clock_in_time IS NULL THEN
    RAISE EXCEPTION 'Record ini bukan absensi reguler dan tidak dapat diubah dari sisi aplikasi';
  END IF;

  -- Checkout pertama? (deadline 1 jam + kompensasi telat hanya di sini)
  v_first_checkout := (OLD.clock_out_time IS NULL AND NEW.clock_out_time IS NOT NULL);

  -- Field presensi masuk tetap immutable setelah tercatat. Pada checkout
  -- PERTAMA, kompensasi telat berhak mengoreksi status/keterlambatan —
  -- divalidasi ketat di bawah (hanya jika target kompensasi terpenuhi).
  IF NEW.user_id             IS DISTINCT FROM OLD.user_id
     OR NEW.date              IS DISTINCT FROM OLD.date
     OR NEW.shift_code        IS DISTINCT FROM OLD.shift_code
     OR NEW.clock_in_time     IS DISTINCT FROM OLD.clock_in_time
     OR NEW.location_in       IS DISTINCT FROM OLD.location_in
     OR NEW.selfie_in_url     IS DISTINCT FROM OLD.selfie_in_url
     OR NEW.schedule_match    IS DISTINCT FROM OLD.schedule_match
     OR NEW.notes             IS DISTINCT FROM OLD.notes THEN
    RAISE EXCEPTION 'Data absensi tidak dapat diubah dari sisi aplikasi';
  END IF;
  IF NOT v_first_checkout THEN
    IF NEW.attendance_status IS DISTINCT FROM OLD.attendance_status
       OR NEW.is_late        IS DISTINCT FROM OLD.is_late
       OR NEW.late_minutes   IS DISTINCT FROM OLD.late_minutes THEN
      RAISE EXCEPTION 'Data absensi tidak dapat diubah dari sisi aplikasi';
    END IF;
  END IF;

  -- Checkout dari sisi pegawai wajib menyertakan lokasi keluar.
  IF NEW.clock_out_time IS NOT NULL AND NEW.location_out IS NULL THEN
    RAISE EXCEPTION 'Lokasi check-out wajib dikirim saat absen pulang';
  END IF;

  -- Lokasi keluar tetap divalidasi setiap kali ditulis.
  IF NEW.location_out IS DISTINCT FROM OLD.location_out THEN
    NEW.location_out := assert_within_radius(NEW.location_out);
  END IF;

  -- Checkout sekali jalan dengan waktu server.
  IF NEW.clock_out_time IS NOT NULL AND OLD.clock_out_time IS NULL THEN
    NEW.clock_out_time := v_now;
  END IF;
  IF NEW.clock_out_time IS NOT NULL AND OLD.clock_out_time IS NOT NULL
     AND NEW.clock_out_time <> OLD.clock_out_time THEN
    RAISE EXCEPTION 'Absen pulang sudah tercatat dan tidak dapat diubah';
  END IF;

  -- ── Deadline 1 jam + kompensasi telat (checkout pertama) ──
  IF v_first_checkout THEN
    v_c_dow := (EXTRACT(DOW FROM OLD.date)::int + 6) % 7;
    SELECT ss.start_time, ss.end_time, COALESCE(ss.crosses_midnight, false)
      INTO v_start, v_end, v_crosses
    FROM shift_schedules ss
    WHERE ss.shift_code = OLD.shift_code
      AND ss.day_of_week = v_c_dow
      AND (ss.organization_id = current_org_id() OR ss.organization_id IS NULL)
    ORDER BY ss.organization_id NULLS LAST
    LIMIT 1;
    -- Fallback non-working/placeholder: pakai jam hari kerja shift yang sama
    IF v_start IS NULL OR v_start = '00:00' OR v_end IS NULL OR v_end = '00:00' THEN
      SELECT ss.start_time, ss.end_time, COALESCE(ss.crosses_midnight, false)
        INTO v_start, v_end, v_crosses
      FROM shift_schedules ss
      WHERE ss.shift_code = OLD.shift_code
        AND ss.is_working_day = true
        AND (ss.organization_id = current_org_id() OR ss.organization_id IS NULL)
      ORDER BY ss.organization_id NULLS LAST
      LIMIT 1;
    END IF;

    IF v_start IS NOT NULL AND v_end IS NOT NULL THEN
      v_end_at := OLD.date + v_end;
      IF v_crosses AND v_end <= v_start THEN
        v_end_at := v_end_at + INTERVAL '1 day';
      END IF;

      -- A. Deadline: maksimal 1 jam setelah jam selesai shift
      IF v_wita > v_end_at + INTERVAL '1 hour' THEN
        RAISE EXCEPTION 'Batas absen pulang sudah lewat — maksimal 1 jam setelah jam selesai shift';
      END IF;

      -- B. Kompensasi telat: pulang >= jam selesai + menit telat → hadir
      IF OLD.is_late AND COALESCE(OLD.late_minutes, 0) > 0 THEN
        IF v_wita >= v_end_at + (COALESCE(OLD.late_minutes, 0) * INTERVAL '1 minute') THEN
          NEW.attendance_status := 'hadir';
          NEW.is_late := false;
          NEW.late_minutes := 0;
        ELSE
          NEW.attendance_status := OLD.attendance_status;
          NEW.is_late := OLD.is_late;
          NEW.late_minutes := OLD.late_minutes;
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
 $function$;

NOTIFY pgrst, 'reload schema';
