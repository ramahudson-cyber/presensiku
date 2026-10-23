-- ============================================================
-- MIGRATION: Uang lembur hanya dibayar bila pegawai absen pulang
-- ============================================================
-- Sebelumnya: upsert_payroll_line menjumlahkan semua lembur status 'approved'
-- pada periode, tanpa memeriksa absen pulang.
--
-- Sesudahnya: lembur hanya ikut dihitung bila ada absensi pada tanggal lembur
-- tersebut dengan clock_out_time terisi. Berlaku untuk mode per jam maupun
-- nominal tetap (borongan).
--
-- Trigger attendance_payroll_refresh sudah aktif pada UPDATE clock_out_time,
-- jadi slip ikut terhitung ulang begitu pegawai akhirnya absen pulang.
--
-- Pendekatan patch sama dengan migrasi payroll sebelumnya: fragmen body
-- diambil dari katalog, fragmen WAJIB ditemukan, dan migrasi gagal bila tidak.
-- ============================================================

DO $patch_ot_checkout$
DECLARE
  v_def TEXT;
  v_old TEXT := $q$    AND ot.status = 'approved'
    AND ot.date >= v_start$q$;
  v_new TEXT := $q$    AND ot.status = 'approved'
    AND EXISTS (
      SELECT 1 FROM attendance ca
      WHERE ca.user_id = ot.user_id
        AND ca.date = ot.date
        AND ca.clock_out_time IS NOT NULL
    )
    AND ot.date >= v_start$q$;
BEGIN
  v_def := pg_get_functiondef('public.upsert_payroll_line(uuid,uuid,date,jsonb,uuid)'::regprocedure);

  IF position('ca.clock_out_time IS NOT NULL' IN v_def) > 0 THEN
    RAISE NOTICE 'upsert_payroll_line sudah memeriksa absen pulang — dilewati';
    RETURN;
  END IF;

  IF position(v_old IN v_def) = 0 THEN
    RAISE EXCEPTION 'Fragmen lembur tidak ditemukan pada upsert_payroll_line. Patch dibatalkan.';
  END IF;

  EXECUTE replace(v_def, v_old, v_new);
  RAISE NOTICE 'upsert_payroll_line: lembur hanya dibayar bila absen pulang';
END;
$patch_ot_checkout$;

-- ----------------------------------------------------------------------------
-- Hitung ulang slip DRAFT yang saat ini memuat uang lembur, agar angka lama
-- ikut terkoreksi. Slip yang sudah final tidak disentuh.
-- ----------------------------------------------------------------------------
DO $recalc_ot_checkout$
DECLARE
  r RECORD;
  v_cfg JSONB;
BEGIN
  FOR r IN
    SELECT DISTINCT pl.organization_id, pl.user_id, pl.period_month, pl.generated_by
    FROM payroll_lines pl
    WHERE pl.status = 'draft'
      AND pl.overtime_amount > 0
  LOOP
    SELECT value::jsonb INTO v_cfg
    FROM system_settings
    WHERE organization_id = r.organization_id AND setting_key = 'payroll_config'
    LIMIT 1;
    IF v_cfg IS NULL THEN
      CONTINUE;
    END IF;
    PERFORM upsert_payroll_line(r.organization_id, r.user_id, r.period_month, v_cfg, r.generated_by);
  END LOOP;
END;
$recalc_ot_checkout$;

NOTIFY pgrst, 'reload schema';
