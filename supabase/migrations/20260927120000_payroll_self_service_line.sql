-- =====================================================================
-- PAYROLL SELF-SERVICE: pegawai bisa membuat slip gaji untuk bulan
-- lampau miliknya sendiri (mis. bulan yang terlewat karena tidak ada
-- aktivitas absensi yang memicu trigger auto-refresh).
-- Aturan: hanya periode <= bulan berjalan (WITA), hanya untuk diri
-- sendiri, dan TIDAK menimpa baris yang sudah ada (angka dari admin
-- tetap utuh). Butuh payroll_employee_config aktif + modul gaji on.
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

  -- Slip sudah ada? Pakai yang ada — jangan menimpa angka dari admin.
  SELECT COUNT(*) INTO v_existing
  FROM payroll_lines
  WHERE organization_id = v_org AND user_id = auth.uid() AND period_month = v_period;
  IF v_existing > 0 THEN
    RETURN json_build_object('success', true, 'existed', true, 'message', 'Slip periode ini sudah tersedia');
  END IF;

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
    'existed', false,
    'period', v_period,
    'message', 'Slip gaji berhasil dibuat'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ensure_my_payroll_line(DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_my_payroll_line(DATE) TO authenticated;
