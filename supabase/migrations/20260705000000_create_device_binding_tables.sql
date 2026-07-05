-- ============================================================
-- Migration: Create device binding tables & missing RPCs
-- Membuat tabel device_requests, user_devices, otp_codes
-- yang hanya di-ALTER (tidak di-CREATE) oleh migration sebelumnya
-- ============================================================

-- 1. device_requests — request registrasi device baru
CREATE TABLE IF NOT EXISTS device_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL,
  device_name TEXT,
  device_os TEXT,
  device_browser TEXT,
  device_type VARCHAR DEFAULT 'web',
  imei TEXT,
  serial TEXT,
  status VARCHAR DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. user_devices — device yang sudah disetujui
CREATE TABLE IF NOT EXISTS user_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL,
  device_name TEXT,
  device_os TEXT,
  device_browser TEXT,
  device_type VARCHAR DEFAULT 'web',
  imei TEXT,
  serial TEXT,
  is_trusted BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. otp_codes — kode OTP untuk verifikasi device baru
CREATE TABLE IF NOT EXISTS otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  otp_code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes'),
  is_used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index untuk performa query
CREATE INDEX IF NOT EXISTS idx_device_requests_user_id ON device_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_device_requests_status ON device_requests(status);
CREATE INDEX IF NOT EXISTS idx_device_requests_visitor_id ON device_requests(visitor_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON user_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_visitor_id ON user_devices(visitor_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_active ON user_devices(is_active);
CREATE INDEX IF NOT EXISTS idx_otp_codes_user_id ON otp_codes(user_id);

-- RLS: aktifkan row-level security
ALTER TABLE device_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;

-- Policy: admin bisa baca semua device_requests
DROP POLICY IF EXISTS admin_select_device_requests ON device_requests;
CREATE POLICY admin_select_device_requests ON device_requests
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role IN ('super_admin', 'admin_puskesmas')
    )
  );

-- Policy: user bisa baca request-nya sendiri
DROP POLICY IF EXISTS user_select_own_device_requests ON device_requests;
CREATE POLICY user_select_own_device_requests ON device_requests
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: user bisa insert request-nya sendiri
DROP POLICY IF EXISTS user_insert_device_requests ON device_requests;
CREATE POLICY user_insert_device_requests ON device_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: admin bisa update device_requests
DROP POLICY IF EXISTS admin_update_device_requests ON device_requests;
CREATE POLICY admin_update_device_requests ON device_requests
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role IN ('super_admin', 'admin_puskesmas')
    )
  );

-- Policy: admin bisa baca semua user_devices
DROP POLICY IF EXISTS admin_select_user_devices ON user_devices;
CREATE POLICY admin_select_user_devices ON user_devices
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role IN ('super_admin', 'admin_puskesmas')
    )
  );

-- Policy: user bisa baca device-nya sendiri
DROP POLICY IF EXISTS user_select_own_devices ON user_devices;
CREATE POLICY user_select_own_devices ON user_devices
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: RPC functions handle INSERT/UPDATE/DELETE via SECURITY DEFINER

-- OTP: user bisa baca OTP-nya sendiri (untuk verifikasi)
DROP POLICY IF EXISTS user_select_own_otp ON otp_codes;
CREATE POLICY user_select_own_otp ON otp_codes
  FOR SELECT USING (auth.uid() = user_id);

-- OTP: user bisa insert OTP-nya sendiri
DROP POLICY IF EXISTS user_insert_own_otp ON otp_codes;
CREATE POLICY user_insert_own_otp ON otp_codes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- OTP: user bisa update OTP-nya sendiri (untuk mark is_used)
DROP POLICY IF EXISTS user_update_own_otp ON otp_codes;
CREATE POLICY user_update_own_otp ON otp_codes
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- RPC: reject_device_request
-- ============================================================
DROP FUNCTION IF EXISTS reject_device_request;
CREATE OR REPLACE FUNCTION reject_device_request(
  p_request_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request RECORD;
BEGIN
  SELECT * INTO v_request FROM device_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Request not found');
  END IF;

  UPDATE device_requests
  SET status = 'rejected', rejection_reason = p_reason, updated_at = NOW()
  WHERE id = p_request_id;

  RETURN json_build_object('success', true, 'message', 'Device request rejected');
END;
$$;

-- ============================================================
-- RPC: reset_user_device (hapus device user)
-- ============================================================
DROP FUNCTION IF EXISTS reset_user_device;
CREATE OR REPLACE FUNCTION reset_user_device(
  p_user_id UUID,
  p_visitor_id TEXT DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
BEGIN
  IF p_visitor_id IS NULL THEN
    -- Reset semua device user
    DELETE FROM user_devices
    WHERE user_id = p_user_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;

    -- Juga hapus pending requests
    DELETE FROM device_requests
    WHERE user_id = p_user_id AND status = 'pending';
  ELSE
    -- Reset device spesifik
    DELETE FROM user_devices
    WHERE user_id = p_user_id AND visitor_id = p_visitor_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;

    -- Hapus pending request untuk device ini
    DELETE FROM device_requests
    WHERE user_id = p_user_id AND visitor_id = p_visitor_id AND status = 'pending';
  END IF;

  RETURN v_count;
END;
$$;

-- ============================================================
-- RPC: generate_otp_code
-- ============================================================
DROP FUNCTION IF EXISTS generate_otp_code;
CREATE OR REPLACE FUNCTION generate_otp_code(
  p_user_id UUID
)
RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_otp VARCHAR(6);
BEGIN
  -- Generate 6 digit OTP
  v_otp := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');

  -- Insert ke otp_codes
  INSERT INTO otp_codes (user_id, otp_code, expires_at)
  VALUES (p_user_id, v_otp, NOW() + INTERVAL '5 minutes');

  RETURN v_otp;
END;
$$;

-- ============================================================
-- RPC: verify_otp_code
-- ============================================================
DROP FUNCTION IF EXISTS verify_otp_code;
CREATE OR REPLACE FUNCTION verify_otp_code(
  p_user_id UUID,
  p_otp VARCHAR
)
RETURNS TABLE(is_valid BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_otp RECORD;
BEGIN
  SELECT * INTO v_otp FROM otp_codes
  WHERE user_id = p_user_id
    AND otp_code = p_otp
    AND is_used = false
    AND expires_at > NOW()
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    -- Mark OTP sebagai sudah dipakai
    UPDATE otp_codes SET is_used = true WHERE id = v_otp.id;

    RETURN QUERY SELECT true::BOOLEAN AS is_valid, 'OTP valid'::TEXT AS message;
  ELSE
    -- Cek apakah OTP expired atau sudah dipakai
    SELECT * INTO v_otp FROM otp_codes
    WHERE user_id = p_user_id
      AND otp_code = p_otp
    ORDER BY created_at DESC
    LIMIT 1;

    IF FOUND THEN
      IF v_otp.is_used THEN
        RETURN QUERY SELECT false::BOOLEAN AS is_valid, 'Kode OTP sudah digunakan'::TEXT AS message;
      ELSE
        RETURN QUERY SELECT false::BOOLEAN AS is_valid, 'Kode OTP sudah kedaluwarsa. Mohon kirim ulang.'::TEXT AS message;
      END IF;
    ELSE
      RETURN QUERY SELECT false::BOOLEAN AS is_valid, 'Kode OTP tidak valid'::TEXT AS message;
    END IF;
  END IF;
END;
$$;
