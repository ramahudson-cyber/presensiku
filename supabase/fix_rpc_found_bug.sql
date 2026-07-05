-- FIX: FOUND bug di check_device_binding
-- SELECT COUNT(*) SETELAH SELECT INTO selalu overwrite FOUND jadi TRUE
-- Akibatnya: device BARU selalu dianggap "diblokir", BUKAN "butuh OTP"
-- Fix: simpan FOUND ke v_found SEBELUM query COUNT

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
  FROM user_devices
  WHERE user_id = p_user_id
    AND visitor_id = p_visitor_id
    AND is_active = true
  LIMIT 1;

  v_found := FOUND;

  SELECT COUNT(*) INTO v_device_count
  FROM user_devices
  WHERE user_id = p_user_id AND is_active = true;

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

    UPDATE user_devices
    SET last_login_at = NOW(),
        device_name = COALESCE(p_device_name, device_name),
        device_os = COALESCE(p_device_os, device_os),
        device_browser = COALESCE(p_device_browser, device_browser),
        device_type = COALESCE(p_device_type, device_type),
        imei = COALESCE(p_imei, imei),
        serial = COALESCE(p_serial, serial)
    WHERE id = v_device.id;
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
