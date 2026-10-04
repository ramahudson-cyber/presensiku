-- =====================================================================
-- MENGHILANGKAN TOLERANSI TELAT 5 MENIT
--
-- Sebelumnya: latest_check_in dipaksa = start_time + 5 menit, sehingga
-- absen sampai menit ke-5 masih dianggap "hadir" (toleransi).
-- Sekarang: latest_check_in = start_time — telat dihitung mulai menit
-- pertama setelah jam mulai shift (presisi menit; absen dalam menit yang
-- sama dengan jam mulai masih dihitung tepat waktu).
--
-- Yang TIDAK berubah: kolom latest_check_in tetap dipaksa server-side
-- (bukan bebas diatur admin), guard absensi tetap membaca kolom ini,
-- payroll late_tiers tetap memicu dari flag is_late — telat 1-15 menit
-- kini masuk tier pertama (Rp5.000 dengan default config).
-- Hari libur tetap dipaksa netral 00:00.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Guard jadwal shift: latest_check_in = start_time (tanpa +5 menit)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION shift_schedule_time_guard() RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT NEW.is_working_day THEN
    -- Hari libur: paksa netral
    NEW.start_time := '00:00'::time;
    NEW.end_time := '00:00'::time;
    NEW.latest_check_in := '00:00'::time;
    RETURN NEW;
  END IF;

  -- Waktu wajib terisi & valid
  IF NEW.start_time IS NULL OR NEW.end_time IS NULL THEN
    RAISE EXCEPTION 'Jam mulai dan jam selesai wajib diisi untuk hari kerja';
  END IF;

  -- Shift lintas malam (crosses_midnight) valid walau end < start
  IF NOT NEW.crosses_midnight AND NEW.end_time <= NEW.start_time THEN
    RAISE EXCEPTION
      'Jam selesai % harus setelah jam mulai % — atau aktifkan mode lintas malam',
      NEW.end_time, NEW.start_time;
  END IF;

  -- latest_check_in dihitung server-side: sama dengan start_time
  -- (tanpa toleransi — telat dihitung mulai menit pertama setelah jam mulai)
  NEW.latest_check_in := NEW.start_time;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shift_schedule_time_guard ON shift_schedules;
CREATE TRIGGER trg_shift_schedule_time_guard
  BEFORE INSERT OR UPDATE ON shift_schedules
  FOR EACH ROW EXECUTE FUNCTION shift_schedule_time_guard();

-- ---------------------------------------------------------------------
-- 2. Normalisasi data eksisting: nilai tersimpan masih start+5.
--    UPDATE memicu trigger → semua baris ikut aturan baru (hari libur
--    otomatis kembali '00:00' oleh guard).
-- ---------------------------------------------------------------------
UPDATE shift_schedules SET latest_check_in = start_time;

NOTIFY pgrst, 'reload schema';
