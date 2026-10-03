-- =====================================================================
-- POTONGAN "TIDAK ABSEN PULANG"
--
-- Pegawai yang absen masuk tapi TIDAK PERNAH absen pulang tidak lagi
-- bisa lolos dari payroll. Deteksi butuh clock_in_time/clock_out_time
-- yang sebelumnya tidak pernah dipakai logika gaji.
--
--Aturan main:
--   --status hadir/terlambat, jam masuk terisi, jam pulang kosong
--   - hanya tanggal yang SUDAH lewat (bukan hari yang sedang berjalan)
--   - dikecualikan bila ada sanggah pending/approved (sedang/selesai
--     dikoreksi admin) atau catatan "dikoreksi via sanggahan"
--   - nominal per kejadian, diatur admin lewat payroll_config
--     (no_checkout_nominal, default 0 = belum memotong)
--
-- Tidak ada perubahan pada tabel attendance atau alur absensi —
-- fitur ini murni perhitungan gaji.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Kolom baru di payroll_lines (aditif)
-- ---------------------------------------------------------------------
ALTER TABLE payroll_lines
  ADD COLUMN IF NOT EXISTS no_checkout_days INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS no_checkout_deduction NUMERIC(14,2) NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------
-- 1b. Lubang yang harus ditutup: kolom clock_out_time punya DEFAULT
--     now(). Jalur insert yang tidak menyebut kolom itu (mis.
--     attendanceService.js) otomatis terisi jam pulang saat absen masuk —
--     pegawai terlihat "sudah pulang" padahal tidak. Ambil/checkout
--     selalu lewat trigger yang memaksa waktu server, jadi default
--     tidak dibutuhkan dan hanya bisa mengacaukan payroll.
-- ---------------------------------------------------------------------
ALTER TABLE attendance ALTER COLUMN clock_out_time DROP DEFAULT;

-- ---------------------------------------------------------------------
-- 2. Seed key baru ke payroll_config tiap org yang belum punya.
--    Hanya menambah key — late_tiers & alpha_nominal_per_day tidak
--    disentuh. Nilai 0 = deteksi jalan, pemotongan belum aktif sampai
--    admin mengisi nominalnya di tab Aturan Potongan.
-- ---------------------------------------------------------------------
UPDATE system_settings
SET value = (value::jsonb || '{"no_checkout_nominal":0}'::jsonb)::text,
    updated_at = NOW()
WHERE setting_key = 'payroll_config'
  AND COALESCE(value, '') <> ''
  AND NOT (value::jsonb ? 'no_checkout_nominal');

-- ---------------------------------------------------------------------
-- 3. Inti perhitungan (satu sumber logika) — versi + tidak absen pulang
-- ---------------------------------------------------------------------
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
  v_nc_nominal NUMERIC(14,2);
  v_nc_cut NUMERIC(14,2) := 0;
  v_total_cut NUMERIC(14,2);
  v_received NUMERIC(14,2);
  v_details JSONB := '[]'::jsonb;
  v_att RECORD;
  v_tier JSONB;
  v_nominal NUMERIC(14,2);
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
           a.clock_in_time, a.clock_out_time, a.notes
    FROM attendance a
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

    -- Tidak absen pulang: jam masuk ada, jam pulang kosong, hari sudah lewat
    IF v_att.attendance_status IN ('hadir','terlambat')
       AND v_att.clock_in_time IS NOT NULL
       AND v_att.clock_out_time IS NULL
       AND v_att.date < v_today
       AND COALESCE(v_att.notes, '') NOT ILIKE '%dikoreksi via sanggahan%'
       AND NOT EXISTS (
         SELECT 1 FROM sanggahan s
         WHERE s.user_id = p_user
           AND s.tanggal = v_att.date
           AND s.status IN ('pending','approved')
       )
    THEN
      v_nc_days := v_nc_days + 1;
      v_nc_nominal := COALESCE((p_cfg->>'no_checkout_nominal')::numeric, 0);
      v_details := v_details || jsonb_build_array(jsonb_build_object(
        'date', v_att.date, 'type', 'no_checkout', 'nominal', v_nc_nominal
      ));
    END IF;
  END LOOP;

  v_alpha := GREATEST(v_workdays - v_hadir - v_izin - v_sakit, 0);
  v_daily := CASE WHEN v_workdays > 0 THEN ROUND(v_base / v_workdays, 2) ELSE 0 END;
  v_alpha_cut := ROUND(v_alpha * COALESCE((p_cfg->>'alpha_nominal_per_day')::numeric, 0), 2);
  v_nc_cut := ROUND(v_nc_days * COALESCE((p_cfg->>'no_checkout_nominal')::numeric, 0), 2);
  v_total_cut := v_late_cut + v_alpha_cut + v_nc_cut;
  v_received := GREATEST(v_base - v_total_cut, 0);

  INSERT INTO payroll_lines (
    organization_id, user_id, period_month, base_component,
    work_days, hadir, terlambat, late_minutes_total,
    alpha_days, izin_days, sakit_days,
    no_checkout_days, no_checkout_deduction,
    daily_rate, late_deduction, alpha_deduction, total_deduction, total_received,
    config_snapshot, details, status, generated_by, generated_at
  ) VALUES (
    p_org, p_user, v_start, v_base,
    v_workdays, v_hadir, v_terlambat, v_late_total,
    v_alpha, v_izin, v_sakit,
    v_nc_days, v_nc_cut,
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

-- ---------------------------------------------------------------------
-- 4. Trigger: tambahkan clock_out_time supaya saat pegawai akhirnya
--    absen pulang, potongan hari itu otomatis hilang dari slip gaji.
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_attendance_payroll_refresh ON attendance;
CREATE TRIGGER trg_attendance_payroll_refresh
  AFTER INSERT OR UPDATE OF attendance_status, is_late, late_minutes, date, clock_out_time ON attendance
  FOR EACH ROW EXECUTE FUNCTION attendance_payroll_refresh();

-- ---------------------------------------------------------------------
-- 5. Backfill baris gaji yang sudah ada: hitung ulang jumlah hari tanpa
--    absen pulang dari data absensi, lalu sesuaikan total potongan.
-- ---------------------------------------------------------------------
UPDATE payroll_lines pl
SET no_checkout_days = COALESCE(v_days.d, 0),
    no_checkout_deduction = ROUND(COALESCE(v_days.d, 0) * COALESCE(
      (pl.config_snapshot->>'no_checkout_nominal')::numeric, 0), 2),
    total_deduction = pl.late_deduction + pl.alpha_deduction
      + ROUND(COALESCE(v_days.d, 0) * COALESCE(
        (pl.config_snapshot->>'no_checkout_nominal')::numeric, 0), 2),
    total_received = GREATEST(pl.base_component - pl.late_deduction - pl.alpha_deduction
      - ROUND(COALESCE(v_days.d, 0) * COALESCE(
        (pl.config_snapshot->>'no_checkout_nominal')::numeric, 0), 2), 0),
    generated_at = NOW()
FROM (
  SELECT pl2.id, (
    SELECT COUNT(*)
    FROM attendance a
    WHERE a.user_id = pl2.user_id
      AND a.date BETWEEN pl2.period_month
                     AND (date_trunc('month', pl2.period_month) + INTERVAL '1 month - 1 day')::date
      AND a.attendance_status IN ('hadir','terlambat')
      AND a.clock_in_time IS NOT NULL
      AND a.clock_out_time IS NULL
      AND a.date < (NOW() AT TIME ZONE 'Asia/Makassar')::date
      AND COALESCE(a.notes, '') NOT ILIKE '%dikoreksi via sanggahan%'
      AND NOT EXISTS (
        SELECT 1 FROM sanggahan s
        WHERE s.user_id = pl2.user_id
          AND s.tanggal = a.date
          AND s.status IN ('pending','approved')
      )
  ) AS d
  FROM payroll_lines pl2
) v_days
WHERE pl.id = v_days.id;

NOTIFY pgrst, 'reload schema';
