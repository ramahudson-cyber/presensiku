-- =====================================================================
-- MULTI-TENANT FASE 1C — Security fix semua RPC
-- Jalankan SETELAH 20260913000002_multi_tenant_rls_policies.sql
--
-- Strategi:
--  - Fungsi dengan body panjang/tidak terdokumentasi penuh di repo
--    di-RENAME ke *_impl (logika asli utuh), lalu dibuat wrapper dengan
--    nama asli yang menambahkan guard tenant sebelum memanggil impl.
--  - Fungsi yang body-nya diketahui penuh ditulis ulang langsung.
--  - Semua guard memakai helper RLS (current_org_id/is_org_admin/...).
-- Idempotent: rename yang sudah pernah dilakukan dilewati.
-- =====================================================================

-- Guard helper: boleh mengelola user target = diri sendiri, admin org yang
-- sama, atau platform super_admin.
CREATE OR REPLACE FUNCTION can_manage_user(p_target_user UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() = p_target_user
     OR (
       EXISTS (SELECT 1 FROM profiles
               WHERE id = auth.uid() AND role = 'admin_puskesmas')
       AND current_org_id() = (SELECT organization_id FROM profiles WHERE id = p_target_user)
     )
     OR is_platform_admin();
$$;

-- ---------------------------------------------------------------------
-- 1. create_employee_with_auth — tulis ulang penuh (body diketahui):
--    + guard pemanggil: admin instansi / platform
--    + organization_id dari profile PEMANGGIL (server-side, bukan client)
--    + username unik PER INSTANSI
--    + email auth sintetis <slug>__<username>@users.presensiku.app
--      (Supabase Auth butuh email unik global; email asli tetap di
--       profiles.email untuk pengiriman kredensial/OTP)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_employee_with_auth(
  p_username TEXT,
  p_full_name TEXT,
  p_email TEXT,
  p_password TEXT,
  p_role TEXT DEFAULT 'pegawai',
  p_employee_status TEXT DEFAULT 'tpk',
  p_department TEXT DEFAULT NULL,
  p_position TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller RECORD;
  v_org_slug TEXT;
  v_new_user_id UUID;
  v_auth_email TEXT;
  v_encrypted_pw TEXT;
BEGIN
  -- Guard: hanya admin instansi / platform super_admin
  SELECT role, organization_id INTO v_caller FROM profiles WHERE id = auth.uid();
  IF v_caller.role IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Tidak terautentikasi');
  END IF;
  IF v_caller.role NOT IN ('super_admin', 'admin_puskesmas') THEN
    RETURN json_build_object('success', false, 'error', 'Hanya admin yang dapat mendaftarkan pegawai');
  END IF;

  -- Admin instansi tidak boleh membuat admin/super_admin
  IF v_caller.role = 'admin_puskesmas' AND p_role NOT IN ('pegawai', 'kepala_unit') THEN
    RETURN json_build_object('success', false, 'error', 'Admin instansi hanya dapat membuat pegawai/kepala unit');
  END IF;

  IF v_caller.organization_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Akun admin tidak terhubung ke instansi');
  END IF;

  SELECT slug INTO v_org_slug FROM organizations WHERE id = v_caller.organization_id;

  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE username = p_username AND organization_id = v_caller.organization_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Username sudah dipakai di instansi ini');
  END IF;

  v_auth_email := LOWER(v_org_slug || '__' || p_username) || '@users.presensiku.app';

  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_auth_email) THEN
    RETURN json_build_object('success', false, 'error', 'Username sudah terdaftar (auth)');
  END IF;

  v_new_user_id := gen_random_uuid();
  v_encrypted_pw := crypt(p_password, gen_salt('bf'));

  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token, aud, role
  ) VALUES (
    v_new_user_id, '00000000-0000-0000-0000-000000000000',
    v_auth_email, v_encrypted_pw,
    NOW(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('username', p_username, 'full_name', p_full_name),
    NOW(), NOW(), '', '', '', '',
    'authenticated', 'authenticated'
  );

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    v_new_user_id, v_new_user_id,
    jsonb_build_object('sub', v_new_user_id::text, 'email', v_auth_email),
    'email', v_auth_email,
    NOW(), NOW(), NOW()
  );

  INSERT INTO profiles (
    id, username, full_name, email, auth_email,
    role, employee_status, department, position,
    organization_id, password_changed, created_at
  ) VALUES (
    v_new_user_id, p_username, p_full_name, p_email, v_auth_email,
    p_role::user_role, p_employee_status::employee_status, p_department, p_position,
    v_caller.organization_id, false, NOW()
  );

  RETURN json_build_object(
    'success', true,
    'id', v_new_user_id,
    'email', v_auth_email,
    'organization_id', v_caller.organization_id,
    'message', 'Pegawai berhasil didaftarkan'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ---------------------------------------------------------------------
-- 2. delete_employee_with_auth — guard: admin org yang sama, target bukan
--    super_admin. (Definisi lama tidak ada di repo; dibuat baru. Return
--    JSON — client hanya membaca error.)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION delete_employee_with_auth(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target RECORD;
BEGIN
  IF NOT can_manage_user(p_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Tidak berhak menghapus user ini');
  END IF;

  SELECT role, organization_id INTO v_target FROM profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User tidak ditemukan');
  END IF;
  IF v_target.role = 'super_admin' THEN
    RETURN json_build_object('success', false, 'error', 'Tidak dapat menghapus super_admin');
  END IF;

  DELETE FROM auth.users WHERE id = p_user_id;
  -- profiles terhapus via FK cascade bila dikonfigurasi; fallback manual:
  DELETE FROM profiles WHERE id = p_user_id;

  RETURN json_build_object('success', true, 'message', 'Pegawai dihapus');
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ---------------------------------------------------------------------
-- 3. RPC device — wrapper guard di atas *_impl (logika asli dipertahankan)
-- ---------------------------------------------------------------------

-- 3a. check_device_binding — hanya untuk diri sendiri
DO $$ BEGIN
  ALTER FUNCTION check_device_binding(uuid,text,text,text,text,text,text,text)
    RENAME TO check_device_binding_impl;
EXCEPTION WHEN undefined_function THEN NULL; WHEN duplicate_function THEN NULL; END $$;

CREATE OR REPLACE FUNCTION check_device_binding(
  p_user_id UUID, p_visitor_id TEXT,
  p_device_name TEXT DEFAULT NULL, p_device_os TEXT DEFAULT NULL,
  p_device_browser TEXT DEFAULT NULL, p_device_type TEXT DEFAULT 'web',
  p_imei TEXT DEFAULT NULL, p_serial TEXT DEFAULT NULL
) RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN json_build_object('canLogin', false, 'requiresOtp', false,
      'message', 'Gagal cek device: tidak berhak');
  END IF;
  RETURN check_device_binding_impl(p_user_id, p_visitor_id, p_device_name,
    p_device_os, p_device_browser, p_device_type, p_imei, p_serial);
END;
$$;

-- 3b. create_device_request — hanya untuk diri sendiri
DO $$ BEGIN
  ALTER FUNCTION create_device_request(uuid,text,text,text,text,text,text,text)
    RENAME TO create_device_request_impl;
EXCEPTION WHEN undefined_function THEN NULL; WHEN duplicate_function THEN NULL; END $$;

CREATE OR REPLACE FUNCTION create_device_request(
  p_user_id UUID, p_visitor_id TEXT,
  p_device_name TEXT DEFAULT NULL, p_device_os TEXT DEFAULT NULL,
  p_device_browser TEXT DEFAULT NULL, p_device_type TEXT DEFAULT 'web',
  p_imei TEXT DEFAULT NULL, p_serial TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Tidak berhak membuat device request untuk user lain';
  END IF;
  SELECT create_device_request_impl(p_user_id, p_visitor_id, p_device_name,
    p_device_os, p_device_browser, p_device_type, p_imei, p_serial) INTO v_id;
  RETURN v_id;
END;
$$;

-- 3c. approve/reject device request — admin org yang sama / platform
DO $$ BEGIN
  ALTER FUNCTION approve_device_request(uuid) RENAME TO approve_device_request_impl;
EXCEPTION WHEN undefined_function THEN NULL; WHEN duplicate_function THEN NULL; END $$;

CREATE OR REPLACE FUNCTION approve_device_request(p_request_id UUID)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org UUID;
BEGIN
  SELECT organization_id INTO v_org FROM device_requests WHERE id = p_request_id;
  IF NOT is_platform_admin() AND NOT (
    is_org_admin() AND v_org = current_org_id()
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Tidak berhak menyetujui request ini');
  END IF;
  RETURN approve_device_request_impl(p_request_id);
END;
$$;

DO $$ BEGIN
  ALTER FUNCTION reject_device_request(uuid,text) RENAME TO reject_device_request_impl;
EXCEPTION WHEN undefined_function THEN NULL; WHEN duplicate_function THEN NULL; END $$;

CREATE OR REPLACE FUNCTION reject_device_request(p_request_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org UUID;
BEGIN
  SELECT organization_id INTO v_org FROM device_requests WHERE id = p_request_id;
  IF NOT is_platform_admin() AND NOT (
    is_org_admin() AND v_org = current_org_id()
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Tidak berhak menolak request ini');
  END IF;
  RETURN reject_device_request_impl(p_request_id, p_reason);
END;
$$;

-- 3d. get_pending_device_requests — filter org pemanggil
DO $$ BEGIN
  ALTER FUNCTION get_pending_device_requests() RENAME TO get_pending_device_requests_impl;
EXCEPTION WHEN undefined_function THEN NULL; WHEN duplicate_function THEN NULL; END $$;

CREATE OR REPLACE FUNCTION get_pending_device_requests()
RETURNS TABLE (
  id UUID, user_id UUID, user_name TEXT, user_email TEXT,
  visitor_id TEXT, device_name TEXT, device_os TEXT, device_browser TEXT,
  device_type TEXT, imei TEXT, serial TEXT, created_at TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF is_platform_admin() THEN
    RETURN QUERY SELECT * FROM get_pending_device_requests_impl();
  ELSE
    RETURN QUERY
    SELECT p.* FROM get_pending_device_requests_impl() p
    JOIN profiles pr ON pr.id = p.user_id
    WHERE pr.organization_id = current_org_id();
  END IF;
END;
$$;

-- 3e. reset_user_device — admin org yang sama / platform
DO $$ BEGIN
  ALTER FUNCTION reset_user_device(uuid,text) RENAME TO reset_user_device_impl;
EXCEPTION WHEN undefined_function THEN NULL; WHEN duplicate_function THEN NULL; END $$;

CREATE OR REPLACE FUNCTION reset_user_device(p_user_id UUID, p_visitor_id TEXT DEFAULT NULL)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count INT;
BEGIN
  IF NOT can_manage_user(p_user_id) THEN
    RAISE EXCEPTION 'Tidak berhak mereset device user ini';
  END IF;
  SELECT reset_user_device_impl(p_user_id, p_visitor_id) INTO v_count;
  RETURN v_count;
END;
$$;

-- 3f. OTP — hanya untuk diri sendiri
DO $$ BEGIN
  ALTER FUNCTION generate_otp_code(uuid) RENAME TO generate_otp_code_impl;
EXCEPTION WHEN undefined_function THEN NULL; WHEN duplicate_function THEN NULL; END $$;

CREATE OR REPLACE FUNCTION generate_otp_code(p_user_id UUID)
RETURNS VARCHAR
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_otp VARCHAR(6);
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Tidak berhak generate OTP user lain';
  END IF;
  SELECT generate_otp_code_impl(p_user_id) INTO v_otp;
  RETURN v_otp;
END;
$$;

DO $$ BEGIN
  ALTER FUNCTION verify_otp_code(uuid,varchar) RENAME TO verify_otp_code_impl;
EXCEPTION WHEN undefined_function THEN NULL; WHEN duplicate_function THEN NULL; END $$;

CREATE OR REPLACE FUNCTION verify_otp_code(p_user_id UUID, p_otp VARCHAR)
RETURNS TABLE(is_valid BOOLEAN, message TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN QUERY SELECT false::BOOLEAN, 'Tidak berhak'::TEXT;
  END IF;
  RETURN QUERY SELECT * FROM verify_otp_code_impl(p_user_id, p_otp);
END;
$$;

-- ---------------------------------------------------------------------
-- 4. set_system_setting — admin org; tersimpan per instansi
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_system_setting(
  p_setting_key TEXT,
  p_value TEXT,
  p_category TEXT DEFAULT 'general'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_org_admin() THEN
    RAISE EXCEPTION 'Hanya admin yang dapat mengubah pengaturan';
  END IF;
  INSERT INTO system_settings (organization_id, setting_key, value, category, updated_at)
  VALUES (current_org_id(), p_setting_key, p_value, p_category, NOW())
  ON CONFLICT (organization_id, setting_key)
  DO UPDATE SET value = p_value, category = p_category, updated_at = NOW();
END;
$$;

-- ---------------------------------------------------------------------
-- 5. Lokasi absensi — per instansi
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_active_location()
RETURNS SETOF attendance_locations
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM attendance_locations
  WHERE is_active = true AND organization_id = current_org_id()
  LIMIT 1;
$$;

DO $$ BEGIN
  ALTER FUNCTION verify_attendance_location(double precision,double precision,double precision)
    RENAME TO verify_attendance_location_impl;
EXCEPTION WHEN undefined_function THEN NULL; WHEN duplicate_function THEN NULL; END $$;

-- NOTE: wrapper mengganti pemilihan lokasi ke instansi pemanggil, lalu
-- memvalidasi jarak memakai logika haversine standar (sesuai awal fungsi
-- asli). Kolom tambahan impl (jika ada) tidak dipanggil lagi.
CREATE OR REPLACE FUNCTION verify_attendance_location(
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_accuracy DOUBLE PRECISION DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_location attendance_locations%ROWTYPE;
  v_distance DOUBLE PRECISION;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Tidak terautentikasi');
  END IF;

  SELECT * INTO v_location FROM attendance_locations
  WHERE is_active = true AND organization_id = current_org_id()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Tidak ada lokasi instansi aktif',
      'distance', null, 'radius', null);
  END IF;

  v_distance := 6371000 * acos(
    LEAST(1.0, GREATEST(-1.0,
      cos(radians(p_latitude)) * cos(radians(v_location.latitude)) *
      cos(radians(v_location.longitude) - radians(p_longitude)) +
      sin(radians(p_latitude)) * sin(radians(v_location.latitude))
    ))
  );

  RETURN jsonb_build_object(
    'valid', v_distance <= v_location.radius_meter,
    'distance', ROUND(v_distance::numeric, 2),
    'radius', v_location.radius_meter,
    'location_name', v_location.name
  );
END;
$$;

-- ---------------------------------------------------------------------
-- 6. Leave approval — admin org yang sama / platform
-- ---------------------------------------------------------------------
DO $$ BEGIN
  ALTER FUNCTION approve_leave_request(uuid) RENAME TO approve_leave_request_impl;
EXCEPTION WHEN undefined_function THEN NULL; WHEN duplicate_function THEN NULL; END $$;

CREATE OR REPLACE FUNCTION approve_leave_request(p_request_id UUID)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org UUID;
BEGIN
  SELECT organization_id INTO v_org FROM leave_requests WHERE id = p_request_id;
  IF NOT is_platform_admin() AND NOT (
    is_org_admin() AND v_org = current_org_id()
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Tidak berhak menyetujui pengajuan ini');
  END IF;
  RETURN approve_leave_request_impl(p_request_id);
END;
$$;

DO $$ BEGIN
  ALTER FUNCTION reject_leave_request(uuid,text) RENAME TO reject_leave_request_impl;
EXCEPTION WHEN undefined_function THEN NULL; WHEN duplicate_function THEN NULL; END $$;

CREATE OR REPLACE FUNCTION reject_leave_request(p_request_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org UUID;
BEGIN
  SELECT organization_id INTO v_org FROM leave_requests WHERE id = p_request_id;
  IF NOT is_platform_admin() AND NOT (
    is_org_admin() AND v_org = current_org_id()
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Tidak berhak menolak pengajuan ini');
  END IF;
  RETURN reject_leave_request_impl(p_request_id, p_reason);
END;
$$;

-- ---------------------------------------------------------------------
-- 7. REVOKE akses anon pada RPC sensitif (semua dibuka untuk authenticated)
-- ---------------------------------------------------------------------
DO $$
DECLARE fn RECORD;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS func
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'create_employee_with_auth','delete_employee_with_auth',
        'check_device_binding','create_device_request',
        'approve_device_request','reject_device_request',
        'get_pending_device_requests','reset_user_device',
        'generate_otp_code','verify_otp_code','set_system_setting',
        'verify_attendance_location','approve_leave_request','reject_leave_request',
        'create_organization_with_admin'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, public', fn.func);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn.func);
  END LOOP;
END $$;
