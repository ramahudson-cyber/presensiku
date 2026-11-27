-- ============================================================
-- MIGRATION: Jam lembur di slip ikut aturan bertingkat
-- ============================================================
-- Lanjutan 20261127010000: rupiah lembur sudah dibayar bertingkat
-- (tidak masuk = 0, lupa pulang = dipotong, lengkap = penuh), tetapi
-- kolom `overtime_hours` masih menjumlah SEMUA lembur approved — termasuk
-- yang tidak dibayar. Akibatnya slip bisa menampilkan "16 jam" padahal
-- uangnya hanya untuk 8 jam.
--
-- Migrasi ini menyelaraskan jam dengan rupiah: jam hanya dihitung untuk
-- lembur yang benar-benar dibayar (ada absen masuk).
--
-- Mode 'fixed' (borongan) tetap 0 jam seperti sebelumnya — memang bukan
-- upah per jam.
--
-- Pendekatan: ambil definisi AKTIF, ganti fragmen jam, fragmen WAJIB
-- ditemukan. Idempotent.
-- ============================================================

DO $patch_hours$
DECLARE
  v_def TEXT;
  v_marker TEXT := 'jam hanya dihitung untuk lembur yang dibayar';

  v_old TEXT := $q$  SELECT
    COALESCE(SUM(CASE WHEN COALESCE(ot.pay_mode, 'hourly') = 'hourly'
                      THEN ot.approved_hours ELSE 0 END), 0),$q$;

  v_new TEXT := $q$  -- Jam hanya dihitung untuk lembur yang dibayar (ada absen masuk),
  -- agar kolom jam sejalan dengan kolom rupiah di slip.
  SELECT
    COALESCE(SUM(CASE WHEN COALESCE(ot.pay_mode, 'hourly') = 'hourly'
                      AND EXISTS (
                        SELECT 1 FROM attendance ca
                        WHERE ca.user_id = ot.user_id
                          AND ca.date = CASE WHEN ot.end_time::time <= ot.start_time::time
                                             THEN ot.date + 1 ELSE ot.date END
                          AND ca.clock_in_time IS NOT NULL
                      )
                      THEN ot.approved_hours ELSE 0 END), 0),$q$;
BEGIN
  v_def := replace(pg_get_functiondef('public.upsert_payroll_line(uuid,uuid,date,jsonb,uuid)'::regprocedure), chr(13), '');

  IF position(v_marker IN v_def) > 0 THEN
    RAISE NOTICE 'overtime_hours sudah diselaraskan — dilewati';
    RETURN;
  END IF;

  IF position(v_old IN v_def) = 0 THEN
    RAISE EXCEPTION 'Fragmen jam lembur tidak ditemukan. Patch dibatalkan.';
  END IF;

  v_def := replace(v_def, v_old, v_new);
  EXECUTE v_def;
  RAISE NOTICE 'upsert_payroll_line: jam lembur hanya dihitung bila dibayar';
END;
$patch_hours$;

NOTIFY pgrst, 'reload schema';
