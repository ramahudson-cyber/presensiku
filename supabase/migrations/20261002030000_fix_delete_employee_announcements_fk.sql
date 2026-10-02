-- =====================================================================
-- Fix: admin tidak bisa hapus pegawai yang pernah menerbitkan pengumuman
-- Error: update or delete on table "profiles" violates foreign key
--        constraint "announcements_published_by_fkey" on table "announcements"
-- Penyebab:
--   1. announcements.published_by → profiles FK default NO ACTION, sementara
--      FK kepemilikan lain sudah SET NULL (employee_schedules.created_by,
--      attendance_locations.created_by, leave_requests.approved_by).
--   2. RPC delete_employee_with_auth tidak membersihkan data transaksional
--      per-user sebelum menghapus auth.users (pola cleanup hapus instansi
--      20260926000002 tidak diterapkan di sini).
-- Solusi (menjaga perilaku sistem lain tetap utuh):
--   - FK → ON DELETE SET NULL: pengumuman tetap tersimpan, publisher anonim.
--   - RPC: cleanup per-user (attendance, employee_schedules, dst) sebelum
--     hapus auth — identik dengan pola delete_organization.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. published_by harus boleh NULL agar SET NULL bekerja
--    (no-op bila kolom sudah nullable)
-- ---------------------------------------------------------------------
ALTER TABLE public.announcements ALTER COLUMN published_by DROP NOT NULL;

-- ---------------------------------------------------------------------
-- 2. Bersihkan published_by yatim (kalau ada) agar constraint baru
--    lolos validasi
-- ---------------------------------------------------------------------
UPDATE public.announcements a
   SET published_by = NULL
 WHERE a.published_by IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = a.published_by);

-- ---------------------------------------------------------------------
-- 3. Ganti FK: NO ACTION → ON DELETE SET NULL
-- ---------------------------------------------------------------------
ALTER TABLE public.announcements
  DROP CONSTRAINT IF EXISTS announcements_published_by_fkey;

ALTER TABLE public.announcements
  ADD CONSTRAINT announcements_published_by_fkey
  FOREIGN KEY (published_by) REFERENCES public.profiles(id)
  ON DELETE SET NULL;

-- ---------------------------------------------------------------------
-- 4. RPC delete_employee_with_auth — logika otorisasi dipertahankan
--    persis (20260924000003), hanya ditambah cleanup per-user sebelum
--    menghapus auth.users
-- ---------------------------------------------------------------------
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
