-- =====================================================================
-- PEMBATALAN PERSETUJUAN SANGGAHAN (cancel approved)
--
-- Masalah yang diselesaikan: saat sanggahan disetujui, absensi asli
-- DITIMPA (status jadi hadir, jam masuk/pulang dikosongkan, notes
-- diberi penanda). Tanpa jejak asli, persetujuan tidak bisa diurung.
--
-- Solusi:
--   1. Kolom revert_snapshot JSONB — review_sanggahan (approve) kini
--      menyimpan keadaan ASLI baris attendance sebelum dikoreksi
--      (status, is_late, late_minutes, jam masuk/pulang, notes) atau
--      penanda bahwa baris absensi dibuat baru (existed=false).
--   2. Status baru 'cancelled' + RPC cancel_sanggahan_approval (admin):
--      - snapshot ada → absensi dipulihkan persis seperti semula
--        (atau baris buatan approve dihapus bila memang baru dibuat)
--      - sanggahan LAMA tanpa snapshot → hanya jenis yang pasti
--        dapat dipulihkan: 'alpha' (status alpha tanpa jam) dan
--        'belum' (hari bebas buatan approve → baris dihapus).
--        'terlambat'/'tanpa_pulang' lama ditolak karena jam asli
--        sudah hilang — memulihkan nilai tebakan bisa merusak payroll.
--   3. Alasan pembatalan wajib (audit): cancel_reason/cancelled_by/
--      cancelled_at.
--
-- Payroll otomatis mengikuti: trigger attendance_payroll_refresh
-- menghitung ulang saat absensi dipulihkan; status 'cancelled' tidak
-- lagi menahan potongan (hanya pending/approved yang menahan).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Kolom & status baru
-- ---------------------------------------------------------------------
ALTER TABLE sanggahan
  ADD COLUMN IF NOT EXISTS revert_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

ALTER TABLE sanggahan DROP CONSTRAINT IF EXISTS sanggahan_status_check;
ALTER TABLE sanggahan ADD CONSTRAINT sanggahan_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled'));

-- ---------------------------------------------------------------------
-- 2. review_sanggahan — approve kini menyimpan snapshot absensi asli
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.review_sanggahan(p_sanggahan_id UUID, p_approve BOOLEAN, p_rejection_reason TEXT DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT;
  v_org UUID;
  v_s RECORD;
  v_new_att_id UUID;
  v_shift TEXT;
  v_target_att UUID;
  v_snapshot JSONB;
BEGIN
  SELECT role::TEXT INTO v_role FROM profiles WHERE id = v_uid;
  IF v_role IS NULL OR v_role NOT IN ('super_admin', 'admin', 'admin_puskesmas') THEN
    RETURN json_build_object('success', false, 'error', 'Akses ditolak');
  END IF;

  SELECT * INTO v_s FROM sanggahan WHERE id = p_sanggahan_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Sanggahan tidak ditemukan');
  END IF;
  IF v_s.status <> 'pending' THEN
    RETURN json_build_object('success', false, 'error', 'Sanggahan sudah diproses');
  END IF;

  -- Admin instansi hanya boleh memproses org-nya sendiri
  IF v_role <> 'super_admin' THEN
    SELECT organization_id INTO v_org FROM profiles WHERE id = v_uid;
    IF v_org IS NULL OR v_org <> v_s.organization_id THEN
      RETURN json_build_object('success', false, 'error', 'Tidak berhak memproses sanggahan ini');
    END IF;
  END IF;

  IF p_approve THEN
    -- Tentukan baris absensi target, lalu simpan keadaan ASLInya agar
    -- persetujuan bisa dibatalkan (cancel_sanggahan_approval).
    v_target_att := v_s.attendance_id;
    IF v_target_att IS NULL THEN
      SELECT id INTO v_target_att
      FROM attendance
      WHERE user_id = v_s.user_id AND date = v_s.tanggal;
    END IF;

    IF v_target_att IS NOT NULL THEN
      SELECT jsonb_build_object(
        'existed', true,
        'attendance_id', a.id,
        'attendance_status', a.attendance_status::text,
        'is_late', a.is_late,
        'late_minutes', a.late_minutes,
        'clock_in_time', a.clock_in_time,
        'clock_out_time', a.clock_out_time,
        'notes', a.notes
      ) INTO v_snapshot
      FROM attendance a WHERE a.id = v_target_att;
    ELSE
      v_snapshot := jsonb_build_object('existed', false);
    END IF;

    IF v_s.attendance_id IS NOT NULL THEN
      -- Koreksi record absensi yang ada → Hadir/valid + jam dikosongkan
      UPDATE attendance
      SET attendance_status = 'hadir',
          is_late = false,
          late_minutes = 0,
          clock_in_time = NULL,
          clock_out_time = NULL,
          notes = CASE WHEN COALESCE(TRIM(notes), '') = ''
                       THEN 'Dikoreksi via sanggahan'
                       ELSE notes || ' — dikoreksi via sanggahan' END
      WHERE id = v_s.attendance_id;
      v_new_att_id := v_s.attendance_id;
    ELSE
      -- Hari alpha tanpa record: buat record Hadir (shift dari jadwal bila ada)
      SELECT shift_code INTO v_shift
      FROM employee_schedules WHERE user_id = v_s.user_id AND date = v_s.tanggal;

      IF EXISTS (SELECT 1 FROM attendance WHERE user_id = v_s.user_id AND date = v_s.tanggal) THEN
        UPDATE attendance
        SET attendance_status = 'hadir',
            is_late = false,
            late_minutes = 0,
            clock_in_time = NULL,
            clock_out_time = NULL,
            notes = CASE WHEN COALESCE(TRIM(notes), '') = ''
                         THEN 'Dikoreksi via sanggahan'
                         ELSE notes || ' — dikoreksi via sanggahan' END
        WHERE user_id = v_s.user_id AND date = v_s.tanggal
        RETURNING id INTO v_new_att_id;
      ELSE
        INSERT INTO attendance (user_id, date, attendance_status, is_late, late_minutes, schedule_match, shift_code, notes)
        VALUES (v_s.user_id, v_s.tanggal, 'hadir', false, 0, true, v_shift, 'Dikoreksi via sanggahan')
        RETURNING id INTO v_new_att_id;
      END IF;
    END IF;

    UPDATE sanggahan
    SET status = 'approved',
        reviewed_by = v_uid,
        reviewed_at = NOW(),
        rejection_reason = NULL,
        attendance_id = COALESCE(v_new_att_id, attendance_id),
        revert_snapshot = v_snapshot,
        updated_at = NOW()
    WHERE id = p_sanggahan_id;

    RETURN json_build_object('success', true, 'message', 'Sanggahan disetujui — absensi dikoreksi menjadi Hadir');
  ELSE
    IF COALESCE(TRIM(p_rejection_reason), '') = '' THEN
      RETURN json_build_object('success', false, 'error', 'Alasan penolakan wajib diisi');
    END IF;

    UPDATE sanggahan
    SET status = 'rejected',
        rejection_reason = TRIM(p_rejection_reason),
        reviewed_by = v_uid,
        reviewed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_sanggahan_id;

    RETURN json_build_object('success', true, 'message', 'Sanggahan ditolak');
  END IF;
END;
$$;

-- ---------------------------------------------------------------------
-- 3. RPC pembatalan persetujuan (admin instansi / super admin)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_sanggahan_approval(
  p_sanggahan_id UUID,
  p_reason TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT;
  v_org UUID;
  v_s RECORD;
  v_snap JSONB;
  v_restored TEXT := 'none';
BEGIN
  SELECT role::TEXT INTO v_role FROM profiles WHERE id = v_uid;
  IF v_role IS NULL OR v_role NOT IN ('super_admin', 'admin', 'admin_puskesmas') THEN
    RETURN json_build_object('success', false, 'error', 'Akses ditolak');
  END IF;

  SELECT * INTO v_s FROM sanggahan WHERE id = p_sanggahan_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Sanggahan tidak ditemukan');
  END IF;
  IF v_s.status <> 'approved' THEN
    RETURN json_build_object('success', false, 'error', 'Hanya sanggahan yang sudah disetujui yang dapat dibatalkan');
  END IF;

  -- Admin instansi hanya boleh memproses org-nya sendiri
  IF v_role <> 'super_admin' THEN
    SELECT organization_id INTO v_org FROM profiles WHERE id = v_uid;
    IF v_org IS NULL OR v_org <> v_s.organization_id THEN
      RETURN json_build_object('success', false, 'error', 'Tidak berhak memproses sanggahan ini');
    END IF;
  END IF;

  IF COALESCE(TRIM(p_reason), '') = '' THEN
    RETURN json_build_object('success', false, 'error', 'Alasan pembatalan wajib diisi');
  END IF;

  v_snap := v_s.revert_snapshot;

  IF v_snap IS NOT NULL AND (v_snap->>'existed')::boolean THEN
    -- Pulihkan absensi persis seperti sebelum dikoreksi
    UPDATE attendance
    SET attendance_status = (v_snap->>'attendance_status')::attendance_status,
        is_late = COALESCE((v_snap->>'is_late')::boolean, false),
        late_minutes = COALESCE((v_snap->>'late_minutes')::int, 0),
        clock_in_time = (v_snap->>'clock_in_time')::timestamptz,
        clock_out_time = (v_snap->>'clock_out_time')::timestamptz,
        notes = v_snap->>'notes'
    WHERE id = (v_snap->>'attendance_id')::uuid;
    IF FOUND THEN v_restored := 'restored'; END IF;
  ELSIF v_snap IS NOT NULL THEN
    -- Baris absensi dibuat BARU oleh approve → hapus kembali
    DELETE FROM attendance
    WHERE id = v_s.attendance_id
       OR (v_s.attendance_id IS NULL
           AND user_id = v_s.user_id
           AND date = v_s.tanggal
           AND notes ILIKE '%dikoreksi via sanggahan%');
    IF FOUND THEN v_restored := 'deleted'; END IF;
  ELSIF v_s.old_status = 'alpha' THEN
    -- Sanggahan lama tanpa snapshot, jenis alpha: pasti kembali ke
    -- alpha tanpa jam (baris buatan approve pun berujung sama)
    UPDATE attendance
    SET attendance_status = 'alpha',
        is_late = false,
        late_minutes = 0,
        clock_in_time = NULL,
        clock_out_time = NULL,
        notes = CASE
          WHEN notes ILIKE 'dikoreksi via sanggahan' THEN NULL
          ELSE regexp_replace(notes, ' — dikoreksi via sanggahan$', '')
        END
    WHERE id = v_s.attendance_id;
    IF FOUND THEN v_restored := 'restored'; END IF;
  ELSIF v_s.old_status = 'belum' THEN
    -- Hari bebas masa depan buatan approve → hapus barisnya
    DELETE FROM attendance
    WHERE user_id = v_s.user_id AND date = v_s.tanggal
      AND notes ILIKE '%dikoreksi via sanggahan%';
    IF FOUND THEN v_restored := 'deleted'; END IF;
  ELSE
    RETURN json_build_object('success', false, 'error',
      'Sanggahan lama jenis "' || COALESCE(v_s.old_status, '-') ||
      '" tidak menyimpan data absensi asli — pembatalan tidak dapat dipulihkan');
  END IF;

  UPDATE sanggahan
  SET status = 'cancelled',
      cancel_reason = TRIM(p_reason),
      cancelled_by = v_uid,
      cancelled_at = NOW(),
      updated_at = NOW()
  WHERE id = p_sanggahan_id;

  RETURN json_build_object(
    'success', true,
    'restored', v_restored,
    'message', 'Persetujuan dibatalkan — absensi dikembalikan ke keadaan semula'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_sanggahan_approval(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_sanggahan_approval(UUID, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
