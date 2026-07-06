-- ============================================================
-- FIX KOMPLIT: Semua ketidakcocokan kolom di tabel & RPC
-- ============================================================

-- 1. Tambah kolom device_type ke device_requests & user_devices
ALTER TABLE IF EXISTS device_requests
  ADD COLUMN IF NOT EXISTS device_type VARCHAR DEFAULT 'web';
ALTER TABLE IF EXISTS user_devices
  ADD COLUMN IF NOT EXISTS device_type VARCHAR DEFAULT 'web';

-- ============================================================
-- 2. Rename kolom otp_code → code (hanya jika masih bernama otp_code)
-- ============================================================
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'otp_codes' AND column_name = 'otp_code'
  ) THEN
    ALTER TABLE otp_codes RENAME COLUMN otp_code TO code;
  END IF;
END $$;

-- ============================================================
-- 3. Fix generate_otp_code (kolom "code" bukan "otp_code")
-- ============================================================
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
  v_otp := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
  INSERT INTO otp_codes (user_id, code, purpose, expires_at)
  VALUES (p_user_id, v_otp, 'device_verification', NOW() + INTERVAL '5 minutes');
  RETURN v_otp;
END;
$$;

-- ============================================================
-- 3b. Fix verify_otp_code (WHERE otp_code -> code)
-- ============================================================
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
    AND code = p_otp
    AND is_used = false
    AND expires_at > NOW()
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    UPDATE otp_codes SET is_used = true WHERE id = v_otp.id;
    RETURN QUERY SELECT true::BOOLEAN AS is_valid, 'OTP valid'::TEXT AS message;
  ELSE
    SELECT * INTO v_otp FROM otp_codes
    WHERE user_id = p_user_id
      AND code = p_otp
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

-- ============================================================
-- 4. Fix create_device_request (hapus updated_at, pakai device_type)
-- ============================================================
DROP FUNCTION IF EXISTS create_device_request;
CREATE OR REPLACE FUNCTION create_device_request(
  p_user_id UUID,
  p_visitor_id TEXT,
  p_device_name TEXT DEFAULT NULL,
  p_device_os TEXT DEFAULT NULL,
  p_device_browser TEXT DEFAULT NULL,
  p_device_type TEXT DEFAULT 'web',
  p_imei TEXT DEFAULT NULL,
  p_serial TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request_id UUID;
BEGIN
  INSERT INTO device_requests (
    user_id, visitor_id, device_name, device_os, device_browser, device_type,
    status, imei, serial
  ) VALUES (
    p_user_id, p_visitor_id, p_device_name, p_device_os, p_device_browser, p_device_type,
    'pending', p_imei, p_serial
  )
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

-- ============================================================
-- 5. Fix check_device_binding (dengan v_found fix + kolom "user" bukan user_id)
-- ============================================================
DROP FUNCTION IF EXISTS check_device_binding(p_user_id UUID, p_visitor_id TEXT, p_device_name TEXT, p_device_os TEXT, p_device_browser TEXT, p_device_type TEXT, p_imei TEXT, p_serial TEXT);
DROP FUNCTION IF EXISTS check_device_binding(p_user_id UUID, p_visitor_id TEXT, p_device_name TEXT, p_device_os TEXT, p_device_browser TEXT, p_device_type TEXT);
CREATE OR REPLACE FUNCTION check_device_binding(
  p_user_id UUID,
  p_visitor_id TEXT,
  p_device_name TEXT DEFAULT NULL,
  p_device_os TEXT DEFAULT NULL,
  p_device_browser TEXT DEFAULT NULL,
  p_device_type TEXT DEFAULT 'web',
  p_imei TEXT DEFAULT NULL,
  p_serial TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_device RECORD;
  v_device_count INT;
  v_max_devices INT;
  v_result JSON;
  v_found BOOLEAN;
BEGIN
  SELECT * INTO v_device
  FROM user_devices ud
    WHERE ud.user_id = p_user_id
    AND ud.visitor_id = p_visitor_id
    AND ud.is_active = true
  LIMIT 1;

  v_found := FOUND;

  SELECT COUNT(*) INTO v_device_count
  FROM user_devices ud
  WHERE ud.user_id = p_user_id AND ud.is_active = true;

  v_max_devices := 3;

  IF v_found THEN
    IF v_device.is_trusted THEN
      v_result := json_build_object(
        'can_login', true,
        'is_registered', true,
        'is_trusted', true,
        'requires_otp', false,
        'message', 'OK',
        'device_count', v_device_count,
        'max_devices', v_max_devices
      );
    ELSE
      v_result := json_build_object(
        'can_login', false,
        'is_registered', true,
        'is_trusted', false,
        'requires_otp', false,
        'message', 'Device diblokir. Hubungi admin.',
        'device_count', v_device_count,
        'max_devices', v_max_devices
      );
    END IF;

    UPDATE user_devices ud
    SET last_login_at = NOW(),
        device_name = COALESCE(p_device_name, device_name),
        device_os = COALESCE(p_device_os, device_os),
        device_browser = COALESCE(p_device_browser, device_browser),
        device_type = COALESCE(p_device_type, device_type),
        imei = COALESCE(p_imei, imei),
        serial = COALESCE(p_serial, serial)
    WHERE ud.id = v_device.id;
  ELSE
    v_result := json_build_object(
      'can_login', true,
      'is_registered', false,
      'is_trusted', false,
      'requires_otp', true,
      'message', 'Device baru. Verifikasi OTP diperlukan.',
      'device_count', v_device_count,
      'max_devices', v_max_devices
    );
  END IF;

  RETURN v_result;
END;
$$;

-- ============================================================
-- 6. Fix approve_device_request (hapus updated_at, kolom "user")
-- ============================================================
DROP FUNCTION IF EXISTS approve_device_request;
CREATE OR REPLACE FUNCTION approve_device_request(p_request_id UUID)
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

  UPDATE device_requests SET status = 'approved' WHERE id = p_request_id;

  DELETE FROM user_devices ud
  WHERE ud.user_id = v_request.user_id
    AND ud.visitor_id = v_request.visitor_id;

  INSERT INTO user_devices (
    user_id, visitor_id, device_name, device_os, device_browser, device_type,
    is_trusted, is_active, last_login_at, imei, serial
  ) VALUES (
    v_request.user_id, v_request.visitor_id,
    v_request.device_name, v_request.device_os, v_request.device_browser, v_request.device_type,
    true, true, NOW(), v_request.imei, v_request.serial
  );

  RETURN json_build_object('success', true, 'message', 'Device approved');
END;
$$;

-- ============================================================
-- 7. Fix reset_user_device (kolom "user" untuk user_devices)
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
    DELETE FROM user_devices ud
    WHERE ud.user_id = p_user_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;

    DELETE FROM device_requests
    WHERE user_id = p_user_id AND status = 'pending';
  ELSE
    DELETE FROM user_devices ud
    WHERE ud.user_id = p_user_id AND ud.visitor_id = p_visitor_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;

    DELETE FROM device_requests
    WHERE user_id = p_user_id AND visitor_id = p_visitor_id AND status = 'pending';
  END IF;

  RETURN v_count;
END;
$$;

-- ============================================================
-- 8. Fix reject_device_request (hapus updated_at)
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
  SET status = 'rejected', rejection_reason = p_reason
  WHERE id = p_request_id;

  RETURN json_build_object('success', true, 'message', 'Device request rejected');
END;
$$;

-- ============================================================
-- 9. Fix get_pending_device_requests (tambah device_type)
-- ============================================================
DROP FUNCTION IF EXISTS get_pending_device_requests;
CREATE OR REPLACE FUNCTION get_pending_device_requests()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  user_name TEXT,
  user_email TEXT,
  visitor_id TEXT,
  device_name TEXT,
  device_os TEXT,
  device_browser TEXT,
  device_type TEXT,
  imei TEXT,
  serial TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dr.id,
    dr.user_id,
    p.full_name AS user_name,
    p.email AS user_email,
    dr.visitor_id,
    dr.device_name,
    dr.device_os,
    dr.device_browser,
    dr.device_type,
    dr.imei,
    dr.serial,
    dr.created_at
  FROM device_requests dr
  JOIN profiles p ON p.id = dr.user_id
  WHERE dr.status = 'pending'
  ORDER BY dr.created_at DESC;
END;
$$;
