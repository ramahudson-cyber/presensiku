-- Izinkan pegawai tetap melakukan absensi setelah terlambat lebih dari satu jam.
-- Keterlambatan tetap dihitung dan dicatat sebagai status "terlambat".
-- Migration ini hanya mengganti function guard yang sudah dipasang oleh
-- 20260915000000/20260915000001; trigger attendance tetap dipertahankan.

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
  v_dow        INT         := (EXTRACT(DOW FROM v_wita)::int + 6) % 7;
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

    -- Non-working/placeholder memakai jam hari kerja shift yang sama.
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

  -- Field presensi masuk tetap immutable setelah tercatat.
  IF NEW.user_id             IS DISTINCT FROM OLD.user_id
     OR NEW.date              IS DISTINCT FROM OLD.date
     OR NEW.shift_code        IS DISTINCT FROM OLD.shift_code
     OR NEW.clock_in_time     IS DISTINCT FROM OLD.clock_in_time
     OR NEW.location_in       IS DISTINCT FROM OLD.location_in
     OR NEW.selfie_in_url     IS DISTINCT FROM OLD.selfie_in_url
     OR NEW.attendance_status IS DISTINCT FROM OLD.attendance_status
     OR NEW.is_late           IS DISTINCT FROM OLD.is_late
     OR NEW.late_minutes      IS DISTINCT FROM OLD.late_minutes
     OR NEW.schedule_match    IS DISTINCT FROM OLD.schedule_match
     OR NEW.notes             IS DISTINCT FROM OLD.notes THEN
    RAISE EXCEPTION 'Data absensi tidak dapat diubah dari sisi aplikasi';
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

  RETURN NEW;
END;
$$;
