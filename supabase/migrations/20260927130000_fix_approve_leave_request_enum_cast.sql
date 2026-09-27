-- ============================================================
-- Fix: approve_leave_request gagal 400
--   "column attendance_status is of type attendance_status but
--    expression is of type leave_type"
--
-- Enum leave_type dan attendance_status adalah dua enum berbeda,
-- PostgreSQL tidak melakukan implicit cast antar enum. Nilai
-- leave_type dari leave_requests kini di-cast eksplisit:
--   izin -> izin, sakit -> sakit, jenis lain -> cuti
-- Hanya approve_leave_request_impl yang diganti; wrapper
-- approve_leave_request (cek hak akses per organisasi) tidak
-- diubah. Idempotent: aman dijalankan berulang.
-- ============================================================

CREATE OR REPLACE FUNCTION public.approve_leave_request_impl(p_request_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_request RECORD;
  v_role TEXT;
  v_created INT := 0;
  v_skipped INT := 0;
  v_day DATE;
  v_status_val attendance_status;
BEGIN
  SELECT role::TEXT INTO v_role FROM profiles WHERE id = auth.uid();
  IF v_role IS NULL OR v_role NOT IN ('super_admin', 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Akses ditolak');
  END IF;

  SELECT * INTO v_request FROM leave_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Permohonan tidak ditemukan');
  END IF;
  IF v_request.status <> 'pending' THEN
    RETURN json_build_object('success', false, 'error', 'Permohonan sudah diproses');
  END IF;

  -- leave_type (enum terpisah) wajib di-cast eksplisit ke attendance_status.
  -- izin/sakit dipetakan 1:1; jenis cuti lain (tahunan/bersalin/alasan_penting)
  -- dicatat sebagai 'cuti' pada absensi.
  v_status_val := CASE v_request.leave_type::text
    WHEN 'izin'  THEN 'izin'::attendance_status
    WHEN 'sakit' THEN 'sakit'::attendance_status
    ELSE 'cuti'::attendance_status
  END;

  -- Buat catatan absensi per tanggal, lewati tanggal yang sudah punya catatan
  FOR v_day IN
    SELECT generate_series(v_request.start_date, v_request.end_date, INTERVAL '1 day')::DATE
  LOOP
    IF EXISTS (
      SELECT 1 FROM attendance WHERE user_id = v_request.user_id AND date = v_day
    ) THEN
      v_skipped := v_skipped + 1;
    ELSE
      INSERT INTO attendance (user_id, date, attendance_status, schedule_match, is_late, late_minutes, notes)
      VALUES (v_request.user_id, v_day, v_status_val, false, false, 0,
              'Auto dari permohonan ' || v_request.leave_type::text);
      v_created := v_created + 1;
    END IF;
  END LOOP;

  UPDATE leave_requests
  SET status = 'approved', approved_by = auth.uid(), approved_at = NOW(), rejection_reason = NULL, updated_at = NOW()
  WHERE id = p_request_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Permohonan disetujui',
    'created', v_created,
    'skipped', v_skipped
  );
END;
$function$;
