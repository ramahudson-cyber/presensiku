-- ============================================================
-- Migration: Fitur Izin & Sakit
-- Tabel leave_requests + RLS + RPC approve/reject
-- Approve => otomatis buat catatan attendance per tanggal
-- ============================================================

-- Izin/sakit tidak punya jam absen, jadi kolom ini harus boleh NULL
ALTER TABLE attendance ALTER COLUMN clock_in_time DROP NOT NULL;

CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type VARCHAR NOT NULL CHECK (type IN ('izin', 'sakit')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT leave_date_order CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_user_id ON leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);

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

-- Approve/reject lewat RPC SECURITY DEFINER (tidak perlu policy UPDATE)

-- ============================================================
-- RPC: approve_leave_request
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
      VALUES (v_request.user_id, v_day, v_request.type, false, false, 0,
              'Auto dari permohonan ' || v_request.type);
      v_created := v_created + 1;
    END IF;
  END LOOP;

  UPDATE leave_requests
  SET status = 'approved', approved_by = auth.uid(), approved_at = NOW(), rejection_reason = NULL
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
  SET status = 'rejected', rejection_reason = p_reason, approved_by = auth.uid(), approved_at = NOW()
  WHERE id = p_request_id;

  RETURN json_build_object('success', true, 'message', 'Permohonan ditolak');
END;
$$;
