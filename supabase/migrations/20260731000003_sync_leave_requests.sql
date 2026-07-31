-- ============================================================
-- Sync leave_requests ke schema yang dipakai aplikasi
-- Idempotent: aman dijalankan berulang kali
-- ============================================================

-- Kolom yang dipakai aplikasi (total_days di insert leaveService.js)
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS total_days INTEGER NOT NULL DEFAULT 1;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS attachment_url TEXT;

CREATE INDEX IF NOT EXISTS idx_leave_requests_user_id ON leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);

-- ============================================================
-- RLS policies (idempotent)
-- ============================================================
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

-- Pegawai baca permohonannya sendiri
DROP POLICY IF EXISTS user_select_own_leave ON leave_requests;
CREATE POLICY user_select_own_leave ON leave_requests
  FOR SELECT USING (auth.uid() = user_id);

-- Admin & kepala unit baca semua
DROP POLICY IF EXISTS admin_select_leave ON leave_requests;
CREATE POLICY admin_select_leave ON leave_requests
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role IN ('super_admin', 'admin_puskesmas', 'kepala_unit')
    )
  );

-- Pegawai ajukan untuk dirinya sendiri
DROP POLICY IF EXISTS user_insert_own_leave ON leave_requests;
CREATE POLICY user_insert_own_leave ON leave_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Pegawai batalkan permohonan sendiri selama masih pending
DROP POLICY IF EXISTS user_delete_own_pending_leave ON leave_requests;
CREATE POLICY user_delete_own_pending_leave ON leave_requests
  FOR DELETE USING (auth.uid() = user_id AND status = 'pending');

-- ============================================================
-- RPC: approve_leave_request (pakai leave_type, bukan request_type)
-- ============================================================
CREATE OR REPLACE FUNCTION approve_leave_request(p_request_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request RECORD;
  v_role TEXT;
  v_created INT := 0;
  v_skipped INT := 0;
  v_day DATE;
BEGIN
  SELECT role::TEXT INTO v_role FROM profiles WHERE id = auth.uid();
  IF v_role IS NULL OR v_role NOT IN ('super_admin', 'admin_puskesmas') THEN
    RETURN json_build_object('success', false, 'error', 'Akses ditolak');
  END IF;

  SELECT * INTO v_request FROM leave_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Permohonan tidak ditemukan');
  END IF;
  IF v_request.status <> 'pending' THEN
    RETURN json_build_object('success', false, 'error', 'Permohonan sudah diproses');
  END IF;

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
      VALUES (v_request.user_id, v_day, v_request.leave_type, false, false, 0,
              'Auto dari permohonan ' || v_request.leave_type);
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
$$;

-- ============================================================
-- RPC: reject_leave_request
-- ============================================================
CREATE OR REPLACE FUNCTION reject_leave_request(p_request_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT;
  v_status TEXT;
BEGIN
  SELECT role::TEXT INTO v_role FROM profiles WHERE id = auth.uid();
  IF v_role IS NULL OR v_role NOT IN ('super_admin', 'admin_puskesmas') THEN
    RETURN json_build_object('success', false, 'error', 'Akses ditolak');
  END IF;

  SELECT status INTO v_status FROM leave_requests WHERE id = p_request_id;
  IF v_status IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Permohonan tidak ditemukan');
  END IF;
  IF v_status <> 'pending' THEN
    RETURN json_build_object('success', false, 'error', 'Permohonan sudah diproses');
  END IF;

  UPDATE leave_requests
  SET status = 'rejected', rejection_reason = p_reason, approved_by = auth.uid(), approved_at = NOW(), updated_at = NOW()
  WHERE id = p_request_id;

  RETURN json_build_object('success', true, 'message', 'Permohonan ditolak');
END;
$$;

-- Grant execute ke semua role (RPC SECURITY DEFINER mengontrol akses sendiri)
GRANT EXECUTE ON FUNCTION approve_leave_request(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION reject_leave_request(UUID, TEXT) TO authenticated, anon;
