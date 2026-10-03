-- =====================================================================
-- Status tampilan "Sanggah" untuk absensi hasil sanggahan disetujui:
-- 1. review_sanggahan (approve) kini MENGOSONGKAN jam masuk/pulang —
--    koreksi via sanggahan tidak lagi menampilkan jam absen asli.
-- 2. Perbaikan data lama: baris attendance yang tertaut sanggahan
--    berstatus approved → jam dikosongkan + penanda notes dipastikan ada.
--
-- Catatan: attendance_status TETAP 'hadir' agar payroll dan statistik
-- yang sudah berjalan tidak berubah; label "Sanggah" hanya di lapisan
-- tampilan (client) berdasarkan penanda notes "dikoreksi via sanggahan".
-- =====================================================================

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

-- ── Perbaikan data lama: sanggahan approved → jam dikosongkan ────────────
UPDATE attendance a
SET clock_in_time = NULL,
    clock_out_time = NULL,
    notes = CASE WHEN a.notes ILIKE '%dikoreksi via sanggahan%' THEN a.notes
                 WHEN COALESCE(TRIM(a.notes), '') = '' THEN 'Dikoreksi via sanggahan'
                 ELSE a.notes || ' — dikoreksi via sanggahan' END
FROM sanggahan s
WHERE s.attendance_id = a.id
  AND s.status = 'approved'
  AND (a.clock_in_time IS NOT NULL
       OR a.clock_out_time IS NOT NULL
       OR COALESCE(a.notes, '') NOT ILIKE '%dikoreksi via sanggahan%');

NOTIFY pgrst, 'reload schema';
