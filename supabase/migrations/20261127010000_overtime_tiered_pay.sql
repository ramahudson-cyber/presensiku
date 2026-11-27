-- ============================================================
-- MIGRATION: Nominal lembur dibayar bertingkat, bukan hangus total
-- ============================================================
-- Masalah:
--   Aturan lama (migration 20261023000000) membayar lembur HANYA bila ada
--   absen pulang. Akibatnya pegawai yang LUPA absen pulang kehilangan
--   seluruh nominal, padahal jelas-jelas bekerja. Sebaliknya, melonggarkan
--   syarat sepenuhnya salah: pegawai yang TIDAK DATANG sama sekali akan
--   tetap dibayar penuh.
--
-- Solusi — tiga tingkat, dibedakan berdasarkan bukti kehadiran:
--   1. Tidak absen masuk sama sekali      → TIDAK dibayar (Rp0).
--      Tidak ada bukti bekerja; ini bukan "lupa absen", tapi tidak hadir.
--   2. Absen masuk, tidak absen pulang    → DIPOTONG sebagian.
--      Sudah terbukti datang; yang kurang hanya bukti selesai.
--   3. Absen masuk + absen pulang         → dibayar PENUH.
--
--   Potongan kasus 2 memakai `overtime_no_checkout_nominal` pada
--   payroll_config (default Rp5.000), sejalan dengan pola potongan lain
--   (no_checkout_nominal, alpha_nominal_per_day) yang sudah ada. Admin bisa
--   mengubahnya di Pengaturan Gaji tanpa deploy ulang.
--
--   Potongan TIDAK boleh melebihi nominal lembur itu sendiri (LEAST), jadi
--   lembur kecil tidak menjadi minus. Nominal bersih disimpan ke
--   `payroll_lines.overtime_amount` sehingga angka di layar = slip gaji.
--
-- Dampak ke aturan lain:
--   - Baris absensi lembur tanpa jadwal (shift_code NULL) tetap tidak
--     dihitung sebagai hari hadir & tidak kena potongan no_checkout —
--     penjagaan dari migration 20261127000000 dipertahankan.
--   - Lembur yang belum absen pulang TETAP tampil di riwayat pegawai dengan
--     keterangan, hanya nilainya sudah dipotong.
--
-- Pendekatan patch: definisi AKTIF diambil dari katalog, body dinormalkan
-- (\r dibuang), fragmen WAJIB ditemukan — migrasi GAGAL bila tidak cocok.
-- Idempotent: patch yang sudah ada terdeteksi dan dilewati.
-- ============================================================

-- ----------------------------------------------------------------------------
-- 1. Pastikan kunci konfigurasi potongan lembur ada (default Rp5.000)
-- ----------------------------------------------------------------------------
UPDATE system_settings
SET value = (value::jsonb || '{"overtime_no_checkout_nominal":5000}'::jsonb)::text
WHERE setting_key = 'payroll_config'
  AND NOT (value::jsonb ? 'overtime_no_checkout_nominal');

-- ----------------------------------------------------------------------------
-- 2. upsert_payroll_line — hitung lembur bertingkat
-- ----------------------------------------------------------------------------
DO $patch_overtime_tier$
DECLARE
  v_def  TEXT;
  v_marker TEXT := 'overtime_no_checkout_nominal';

  -- Fragmen diambil persis dari definisi aktif (lihat .tmp/frag_select.txt).
  v_sel_old TEXT := $q$  SELECT COALESCE(SUM(CASE WHEN COALESCE(ot.pay_mode, 'hourly') = 'hourly'
                                         THEN ot.approved_hours ELSE 0 END), 0),
         COALESCE(SUM(ot.pay_amount), 0)
    INTO v_ot_hours, v_ot_amount
  FROM overtime_requests ot
  WHERE ot.user_id = p_user
    AND ot.organization_id = p_org
    AND ot.status = 'approved'
    AND EXISTS (
      SELECT 1 FROM attendance ca
      WHERE ca.user_id = ot.user_id
        AND ca.clock_out_time IS NOT NULL
        AND ca.date = CASE WHEN ot.end_time::time <= ot.start_time::time
                           THEN ot.date + 1 ELSE ot.date END
    )
    AND ot.date >= v_start
    AND ot.date <= v_end;$q$;

  v_sel_new TEXT := $q$  -- Lembur dibayar BERTINGKAT menurut bukti kehadiran:
  --   tidak absen masuk  -> tidak dibayar (tidak ada bukti bekerja)
  --   masuk tanpa pulang -> dibayar, dipotong overtime_no_checkout_nominal
  --   masuk + pulang     -> dibayar penuh
  -- Potongan tidak bisa melebihi nominal lembur (LEAST), jadi tidak minus.
  SELECT
    COALESCE(SUM(CASE WHEN COALESCE(ot.pay_mode, 'hourly') = 'hourly'
                      THEN ot.approved_hours ELSE 0 END), 0),
    COALESCE(SUM(
      CASE
        WHEN NOT EXISTS (
          SELECT 1 FROM attendance ca
          WHERE ca.user_id = ot.user_id
            AND ca.date = CASE WHEN ot.end_time::time <= ot.start_time::time
                               THEN ot.date + 1 ELSE ot.date END
            AND ca.clock_in_time IS NOT NULL
        ) THEN 0
        WHEN NOT EXISTS (
          SELECT 1 FROM attendance ca
          WHERE ca.user_id = ot.user_id
            AND ca.date = CASE WHEN ot.end_time::time <= ot.start_time::time
                               THEN ot.date + 1 ELSE ot.date END
            AND ca.clock_out_time IS NOT NULL
        ) THEN GREATEST(
          COALESCE(ot.pay_amount, 0)
            - LEAST(
                COALESCE(ot.pay_amount, 0),
                COALESCE((p_cfg->>'overtime_no_checkout_nominal')::numeric, 5000)
              ),
          0)
        ELSE COALESCE(ot.pay_amount, 0)
      END
    ), 0)
    INTO v_ot_hours, v_ot_amount
  FROM overtime_requests ot
  WHERE ot.user_id = p_user
    AND ot.organization_id = p_org
    AND ot.status = 'approved'
    AND ot.date >= v_start
    AND ot.date <= v_end;$q$;
BEGIN
  v_def := replace(pg_get_functiondef('public.upsert_payroll_line(uuid,uuid,date,jsonb,uuid)'::regprocedure), chr(13), '');

  IF position(v_marker IN v_def) > 0 THEN
    RAISE NOTICE 'upsert_payroll_line sudah memakai pembayaran bertingkat — dilewati';
    RETURN;
  END IF;

  IF position(v_sel_old IN v_def) = 0 THEN
    RAISE EXCEPTION 'Fragmen perhitungan lembur tidak ditemukan. Patch dibatalkan agar tidak salah ubah.';
  END IF;

  v_def := replace(v_def, v_sel_old, v_sel_new);
  EXECUTE v_def;
  RAISE NOTICE 'upsert_payroll_line: lembur dibayar bertingkat (tidak masuk=0, lupa pulang=dipotong, lengkap=penuh)';
END;
$patch_overtime_tier$;

-- ----------------------------------------------------------------------------
-- 3. Hitung ulang slip DRAFT yang punya lembur approved, agar angka lama
--    ikut aturan baru. Slip final tidak disentuh.
-- ----------------------------------------------------------------------------
DO $recalc_overtime_tier$
DECLARE
  r RECORD;
  v_cfg JSONB;
BEGIN
  FOR r IN
    SELECT DISTINCT pl.organization_id, pl.user_id, pl.period_month, pl.generated_by
    FROM payroll_lines pl
    WHERE pl.status = 'draft'
      AND EXISTS (
        SELECT 1 FROM overtime_requests ot
        WHERE ot.user_id = pl.user_id
          AND ot.organization_id = pl.organization_id
          AND ot.status = 'approved'
          AND ot.date >= pl.period_month::date
          AND ot.date <  (pl.period_month::date + INTERVAL '1 month')
      )
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
  RAISE NOTICE 'Slip DRAFT dengan lembur dihitung ulang memakai aturan bertingkat';
END;
$recalc_overtime_tier$;

NOTIFY pgrst, 'reload schema';
