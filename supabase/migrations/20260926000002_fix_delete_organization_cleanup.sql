-- Perbaikan delete_organization: penghapusan instansi sebelumnya gagal FK karena
-- tiga tabel berelasi tidak dibersihkan saat data anggota sudah tidak ada:
--   audit_logs, device_requests, employee_schedules (dan calon yatim lain).
-- Penanganan:
--   - employee_schedules & user_devices yatim → dihapus (tidak berguna tanpa anggota).
--   - audit_logs & device_requests → organization_id di-NULL-kan (riwayat dipertahankan).
--   - attendance/leave_requests yatim per-instansi → dihapus (superset dari cleanup
--     per-user, menjaga RPC tetap benar untuk instansi ber-anggota maupun kosong).
-- Perilaku lama dipertahankan: guard platform admin, guard instansi induk
-- super_admin, urutan hapus, dan handler EXCEPTION berbasis JSON.

CREATE OR REPLACE FUNCTION public.delete_organization(p_org_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- 3b. Sisa data per-instansi yang tidak tercakup cleanup per-user_id.
  DELETE FROM attendance WHERE organization_id = p_org_id;
  DELETE FROM leave_requests WHERE organization_id = p_org_id;
  DELETE FROM employee_schedules WHERE organization_id = p_org_id;
  DELETE FROM user_devices WHERE organization_id = p_org_id;
  UPDATE audit_logs SET organization_id = NULL WHERE organization_id = p_org_id;
  UPDATE device_requests SET organization_id = NULL WHERE organization_id = p_org_id;

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
$function$;

NOTIFY pgrst, 'reload schema';
