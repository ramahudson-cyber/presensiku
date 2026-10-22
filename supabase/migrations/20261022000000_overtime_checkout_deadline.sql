-- ============================================================
-- MIGRATION: Lembur disetujui memperpanjang batas absen pulang
-- ============================================================
-- Masalah:
--   Batas absen pulang = jam selesai shift + 1 jam, baik di client
--   (AttendancePage) maupun di trigger server guard_attendance_self_write.
--   Pegawai yang lembur sampai 22:00 (shift SI selesai 20:00) diblokir
--   absen pulang sejak 21:00 → clock_out_time tetap NULL → kena potongan
--   "tidak absen pulang" di payroll.
--
-- Solusi:
--   Batas efektif = MAX(jam selesai shift, jam selesai lembur DISETUJUI) + 1 jam.
--   Hanya lembur berstatus 'approved' yang dihitung.
--
-- Pendekatan:
--   Fungsi guard_attendance_self_write dan upsert_payroll_line berukuran
--   besar dan sudah beberapa kali direvisi. Alih-alih menyalin ulang
--   seluruh body (rawan divergen), migrasi ini mengambil definisi AKTIF
--   dari katalog (pg_get_functiondef), mengganti SATU fragmen deadline,
--   lalu mengeksekusinya kembali. Bila fragmen tidak ditemukan, migrasi
--   GAGAL dengan pesan jelas — tidak pernah diam-diam tidak diterapkan.
--
-- Idempotent: patch yang sudah diterapkan terdeteksi dan dilewati.
-- ============================================================

-- ----------------------------------------------------------------------------
-- 1. Jam selesai lembur approved (TIMESTAMPTZ, WITA)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.overtime_approved_end(p_user UUID, p_date DATE)
RETURNS TIMESTAMPTZ
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT MAX(((p_date + ot.end_time::time) AT TIME ZONE 'Asia/Makassar'))
  FROM overtime_requests ot
  WHERE ot.user_id = p_user
    AND ot.date = p_date
    AND ot.status = 'approved'
    AND ot.end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$';
$$;

-- ----------------------------------------------------------------------------
-- 2. Batas absen pulang efektif (satu definisi untuk trigger & payroll)
--    = MAX(shift_end, overtime_end) + 1 jam
--    Shift malam: shift_end <= shift_start → +1 hari.
--    Lembur pagi setelah shift malam (end_time <= shift_start) → +1 hari.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.effective_checkout_deadline(
  p_user        UUID,
  p_date        DATE,
  p_shift_start TIME,
  p_shift_end   TIME,
  p_crosses     BOOLEAN
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shift_end TIMESTAMPTZ;
  v_ot_end    TIMESTAMPTZ;
  v_base      TIMESTAMPTZ;
BEGIN
  IF p_shift_end IS NULL THEN
    RETURN NULL;
  END IF;

  v_shift_end := ((p_date + p_shift_end) AT TIME ZONE 'Asia/Makassar');
  IF COALESCE(p_crosses, false)
     AND p_shift_start IS NOT NULL
     AND p_shift_end <= p_shift_start THEN
    v_shift_end := v_shift_end + INTERVAL '1 day';
  END IF;

  v_ot_end := overtime_approved_end(p_user, p_date);

  -- Shift malam: lembur yang selesai sebelum jam mulai shift (mis. 07:00–09:00)
  -- terjadi setelah tengah malam → geser satu hari.
  IF v_ot_end IS NOT NULL
     AND COALESCE(p_crosses, false)
     AND p_shift_start IS NOT NULL
     AND (v_ot_end AT TIME ZONE 'Asia/Makassar')::time <= p_shift_start THEN
    v_ot_end := v_ot_end + INTERVAL '1 day';
  END IF;

  v_base := GREATEST(v_shift_end, COALESCE(v_ot_end, v_shift_end));
  RETURN v_base + INTERVAL '1 hour';
END;
$$;

REVOKE ALL ON FUNCTION public.overtime_approved_end(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.overtime_approved_end(uuid, date) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.effective_checkout_deadline(uuid, date, time, time, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.effective_checkout_deadline(uuid, date, time, time, boolean) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. Patch guard_attendance_self_write — hanya baris deadline checkout
-- ----------------------------------------------------------------------------
DO $patch_guard$
DECLARE
  v_def TEXT;
  v_old TEXT := 'IF v_wita > v_end_at + INTERVAL ''1 hour'' THEN';
  v_new TEXT := 'IF (v_wita AT TIME ZONE ''Asia/Makassar'') > effective_checkout_deadline(OLD.user_id, OLD.date, v_start, v_end, v_crosses) THEN';
BEGIN
  v_def := pg_get_functiondef('public.guard_attendance_self_write()'::regprocedure);

  IF position(v_new IN v_def) > 0 THEN
    RAISE NOTICE 'guard_attendance_self_write sudah memakai deadline efektif — dilewati';
    RETURN;
  END IF;

  IF position(v_old IN v_def) = 0 THEN
    RAISE EXCEPTION 'Fragmen deadline guard tidak ditemukan. Patch dibatalkan agar tidak salah ubah.';
  END IF;

  v_def := replace(v_def, v_old, v_new);
  EXECUTE v_def;
  RAISE NOTICE 'guard_attendance_self_write: deadline checkout memakai lembur approved';
END;
$patch_guard$;

-- ----------------------------------------------------------------------------
-- 4. Patch upsert_payroll_line — deadline no_checkout memakai aturan sama
-- ----------------------------------------------------------------------------
DO $patch_payroll$
DECLARE
  v_def TEXT;
  v_old TEXT := $frag$      v_nc_deadline := ((v_att.date + COALESCE(v_att.shift_end, TIME '23:59')) AT TIME ZONE 'Asia/Makassar')
        + CASE WHEN v_att.crosses AND v_att.shift_end IS NOT NULL AND v_att.shift_end <= v_att.shift_start
               THEN INTERVAL '1 day' ELSE INTERVAL '0 minutes' END
        + INTERVAL '1 hour';$frag$;
  v_new TEXT := $frag$      v_nc_deadline := effective_checkout_deadline(
        p_user, v_att.date, v_att.shift_start, COALESCE(v_att.shift_end, TIME '23:59'), COALESCE(v_att.crosses, false)
      );$frag$;
BEGIN
  v_def := pg_get_functiondef('public.upsert_payroll_line(uuid,uuid,date,jsonb,uuid)'::regprocedure);

  IF position(v_new IN v_def) > 0 THEN
    RAISE NOTICE 'upsert_payroll_line sudah memakai deadline efektif — dilewati';
    RETURN;
  END IF;

  IF position(v_old IN v_def) = 0 THEN
    RAISE EXCEPTION 'Fragmen deadline payroll tidak ditemukan. Patch dibatalkan agar tidak salah ubah.';
  END IF;

  v_def := replace(v_def, v_old, v_new);
  EXECUTE v_def;
  RAISE NOTICE 'upsert_payroll_line: no_checkout memakai deadline efektif';
END;
$patch_payroll$;

NOTIFY pgrst, 'reload schema';
