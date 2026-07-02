-- Tambah kolom device_type ke device_requests & user_devices
ALTER TABLE IF EXISTS device_requests
  ADD COLUMN IF NOT EXISTS device_type VARCHAR DEFAULT 'web';

ALTER TABLE IF EXISTS user_devices
  ADD COLUMN IF NOT EXISTS device_type VARCHAR DEFAULT 'web';

-- Update RPC: check_device_binding (tambah p_device_type)
CREATE OR REPLACE FUNCTION check_device_binding(
  p_user_id UUID,
  p_visitor_id TEXT,
  p_device_name TEXT DEFAULT NULL,
  p_device_os TEXT DEFAULT NULL,
  p_device_browser TEXT DEFAULT NULL,
  p_device_type TEXT DEFAULT 'web'
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
BEGIN
  -- Cek apakah device sudah terdaftar & trusted
  SELECT * INTO v_device
  FROM user_devices
  WHERE user_id = p_user_id
    AND visitor_id = p_visitor_id
    AND is_active = true
  LIMIT 1;

  -- Hitung total device aktif user
  SELECT COUNT(*) INTO v_device_count
  FROM user_devices
  WHERE user_id = p_user_id AND is_active = true;

  v_max_devices := 3; -- max 3 device per user

  IF FOUND THEN
    -- Device sudah terdaftar
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

    -- Update last_login & device info
    UPDATE user_devices
    SET last_login_at = NOW(),
        device_name = COALESCE(p_device_name, device_name),
        device_os = COALESCE(p_device_os, device_os),
        device_browser = COALESCE(p_device_browser, device_browser),
        device_type = COALESCE(p_device_type, device_type)
    WHERE id = v_device.id;
  ELSE
    -- Device BARU → butuh OTP & approval
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

-- Update RPC: create_device_request (tambah p_device_type)
CREATE OR REPLACE FUNCTION create_device_request(
  p_user_id UUID,
  p_visitor_id TEXT,
  p_device_name TEXT DEFAULT NULL,
  p_device_os TEXT DEFAULT NULL,
  p_device_browser TEXT DEFAULT NULL,
  p_device_type TEXT DEFAULT 'web'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request_id UUID;
BEGIN
  INSERT INTO device_requests (
    user_id, visitor_id, device_name, device_os, device_browser, device_type, status
  ) VALUES (
    p_user_id, p_visitor_id, p_device_name, p_device_os, p_device_browser, p_device_type, 'pending'
  )
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

-- Update RPC: approve_device_request — simpan device_type dari request
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

  -- Update status request
  UPDATE device_requests SET status = 'approved', updated_at = NOW() WHERE id = p_request_id;

  -- Hapus device lama dgn visitor_id yg sama (jika ada)
  DELETE FROM user_devices
  WHERE user_id = v_request.user_id
    AND visitor_id = v_request.visitor_id;

  -- Insert device baru
  INSERT INTO user_devices (
    user_id, visitor_id, device_name, device_os, device_browser, device_type,
    is_trusted, is_active, last_login_at
  ) VALUES (
    v_request.user_id, v_request.visitor_id,
    v_request.device_name, v_request.device_os, v_request.device_browser, v_request.device_type,
    true, true, NOW()
  );

  RETURN json_build_object('success', true, 'message', 'Device approved');
END;
$$;

-- Update RPC: get_pending_device_requests — include device_type
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
    dr.created_at
  FROM device_requests dr
  JOIN profiles p ON p.id = dr.user_id
  WHERE dr.status = 'pending'
  ORDER BY dr.created_at DESC;
END;
$$;
