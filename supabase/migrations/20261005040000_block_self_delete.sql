-- =====================================================================
-- Penguatan delete_employee_with_auth:
-- 1. Tidak ada peran yang boleh menghapus akunnya sendiri (self-delete).
-- 2. Admin instansi tidak dapat menghapus admin lain — hanya super_admin
--    (pesan eksplisit; sebelumnya tersirat lewat cek pegawai/kepala unit).
-- Salinan penuh dari 20261002030000 (cleanup announcements & data per-user
-- tetap utuh); hanya dua guard di atas yang ditambahkan.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.delete_employee_with_auth(p_user_id UUID)
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

  -- Self-delete dilarang untuk semua peran
  IF p_user_id = v_uid THEN
    RETURN json_build_object('success', false, 'error', 'Tidak dapat menghapus akun Anda sendiri');
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

    IF v_target_role = 'admin' THEN
      RETURN json_build_object('success', false, 'error', 'Hanya super admin yang dapat menghapus admin');
    END IF;

    IF v_target_role NOT IN ('pegawai', 'kepala_unit') THEN
      RETURN json_build_object('success', false, 'error', 'Admin hanya dapat menghapus pegawai/kepala unit');
    END IF;
  ELSIF v_caller_role <> 'super_admin' THEN
    RETURN json_build_object('success', false, 'error', 'Hanya admin yang dapat menghapus user');
  END IF;

  -- Cleanup data transaksional milik pegawai (pola delete_organization
  -- 20260926000002) supaya FK baseline yang NO ACTION tidak memblokir
  -- penghapusan auth/profiles.
  DELETE FROM attendance WHERE user_id = p_user_id;
  DELETE FROM employee_schedules WHERE user_id = p_user_id;
  DELETE FROM leave_requests WHERE user_id = p_user_id;
  DELETE FROM device_requests WHERE user_id = p_user_id;
  DELETE FROM user_devices WHERE user_id = p_user_id;
  DELETE FROM otp_codes WHERE user_id = p_user_id;
  DELETE FROM audit_logs WHERE user_id = p_user_id;
  -- Pengumuman tetap tersimpan; publisher menjadi anonim (FK SET NULL)
  UPDATE announcements SET published_by = NULL WHERE published_by = p_user_id;

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

REVOKE ALL ON FUNCTION public.delete_employee_with_auth(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_employee_with_auth(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
