-- ============================================================
-- MIGRATION: Perketat otorisasi penghapusan user
-- ============================================================
-- Admin instansi hanya boleh menghapus pegawai/kepala_unit dalam
-- organisasinya. Super admin tidak pernah dapat dihapus melalui RPC.
-- ============================================================

CREATE OR REPLACE FUNCTION delete_employee_with_auth(p_user_id UUID)
RETURNS JSON
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
    RETURN json_build_object('success', false, 'error', 'Tidak terautentikasi');
  END IF;

  SELECT role::TEXT, organization_id
    INTO v_caller_role, v_caller_org
  FROM profiles
  WHERE id = auth.uid();

  IF v_caller_role IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Tidak terautentikasi');
  END IF;

  SELECT role::TEXT, organization_id
    INTO v_target_role, v_target_org
  FROM profiles
  WHERE id = p_user_id;

  IF v_target_role IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User tidak ditemukan');
  END IF;

  IF v_target_role = 'super_admin' THEN
    RETURN json_build_object('success', false, 'error', 'Tidak dapat menghapus super_admin');
  END IF;

  IF v_caller_role IN ('admin', 'admin_puskesmas') THEN
    IF v_target_org IS DISTINCT FROM v_caller_org THEN
      RETURN json_build_object('success', false, 'error', 'Tidak berhak menghapus user instansi lain');
    END IF;

    IF v_target_role NOT IN ('pegawai', 'kepala_unit') THEN
      RETURN json_build_object('success', false, 'error', 'Admin hanya dapat menghapus pegawai/kepala unit');
    END IF;
  ELSIF v_caller_role <> 'super_admin' THEN
    RETURN json_build_object('success', false, 'error', 'Hanya admin yang dapat menghapus user');
  END IF;

  DELETE FROM auth.users WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Akun auth tidak ditemukan');
  END IF;

  DELETE FROM profiles WHERE id = p_user_id;

  RETURN json_build_object('success', true, 'message', 'Pegawai dihapus');
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION delete_employee_with_auth(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION delete_employee_with_auth(UUID) TO authenticated;
