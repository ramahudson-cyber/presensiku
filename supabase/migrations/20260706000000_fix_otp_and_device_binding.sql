-- ============================================================
-- FIX: OTP column name (code) + FOUND bug di check_device_binding
-- ============================================================

-- 1. Tambah kolom purpose ke otp_codes (jika belum ada)
ALTER TABLE IF EXISTS otp_codes
  ADD COLUMN IF NOT EXISTS purpose VARCHAR DEFAULT 'device_verification';

-- 1b. Rename kolom otp_code → code (jika masih bernama otp_code)
ALTER TABLE IF EXISTS otp_codes
  RENAME COLUMN otp_code TO code;

-- 2. Fix generate_otp_code — pakai kolom "code", isi "purpose"
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

-- 3. Fix verify_otp_code — pakai kolom "code"
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

-- 4. Fix check_device_binding — simpan FOUND sebelum COUNT(*)
DROP FUNCTION IF EXISTS check_device_binding;
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
