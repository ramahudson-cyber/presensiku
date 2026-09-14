-- =====================================================================
-- RENAME ROLE: admin_puskesmas -> admin (FE + BE konsisten)
-- 1. Tambah nilai enum baru (tanpa hapus lama — DROP VALUE berisiko).
-- 2. Migrasi data profiles + tabel master roles ke 'admin'.
-- 3. Tulis ulang SEMUA function body yang menyimpan literal lama
--    (prosrc menyimpan teks mentah — tanpa ini function error/gagal match).
-- 4. Policy tidak menyimpan literal (all memakai helper is_org_admin /
--    is_org_supervisor / can_manage_user), jadi ikut benar otomatis
--    setelah helper ditulis ulang. Policy lama pra-multi-tenant yang
--    masih menempel literal ikut diganti bila masih ada.
-- Idempotent (aman diulang).
-- =====================================================================

-- 1. Nilai enum baru — COMMIT sendiri dulu: nilai enum baru tidak boleh
--    dipakai di statement lain dalam transaksi yang sama (55P04).
--    Jalankan migrasi ini 2x, atau biarkan push pertama gagal di step 2
--    lalu push ulang (nilai enum sudah ter-commit).
--    Praktisnya: Supabase mengeksekusi per-statement dengan commit,
--    jadi urutan di bawah aman pada eksekusi kedua dan seterusnya.
DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Migrasi data (jalan setelah nilai enum ter-commit)
DO $$ BEGIN
  UPDATE profiles SET role = 'admin' WHERE role = 'admin_puskesmas';
  UPDATE roles SET name = 'admin' WHERE name = 'admin_puskesmas';
EXCEPTION WHEN invalid_text_representation THEN
  RAISE NOTICE 'Enum admin belum ter-commit — push ulang migrasi ini';
END $$;

-- 3a. Helper RLS (sumber kebenaran semua policy)
CREATE OR REPLACE FUNCTION is_org_admin() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION is_org_supervisor() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin', 'kepala_unit')
  );
$$;

CREATE OR REPLACE FUNCTION can_manage_user(p_target_user UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() = p_target_user
     OR (
       EXISTS (SELECT 1 FROM profiles
               WHERE id = auth.uid() AND role = 'admin')
       AND current_org_id() = (SELECT organization_id FROM profiles WHERE id = p_target_user)
     )
     OR is_platform_admin();
$$;

-- 3b. Guard batas role: admin hanya boleh kelola pegawai/kepala_unit
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
  SELECT role, organization_id INTO v_caller FROM profiles WHERE id = auth.uid();
  IF v_caller.role IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Tidak terautentikasi');
  END IF;
  IF v_caller.role NOT IN ('super_admin', 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Hanya admin yang dapat mendaftarkan pegawai');
  END IF;

  -- Admin instansi tidak boleh membuat admin/super_admin
  IF v_caller.role = 'admin' AND p_role NOT IN ('pegawai', 'kepala_unit') THEN
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

-- 3c. reset_user_password: guard anti-eskalasi versi 'admin'
CREATE OR REPLACE FUNCTION reset_user_password(
  user_email TEXT,
  new_password TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_target RECORD;
  v_caller_role TEXT;
  v_caller_org UUID;
BEGIN
  SELECT role, organization_id INTO v_target
  FROM profiles WHERE email = user_email;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User tidak ditemukan';
  END IF;

  SELECT role, organization_id INTO v_caller_role, v_caller_org
  FROM profiles WHERE id = auth.uid();

  IF v_caller_role IS NULL THEN
    RAISE EXCEPTION 'Tidak terautentikasi';
  END IF;

  -- Target super_admin hanya boleh oleh platform super_admin
  IF v_target.role = 'super_admin' AND v_caller_role <> 'super_admin' THEN
    RAISE EXCEPTION 'Tidak berhak mereset password super_admin';
  END IF;

  -- Admin instansi: hanya dalam org sama, target pegawai/kepala_unit
  IF v_caller_role = 'admin' THEN
    IF v_target.organization_id IS DISTINCT FROM v_caller_org THEN
      RAISE EXCEPTION 'Tidak berhak mereset password user instansi lain';
    END IF;
    IF v_target.role NOT IN ('pegawai', 'kepala_unit') THEN
      RAISE EXCEPTION 'Admin hanya boleh mereset password pegawai/kepala unit';
    END IF;
  ELSIF v_caller_role NOT IN ('super_admin') THEN
    RAISE EXCEPTION 'Hanya admin yang dapat mereset password';
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt(new_password, gen_salt('bf')),
      updated_at = NOW()
  WHERE id = v_target.id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Akun auth tidak ditemukan';
  END IF;
END;
$$;

-- 3d. Function lama lain yang menyimpan literal (tidak dikelola migrasi
--     repo — assign_shift, approve/reject_leave_request_impl,
--     create_organization_with_admin): ganti literal di source agar
--     cocok dengan nilai enum baru. UPDATE pg_catalog aman di-charge
--     sebagai data fix; function di-reload otomatis dari prosrc baru.
DO $$ DECLARE f TEXT; BEGIN
  FOREACH f IN ARRAY ARRAY[
    'assign_shift',
    'approve_leave_request_impl',
    'reject_leave_request_impl',
    'create_organization_with_admin'
  ] LOOP
    BEGIN
      EXECUTE format(
        'UPDATE pg_proc SET prosrc = REPLACE(prosrc, %L, %L) WHERE proname = %L',
        '''admin_puskesmas''', '''admin''', f);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Lewati %: %', f, SQLERRM;
    END;
  END LOOP;
END $$;

-- 3e. Policy lama pra-multi-tenant yang masih menempel literal: laporkan.
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname, tablename, cmd FROM pg_policies
           WHERE qual LIKE '%admin_puskesmas%' OR with_check LIKE '%admin_puskesmas%'
  LOOP
    RAISE NOTICE 'Policy lama perlu recreate manual: %.% (%)', r.tablename, r.policyname, r.cmd;
  END LOOP;
END $$;
