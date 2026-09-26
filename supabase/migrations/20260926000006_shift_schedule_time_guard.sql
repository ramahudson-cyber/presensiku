-- =====================================================================
-- BACKEND GUARD: shift_schedules — validasi waktu + latest_check_in
-- server-side (sumber kebenaran tunggal; tidak lagi bergantung client)
-- =====================================================================

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

  -- latest_check_in dihitung server-side: start_time + 5 menit toleransi
  NEW.latest_check_in := NEW.start_time + INTERVAL '5 minutes';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shift_schedule_time_guard ON shift_schedules;
CREATE TRIGGER trg_shift_schedule_time_guard
  BEFORE INSERT OR UPDATE ON shift_schedules
  FOR EACH ROW EXECUTE FUNCTION shift_schedule_time_guard();
