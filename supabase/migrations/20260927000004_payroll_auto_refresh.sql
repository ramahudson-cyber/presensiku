-- =====================================================================
-- PAYROLL AUTO-REFRESH: absensi masuk → baris gaji user itu dihitung
-- ulang otomatis (bila modul gaji aktif untuk instansinya & pegawai
-- punya config gaji). Trigger AFTER INSERT/UPDATE ON attendance.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Inti perhitungan SATU user untuk satu bulan — dipakai trigger &
--    recalculate_payroll (satu sumber logika).
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
    SELECT date, attendance_status, is_late, late_minutes
    FROM attendance
    WHERE user_id = p_user
      AND date BETWEEN v_start AND v_end
      AND attendance_status IN ('hadir','terlambat','izin','sakit','alpha')
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
  END LOOP;

  v_alpha := GREATEST(v_workdays - v_hadir - v_izin - v_sakit, 0);
  v_daily := CASE WHEN v_workdays > 0 THEN ROUND(v_base / v_workdays, 2) ELSE 0 END;
  v_alpha_cut := ROUND(v_alpha * COALESCE((p_cfg->>'alpha_nominal_per_day')::numeric, 0), 2);
  v_total_cut := v_late_cut + v_alpha_cut;
  v_received := GREATEST(v_base - v_total_cut, 0);

  INSERT INTO payroll_lines (
    organization_id, user_id, period_month, base_component,
    work_days, hadir, terlambat, late_minutes_total,
    alpha_days, izin_days, sakit_days,
    daily_rate, late_deduction, alpha_deduction, total_deduction, total_received,
    config_snapshot, details, status, generated_by, generated_at
  ) VALUES (
    p_org, p_user, v_start, v_base,
    v_workdays, v_hadir, v_terlambat, v_late_total,
    v_alpha, v_izin, v_sakit,
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
-- 2. Fungsi trigger: hanya jalan bila modul aktif untuk org attendance
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION attendance_payroll_refresh() RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID := COALESCE(NEW.organization_id, OLD.organization_id);
  v_enabled BOOLEAN;
  v_cfg JSONB;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM system_settings
    WHERE organization_id = v_org AND setting_key = 'payroll_enabled' AND value = 'true'
  ) INTO v_enabled;
  IF NOT v_enabled THEN RETURN COALESCE(NEW, OLD); END IF;

  SELECT COALESCE(
    (SELECT value::jsonb FROM system_settings
     WHERE organization_id = v_org AND setting_key = 'payroll_config'),
    '{"late_tiers":[{"min":1,"max":15,"nominal":5000},{"min":16,"max":30,"nominal":10000},{"min":31,"max":60,"nominal":25000},{"min":61,"max":null,"nominal":50000}],"alpha_nominal_per_day":100000}'::jsonb
  ) INTO v_cfg;

  PERFORM upsert_payroll_line(
    v_org,
    COALESCE(NEW.user_id, OLD.user_id),
    date_trunc('month', COALESCE(NEW.date, OLD.date))::date,
    v_cfg,
    COALESCE(NEW.user_id, OLD.user_id)
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_attendance_payroll_refresh ON attendance;
CREATE TRIGGER trg_attendance_payroll_refresh
  AFTER INSERT OR UPDATE OF attendance_status, is_late, late_minutes, date ON attendance
  FOR EACH ROW EXECUTE FUNCTION attendance_payroll_refresh();

-- ---------------------------------------------------------------------
-- 3. recalculate_payroll: refactor memakai upsert_payroll_line
--    (logika identik, tanpa duplikasi)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION recalculate_payroll(p_period DATE)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID;
  v_enabled BOOLEAN;
  v_cfg JSONB;
  v_count INT := 0;
  v_user RECORD;
BEGIN
  IF NOT is_org_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Hanya admin instansi');
  END IF;

  v_org := current_org_id();
  IF v_org IS NULL THEN
    RETURN json_build_object('success', false, 'error',
      'Pilih instansi dulu: Kelola Instansi → Masuk sebagai Admin');
  END IF;

  IF p_period IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Periode wajib diisi');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM system_settings
    WHERE organization_id = v_org AND setting_key = 'payroll_enabled' AND value = 'true'
  ) INTO v_enabled;
  IF NOT v_enabled THEN
    RETURN json_build_object('success', false, 'error', 'Modul Gaji belum diaktifkan untuk instansi ini');
  END IF;

  SELECT COALESCE(
    (SELECT value::jsonb FROM system_settings
     WHERE organization_id = v_org AND setting_key = 'payroll_config'),
    '{"late_tiers":[{"min":1,"max":15,"nominal":5000},{"min":16,"max":30,"nominal":10000},{"min":31,"max":60,"nominal":25000},{"min":61,"max":null,"nominal":50000}],"alpha_nominal_per_day":100000}'::jsonb
  ) INTO v_cfg;

  FOR v_user IN
    SELECT user_id FROM payroll_employee_config
    WHERE organization_id = v_org AND is_active
  LOOP
    PERFORM upsert_payroll_line(v_org, v_user.user_id, p_period, v_cfg, auth.uid());
    v_count := v_count + 1;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'period', date_trunc('month', p_period)::date,
    'employees', v_count,
    'message', 'Rekap ' || v_count || ' pegawai dihitung ulang dari absensi'
  );
END;
$$;
