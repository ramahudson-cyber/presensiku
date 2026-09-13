-- =====================================================================
-- MULTI-TENANT — RPC hapus instansi (khusus platform super_admin)
-- Menghapus instansi + SELURUH data terkait secara berurutan.
-- Pengaman:
--   1. Hanya super_admin platform yang bisa memanggil.
--   2. Tidak bisa menghapus instansi yang memuat akun super_admin
--      (instansi induk platform) — mencegah self-delete.
-- Jalankan SETELAH migration 1-5.
-- =====================================================================

CREATE OR REPLACE FUNCTION delete_organization(p_org_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uids UUID[];
  v_super_admins INT;
BEGIN
  IF NOT is_platform_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Hanya platform super_admin');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM organizations WHERE id = p_org_id) THEN
    RETURN json_build_object('success', false, 'error', 'Instansi tidak ditemukan');
  END IF;

  -- Pengaman self-delete: instansi yang memuat akun super_admin adalah
  -- instansi induk platform dan tidak boleh dihapus lewat UI.
  SELECT COUNT(*) INTO v_super_admins
  FROM profiles
  WHERE organization_id = p_org_id AND role = 'super_admin';
  IF v_super_admins > 0 THEN
    RETURN json_build_object('success', false,
      'error', 'Instansi ini memuat akun super_admin (instansi induk platform) dan tidak dapat dihapus');
  END IF;

  -- 1. Kumpulkan seluruh user id milik instansi
  SELECT COALESCE(array_agg(id), '{}') INTO v_uids
  FROM profiles WHERE organization_id = p_org_id;

  -- 2. Data transaksional milik member instansi
  DELETE FROM attendance WHERE user_id = ANY(v_uids);
  DELETE FROM employee_schedules WHERE user_id = ANY(v_uids);
  DELETE FROM leave_requests WHERE user_id = ANY(v_uids);
  DELETE FROM device_requests WHERE user_id = ANY(v_uids);
  DELETE FROM user_devices WHERE user_id = ANY(v_uids);
  DELETE FROM otp_codes WHERE user_id = ANY(v_uids);
  DELETE FROM audit_logs WHERE user_id = ANY(v_uids);

  -- 3. Auth users (identities ikut), lalu profiles
  DELETE FROM auth.users WHERE id = ANY(v_uids);
  DELETE FROM profiles WHERE organization_id = p_org_id;

  -- 4. Konfigurasi & seed instansi
  DELETE FROM shift_schedules WHERE organization_id = p_org_id;
  DELETE FROM shifts WHERE organization_id = p_org_id;
  DELETE FROM system_settings WHERE organization_id = p_org_id;
  DELETE FROM attendance_locations WHERE organization_id = p_org_id;
  DELETE FROM announcements WHERE organization_id = p_org_id;
  DELETE FROM positions WHERE organization_id = p_org_id;
  DELETE FROM employment_statuses WHERE organization_id = p_org_id;

  -- 5. Instansinya
  DELETE FROM organizations WHERE id = p_org_id;

  RETURN json_build_object(
    'success', true,
    'deleted_users', COALESCE(array_length(v_uids, 1), 0),
    'message', 'Instansi dan seluruh datanya telah dihapus'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE EXECUTE ON FUNCTION delete_organization(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION delete_organization(uuid) TO authenticated;
