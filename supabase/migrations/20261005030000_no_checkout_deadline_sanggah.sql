-- =====================================================================
-- 1. upsert_payroll_line — potongan no_checkout berlaku begitu batas
--    absen pulang (jam selesai shift + 1 jam) terlewati, termasuk hari
--    yang sama. Shift malam: batas = besok pagi + 1 jam.
-- =====================================================================
CREATE OR REPLACE FUNCTION upsert_payroll_line(
  p_org UUID,
  p_user UUID,
  p_period DATE,
  p_cfg JSONB,
  p_generated_by UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start DATE := date_trunc('month', p_period)::date;
  v_end   DATE := (date_trunc('month', p_period) + INTERVAL '1 month - 1 day')::date;
  v_today DATE := (NOW() AT TIME ZONE 'Asia/Makassar')::date;
  v_base NUMERIC(14,2);
  v_workdays INT := 0;
  v_hadir INT := 0;
  v_terlambat INT := 0;
  v_izin INT := 0;
  v_sakit INT := 0;
  v_late_total INT := 0;
  v_late_cut NUMERIC(14,2) := 0;
  v_alpha INT;
  v_daily NUMERIC(14,2);
  v_alpha_cut NUMERIC(14,2);
  v_nc_days INT := 0;
  v_nc_cut NUMERIC(14,2) := 0;
  v_el_days INT := 0;
  v_el_minutes INT;
  v_el_cut NUMERIC(14,2) := 0;
  v_total_cut NUMERIC(14,2);
  v_received NUMERIC(14,2);
  v_details JSONB := '[]'::jsonb;
  v_att RECORD;
  v_tier JSONB;
  v_nominal NUMERIC(14,2);
  v_end_at TIMESTAMPTZ;
  v_early_sec NUMERIC;
  v_nc_deadline TIMESTAMPTZ;
BEGIN
  SELECT base_component INTO v_base
  FROM payroll_employee_config
  WHERE organization_id = p_org AND user_id = p_user AND is_active;
  IF v_base IS NULL THEN RETURN; END IF; -- tanpa config gaji: bukan bagian payroll

  SELECT COUNT(*) INTO v_workdays
  FROM employee_schedules es
  JOIN shift_schedules ss
    ON ss.organization_id = es.organization_id
   AND ss.shift_code = es.shift_code
   AND ss.day_of_week = (EXTRACT(ISODOW FROM es.date)::int - 1)
  WHERE es.user_id = p_user
    AND es.date BETWEEN v_start AND v_end
    AND ss.is_working_day;

  FOR v_att IN
    SELECT a.date, a.attendance_status, a.is_late, a.late_minutes,
           a.clock_in_time, a.clock_out_time, a.notes,
           ss.start_time AS shift_start, ss.end_time AS shift_end,
           COALESCE(ss.crosses_midnight, false) AS crosses,
           ss.is_working_day AS ss_working
    FROM attendance a
    LEFT JOIN employee_schedules es
      ON es.user_id = a.user_id AND es.date = a.date
    LEFT JOIN shift_schedules ss
      ON ss.organization_id = es.organization_id
     AND ss.shift_code = es.shift_code
     AND ss.day_of_week = (EXTRACT(ISODOW FROM a.date)::int - 1)
    WHERE a.user_id = p_user
      AND a.date BETWEEN v_start AND v_end
      AND a.attendance_status IN ('hadir','terlambat','izin','sakit','alpha')
  LOOP
    IF v_att.attendance_status IN ('hadir','terlambat') THEN
      v_hadir := v_hadir + 1;
    ELSIF v_att.attendance_status = 'izin' THEN
      v_izin := v_izin + 1;
    ELSIF v_att.attendance_status = 'sakit' THEN
      v_sakit := v_sakit + 1;
    END IF;

    IF v_att.is_late THEN
      v_terlambat := v_terlambat + 1;
      v_late_total := v_late_total + COALESCE(v_att.late_minutes, 0);

      v_nominal := 0;
      FOR v_tier IN SELECT * FROM jsonb_array_elements(COALESCE(p_cfg->'late_tiers', '[]'::jsonb))
      LOOP
        IF v_att.late_minutes >= (v_tier->>'min')::int
           AND (v_tier->>'max' IS NULL OR v_att.late_minutes <= (v_tier->>'max')::int) THEN
          v_nominal := COALESCE((v_tier->>'nominal')::numeric, 0);
          EXIT;
        END IF;
      END LOOP;

      v_late_cut := v_late_cut + v_nominal;
      v_details := v_details || jsonb_build_array(jsonb_build_object(
        'date', v_att.date, 'minutes', COALESCE(v_att.late_minutes, 0), 'nominal', v_nominal
      ));
    END IF;

    -- Tidak absen pulang: jam masuk ada, jam pulang kosong, dan batas
    -- absen pulang (jam selesai shift + 1 jam) sudah terlewati. Shift malam
    -- lintas malam: batas = besok pagi + 1 jam.
    IF v_att.attendance_status IN ('hadir','terlambat')
       AND v_att.clock_in_time IS NOT NULL
       AND v_att.clock_out_time IS NULL
       AND COALESCE(v_att.notes, '') NOT ILIKE '%dikoreksi via sanggahan%'
       AND NOT EXISTS (
         SELECT 1 FROM sanggahan s
         WHERE s.user_id = p_user
           AND s.tanggal = v_att.date
           AND s.status IN ('pending','approved')
       )
    THEN
      v_nc_deadline := ((v_att.date + COALESCE(v_att.shift_end, TIME '23:59')) AT TIME ZONE 'Asia/Makassar')
        + CASE WHEN v_att.crosses AND v_att.shift_end IS NOT NULL AND v_att.shift_end <= v_att.shift_start
               THEN INTERVAL '1 day' ELSE INTERVAL '0 minutes' END
        + INTERVAL '1 hour';
      IF (NOW() AT TIME ZONE 'Asia/Makassar') > v_nc_deadline THEN
        v_nc_days := v_nc_days + 1;
        v_details := v_details || jsonb_build_array(jsonb_build_object(
          'date', v_att.date, 'type', 'no_checkout', 'nominal',
          COALESCE((p_cfg->>'no_checkout_nominal')::numeric, 0)
        ));
      END IF;
    END IF;

    -- Pulang cepat: jam masuk & pulang terisi, pulang lebih awal dari
    -- akhir shift. TANPA guard date < v_today — begitu clock_out
    -- tercatat, hari itu sudah selesai dan potongan langsung berlaku
    -- (ini yang membuat pulang cepat hari ini tidak pernah tercatat).
    IF v_att.attendance_status IN ('hadir','terlambat')
       AND v_att.clock_in_time IS NOT NULL
       AND v_att.clock_out_time IS NOT NULL
       AND v_att.shift_end IS NOT NULL
       AND v_att.ss_working IS TRUE
       AND COALESCE(v_att.notes, '') NOT ILIKE '%dikoreksi via sanggahan%'
       AND NOT EXISTS (
         SELECT 1 FROM sanggahan s
         WHERE s.user_id = p_user
           AND s.tanggal = v_att.date
           AND s.status IN ('pending','approved')
       )
    THEN
      v_end_at := ((v_att.date + v_att.shift_end) AT TIME ZONE 'Asia/Makassar')
        + CASE WHEN v_att.crosses AND v_att.shift_end <= v_att.shift_start
               THEN INTERVAL '1 day' ELSE INTERVAL '0 minutes' END;
      v_early_sec := EXTRACT(EPOCH FROM (v_end_at - v_att.clock_out_time));
      IF v_early_sec > 0 THEN
        v_el_days := v_el_days + 1;
        v_el_minutes := CEIL(v_early_sec / 60.0)::int;
        v_details := v_details || jsonb_build_array(jsonb_build_object(
          'date', v_att.date, 'type', 'early_leave', 'minutes', v_el_minutes,
          'nominal', COALESCE((p_cfg->>'early_leave_nominal')::numeric, 0)
        ));
      END IF;
    END IF;
  END LOOP;

  v_alpha := GREATEST(v_workdays - v_hadir - v_izin - v_sakit, 0);
  v_daily := CASE WHEN v_workdays > 0 THEN ROUND(v_base / v_workdays, 2) ELSE 0 END;
  v_alpha_cut := ROUND(v_alpha * COALESCE((p_cfg->>'alpha_nominal_per_day')::numeric, 0), 2);
  v_nc_cut := ROUND(v_nc_days * COALESCE((p_cfg->>'no_checkout_nominal')::numeric, 0), 2);
  v_el_cut := ROUND(v_el_days * COALESCE((p_cfg->>'early_leave_nominal')::numeric, 0), 2);
  v_total_cut := v_late_cut + v_alpha_cut + v_nc_cut + v_el_cut;
  v_received := GREATEST(v_base - v_total_cut, 0);

  INSERT INTO payroll_lines (
    organization_id, user_id, period_month, base_component,
    work_days, hadir, terlambat, late_minutes_total,
    alpha_days, izin_days, sakit_days,
    no_checkout_days, no_checkout_deduction,
    early_leave_days, early_leave_deduction,
    daily_rate, late_deduction, alpha_deduction, total_deduction, total_received,
    config_snapshot, details, status, generated_by, generated_at
  ) VALUES (
    p_org, p_user, v_start, v_base,
    v_workdays, v_hadir, v_terlambat, v_late_total,
    v_alpha, v_izin, v_sakit,
    v_nc_days, v_nc_cut,
    v_el_days, v_el_cut,
    v_daily, v_late_cut, v_alpha_cut, v_total_cut, v_received,
    p_cfg, v_details, 'draft', p_generated_by, NOW()
  )
  ON CONFLICT (organization_id, user_id, period_month) DO UPDATE SET
    base_component = EXCLUDED.base_component,
    work_days = EXCLUDED.work_days,
    hadir = EXCLUDED.hadir,
    terlambat = EXCLUDED.terlambat,
    late_minutes_total = EXCLUDED.late_minutes_total,
    alpha_days = EXCLUDED.alpha_days,
    izin_days = EXCLUDED.izin_days,
    sakit_days = EXCLUDED.sakit_days,
    no_checkout_days = EXCLUDED.no_checkout_days,
    no_checkout_deduction = EXCLUDED.no_checkout_deduction,
    early_leave_days = EXCLUDED.early_leave_days,
    early_leave_deduction = EXCLUDED.early_leave_deduction,
    daily_rate = EXCLUDED.daily_rate,
    late_deduction = EXCLUDED.late_deduction,
    alpha_deduction = EXCLUDED.alpha_deduction,
    total_deduction = EXCLUDED.total_deduction,
    total_received = EXCLUDED.total_received,
    config_snapshot = EXCLUDED.config_snapshot,
    details = EXCLUDED.details,
    generated_by = EXCLUDED.generated_by,
    generated_at = NOW();
END;
$$;

-- =====================================================================
-- 2. create_sanggahan — hari hadir-tanpa-pulang HARI INI juga bisa
--    disanggah setelah batas absen pulang (jam selesai + 1 jam) lewat.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.create_sanggahan(
  p_tanggal DATE,
  p_reason TEXT,
  p_attachment_url TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_org UUID := current_org_id();
  v_today DATE := (now() AT TIME ZONE 'Asia/Makassar')::DATE;
  v_att RECORD;
  v_status TEXT;
  v_att_id UUID;
  v_end_t TIME;
  v_start_t TIME;
  v_cross BOOLEAN;
  v_nc_deadline TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL OR v_org IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Sesi tidak valid');
  END IF;

  IF p_tanggal IS NULL OR p_tanggal > v_today THEN
    RETURN json_build_object('success', false, 'error', 'Tanggal tidak valid');
  END IF;

  IF COALESCE(TRIM(p_reason), '') = '' THEN
    RETURN json_build_object('success', false, 'error', 'Alasan wajib diisi');
  END IF;

  -- Anti-double: maksimal satu pending per user per tanggal
  IF EXISTS (
    SELECT 1 FROM sanggahan
    WHERE user_id = v_uid AND tanggal = p_tanggal AND status = 'pending'
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Sudah ada sanggahan menunggu review untuk tanggal ini');
  END IF;

  -- Tanggal harus punya absensi ATAU jadwal kerja
  SELECT id, attendance_status::text AS st, clock_in_time, clock_out_time INTO v_att
  FROM attendance WHERE user_id = v_uid AND date = p_tanggal;
  IF FOUND THEN
    v_status := v_att.st;
    v_att_id := v_att.id;
    IF v_status IN ('alpha', 'terlambat') THEN
      NULL; -- jalur lama, tidak berubah
    ELSIF v_status = 'hadir'
          AND v_att.clock_in_time IS NOT NULL
          AND v_att.clock_out_time IS NULL THEN
      -- Hadir tapi tidak pernah absen pulang — sanggahan terbuka setelah
      -- batas absen pulang (jam selesai shift + 1 jam) terlewati, termasuk
      -- hari yang sama. Sebelum batas: ditolak dengan pesan jelas.
      SELECT ss.end_time, COALESCE(ss.crosses_midnight, false), ss.start_time
        INTO v_end_t, v_cross, v_start_t
      FROM shift_schedules ss
      WHERE ss.shift_code = v_att.shift_code
        AND ss.day_of_week = (EXTRACT(DOW FROM p_tanggal)::int + 6) % 7
        AND (ss.organization_id = v_org OR ss.organization_id IS NULL)
      ORDER BY ss.organization_id NULLS LAST
      LIMIT 1;
      v_nc_deadline := ((p_tanggal + COALESCE(v_end_t, TIME '23:59')) AT TIME ZONE 'Asia/Makassar')
        + CASE WHEN COALESCE(v_cross, false) AND v_end_t IS NOT NULL AND v_end_t <= COALESCE(v_start_t, v_end_t)
               THEN INTERVAL '1 day' ELSE INTERVAL '0 minutes' END
        + INTERVAL '1 hour';
      IF p_tanggal < v_today OR (NOW() AT TIME ZONE 'Asia/Makassar') > v_nc_deadline THEN
        v_status := 'tanpa_pulang';
      ELSE
        RETURN json_build_object('success', false, 'error', 'Batas absen pulang belum lewat — sanggahan terbuka 1 jam setelah jam selesai shift');
      END IF;
    ELSE
      RETURN json_build_object('success', false, 'error', 'Status ' || v_att.st || ' tidak dapat disanggah');
    END IF;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM employee_schedules WHERE user_id = v_uid AND date = p_tanggal) THEN
      RETURN json_build_object('success', false, 'error', 'Tidak ada absensi/jadwal kerja pada tanggal tersebut');
    END IF;
    v_status := 'alpha';
  END IF;

  INSERT INTO sanggahan (user_id, organization_id, tanggal, attendance_id, old_status, reason, attachment_url, status)
  VALUES (v_uid, v_org, p_tanggal, v_att_id, v_status, TRIM(p_reason), p_attachment_url, 'pending');

  RETURN json_build_object('success', true, 'message', 'Sanggahan terkirim, menunggu review admin');
END;
$$;

-- =====================================================================
-- 3. ensure_my_payroll_line — slip existing kini DIHITUNG ULANG (bukan
--    dilewati) agar potongan no_checkout tampil tepat setelah batas lewat.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.ensure_my_payroll_line(p_period DATE)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID;
  v_enabled BOOLEAN;
  v_cfg JSONB;
  v_period DATE := date_trunc('month', p_period)::date;
  v_existing INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Harus login');
  END IF;

  IF p_period IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Periode wajib diisi');
  END IF;

  -- Bulan berjalan dihitung WITA (Asia/Makassar) sesuai konvensi aplikasi
  IF v_period > date_trunc('month', NOW() AT TIME ZONE 'Asia/Makassar')::date THEN
    RETURN json_build_object('success', false, 'error', 'Tidak bisa membuat slip untuk bulan mendatang');
  END IF;

  SELECT organization_id INTO v_org FROM profiles WHERE id = auth.uid();
  IF v_org IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Profil belum terhubung instansi');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM system_settings
    WHERE organization_id = v_org AND setting_key = 'payroll_enabled' AND value = 'true'
  ) INTO v_enabled;
  IF NOT v_enabled THEN
    RETURN json_build_object('success', false, 'error', 'Modul Gaji belum diaktifkan untuk instansi ini');
  END IF;

  -- Slip sudah ada? Tetap DIHITUNG ULANG dari attendance — angka slip
  -- selalu segar (mis. potongan no_checkout yang baru memenuhi batas 1 jam
  -- setelah jam selesai shift). upsert_payroll_line adalah satu-satunya
  -- kalkulator; recalc admin memakai fungsi yang sama, jadi hasil identik.
  SELECT COUNT(*) INTO v_existing
  FROM payroll_lines
  WHERE organization_id = v_org AND user_id = auth.uid() AND period_month = v_period;

  IF NOT EXISTS (
    SELECT 1 FROM payroll_employee_config
    WHERE organization_id = v_org AND user_id = auth.uid() AND is_active
  ) THEN
    RETURN json_build_object('success', false, 'error',
      'Struktur gaji Anda belum diatur admin — hubungi admin instansi');
  END IF;

  SELECT COALESCE(
    (SELECT value::jsonb FROM system_settings
     WHERE organization_id = v_org AND setting_key = 'payroll_config'),
    '{"late_tiers":[{"min":1,"max":15,"nominal":5000},{"min":16,"max":30,"nominal":10000},{"min":31,"max":60,"nominal":25000},{"min":61,"max":null,"nominal":50000}],"alpha_nominal_per_day":100000}'::jsonb
  ) INTO v_cfg;

  PERFORM upsert_payroll_line(v_org, auth.uid(), v_period, v_cfg, auth.uid());

  RETURN json_build_object(
    'success', true,
    'existed', (v_existing > 0),
    'period', v_period,
    'message', CASE WHEN v_existing > 0 THEN 'Slip gaji diperbarui sesuai absensi terbaru' ELSE 'Slip gaji berhasil dibuat' END
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
