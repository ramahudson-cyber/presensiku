-- FIX: Kolom di tabel otp_codes bernama "code", bukan "otp_code"
-- Juga ada kolom "purpose" yang tidak diisi oleh RPC lama

-- 0. Rename kolom otp_code → code (jika masih bernama otp_code)
ALTER TABLE IF EXISTS otp_codes
  RENAME COLUMN otp_code TO code;

-- 1. Fix generate_otp_code
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

-- 2. Fix verify_otp_code
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
