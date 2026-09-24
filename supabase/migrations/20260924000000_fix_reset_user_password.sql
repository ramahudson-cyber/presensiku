-- ============================================================
-- MIGRATION: Perbaiki reset password oleh super admin/admin instansi
-- ============================================================
-- Target diidentifikasi dengan profiles.id, bukan email kontak/login.
-- Ini penting karena auth_email multi-tenant dapat berbeda dari profiles.email.
-- ============================================================

DROP FUNCTION IF EXISTS reset_user_password(TEXT, TEXT);
DROP FUNCTION IF EXISTS reset_user_password(UUID, TEXT);

CREATE OR REPLACE FUNCTION reset_user_password(
  p_user_id UUID,
  p_new_password TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_target_role TEXT;
  v_target_org UUID;
  v_caller_role TEXT;
  v_caller_org UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Tidak terautentikasi';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User tidak ditemukan';
  END IF;

  IF p_new_password IS NULL OR length(p_new_password) < 1 THEN
    RAISE EXCEPTION 'Password tidak boleh kosong';
  END IF;

  SELECT role::TEXT, organization_id
    INTO v_caller_role, v_caller_org
  FROM profiles
  WHERE id = auth.uid();

  IF v_caller_role IS NULL THEN
    RAISE EXCEPTION 'Tidak terautentikasi';
  END IF;

  SELECT role::TEXT, organization_id
    INTO v_target_role, v_target_org
  FROM profiles
  WHERE id = p_user_id;

  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'User tidak ditemukan';
  END IF;

  -- Admin instansi hanya dapat mereset pegawai/kepala unit di instansinya.
  -- admin_puskesmas dipertahankan untuk akun legacy yang belum tersinkron.
  IF v_caller_role IN ('admin', 'admin_puskesmas') THEN
    IF v_target_org IS DISTINCT FROM v_caller_org THEN
      RAISE EXCEPTION 'Tidak berhak mereset password user instansi lain';
    END IF;

    IF v_target_role NOT IN ('pegawai', 'kepala_unit') THEN
      RAISE EXCEPTION 'Admin hanya boleh mereset password pegawai/kepala unit';
    END IF;
  ELSIF v_caller_role <> 'super_admin' THEN
    RAISE EXCEPTION 'Hanya admin yang dapat mereset password';
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf')),
      updated_at = NOW()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Akun auth tidak ditemukan';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION reset_user_password(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION reset_user_password(UUID, TEXT) TO authenticated;
