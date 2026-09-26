-- =====================================================================
-- RPC recalculate_payroll(p_period DATE)
-- - caller: org admin (is_org_admin) / superadmin switched
-- - guard: modul gaji harus aktif (payroll_enabled = 'true' untuk org)
-- - alpha dihitung deterministik server-side
-- - potongan keterlambatan = NOMINAL per tier menit (dari payroll_config)
-- - potongan alpha = hari alpha x nominal/hari (dari payroll_config)
-- - hasil: upsert snapshot payroll_lines
-- =====================================================================

CREATE OR REPLACE FUNCTION recalculate_payroll(p_period DATE)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID;
  v_start DATE;
  v_end DATE;
  v_cfg JSONB;
  v_enabled BOOLEAN;
  v_count INT := 0;
  v_user RECORD;
  v_workdays INT;
  v_hadir INT;
  v_terlambat INT;
  v_izin INT;
  v_sakit INT;
  v_late_total INT;
  v_alpha INT;
  v_daily NUMERIC(14,2);
  v_late_cut NUMERIC(14,2);
  v_alpha_cut NUMERIC(14,2);
  v_total_cut NUMERIC(14,2);
  v_received NUMERIC(14,2);
  v_details JSONB;
  v_tier JSONB;
  v_nominal NUMERIC(14,2);
  v_att RECORD;
  v_uid UUID;
  v_base NUMERIC(14,2);
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

  -- Guard modul: harus sudah diaktifkan admin instansi
  SELECT EXISTS(
    SELECT 1 FROM system_settings
    WHERE organization_id = v_org AND setting_key = 'payroll_enabled' AND value = 'true'
  ) INTO v_enabled;
  IF NOT v_enabled THEN
    RETURN json_build_object('success', false, 'error', 'Modul Gaji belum diaktifkan untuk instansi ini');
  END IF;

  v_start := date_trunc('month', p_period)::date;
  v_end   := (date_trunc('month', p_period) + INTERVAL '1 month - 1 day')::date;

  -- Konfigurasi potongan (default jika belum pernah diset admin)
  SELECT COALESCE(
    (SELECT value::jsonb FROM system_settings
     WHERE organization_id = v_org AND setting_key = 'payroll_config'),
    '{"late_tiers":[{"min":1,"max":15,"nominal":5000},{"min":16,"max":30,"nominal":10000},{"min":31,"max":60,"nominal":25000},{"min":61,"max":null,"nominal":50000}],"alpha_nominal_per_day":100000}'::jsonb
  ) INTO v_cfg;

  FOR v_user IN
    SELECT c.user_id, c.base_component AS v_base_component
    FROM payroll_employee_config c
    WHERE c.organization_id = v_org AND c.is_active
  LOOP
    v_uid := v_user.user_id;
    v_base := v_user.v_base_component;

    -- Hari kerja terjadwal bulan ini (shift is_working_day)
    SELECT COUNT(*) INTO v_workdays
    FROM employee_schedules es
    JOIN shift_schedules ss
      ON ss.organization_id = es.organization_id
     AND ss.shift_code = es.shift_code
     AND ss.day_of_week = (EXTRACT(ISODOW FROM es.date)::int - 1)
    WHERE es.user_id = v_uid
      AND es.date BETWEEN v_start AND v_end
      AND ss.is_working_day;

    -- Rekap attendance
    v_hadir := 0; v_terlambat := 0; v_izin := 0; v_sakit := 0;
    v_late_total := 0; v_late_cut := 0; v_details := '[]'::jsonb;

    FOR v_att IN
      SELECT date, attendance_status, is_late, late_minutes
      FROM attendance
      WHERE user_id = v_uid
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

        -- Cari tier nominal sesuai menit keterlambatan
        v_nominal := 0;
        FOR v_tier IN SELECT * FROM jsonb_array_elements(COALESCE(v_cfg->'late_tiers', '[]'::jsonb))
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

    -- Alpha deterministik: hari kerja terjadwal yang tidak hadir/izin/sakit
    v_alpha := GREATEST(v_workdays - v_hadir - v_izin - v_sakit, 0);

    v_daily := CASE WHEN v_workdays > 0 THEN ROUND(v_base / v_workdays, 2) ELSE 0 END;
    v_alpha_cut := ROUND(v_alpha * COALESCE((v_cfg->>'alpha_nominal_per_day')::numeric, 0), 2);
    v_total_cut := v_late_cut + v_alpha_cut;
    v_received := GREATEST(v_base - v_total_cut, 0);

    INSERT INTO payroll_lines (
      organization_id, user_id, period_month, base_component,
      work_days, hadir, terlambat, late_minutes_total,
      alpha_days, izin_days, sakit_days,
      daily_rate, late_deduction, alpha_deduction, total_deduction, total_received,
      config_snapshot, details, status, generated_by, generated_at
    ) VALUES (
      v_org, v_uid, v_start, v_base,
      v_workdays, v_hadir, v_terlambat, v_late_total,
      v_alpha, v_izin, v_sakit,
      v_daily, v_late_cut, v_alpha_cut, v_total_cut, v_received,
      v_cfg, v_details, 'draft', auth.uid(), NOW()
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

    v_count := v_count + 1;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'period', v_start,
    'employees', v_count,
    'message', 'Rekap ' || v_count || ' pegawai dihitung ulang dari absensi'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION recalculate_payroll(date) FROM anon, public;
GRANT EXECUTE ON FUNCTION recalculate_payroll(date) TO authenticated;
