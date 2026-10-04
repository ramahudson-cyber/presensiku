-- =====================================================================
-- STATUS KEPEGAWAIAN OPSIONAL & UNIVERSAL
--
-- Masalah: profiles.employee_status punya DEFAULT 'asn' + NOT NULL,
-- sehingga akun admin instansi yang dibuat lewat "Tambah Instansi"
-- (create_organization_with_admin tidak menyebut kolom ini) otomatis
-- berstatus ASN tanpa super admin memilih apa pun. Enum juga terkunci
-- ke 4 nilai pemerintahan (asn, pppk_penuh_waktu, pppk_paruh_waktu, tpk)
-- padahal aplikasi ini universal — instansi non-pemerintah butuh status
-- versinya sendiri.
--
-- Perubahan:
--   1. DROP DEFAULT + DROP NOT NULL — status opsional, boleh kosong.
--   2. Enum → text bebas (data lama utuh: 'asn' dst. tetap tersimpan).
--      Daftar pilihan status kini murni dari master employment_statuses
--      yang bisa dikelola tiap instansi (Master Data).
--   3. create_organization_with_admin: insert profil admin dengan
--      employee_status eksplisit NULL.
--   4. create_employee_with_auth: status kosong → NULL (bukan dipaksa
--      'tpk'), nilai bebas diterima apa adanya (TRIM), tanpa validasi
--      enum pemerintahan.
--
-- TIDAK ada mass-update data lama: nilai 'asn'/'tpk' yang sudah
-- tersimpan adalah historis yang tercetak di slip gaji & rekap; koreksi
-- per orang cukup lewat halaman Pegawai.
-- Tipe enum lama tidak di-drop (tidak mengganggu, menghindari error
-- dependensi tersembunyi).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Kolom: opsional + text bebas
-- ---------------------------------------------------------------------
ALTER TABLE profiles
  ALTER COLUMN employee_status DROP DEFAULT,
  ALTER COLUMN employee_status DROP NOT NULL,
  ALTER COLUMN employee_status TYPE text USING employee_status::text;

-- ---------------------------------------------------------------------
-- 2. Tambah instansi: admin baru tanpa status bawaan
--    (identik dengan versi live — hasil patch rename role 'admin' —
--    plus kolom employee_status eksplisit NULL)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_organization_with_admin(
  p_org_name TEXT,
  p_slug TEXT,
  p_admin_username TEXT,
  p_admin_full_name TEXT,
  p_admin_email TEXT,
  p_admin_password TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_slug TEXT;
  v_org_id UUID;
  v_new_user_id UUID;
  v_auth_email TEXT;
  v_encrypted_pw TEXT;
BEGIN
  IF NOT is_platform_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Hanya platform super_admin');
  END IF;

  v_slug := LOWER(TRIM(p_slug));
  IF v_slug IS NULL OR v_slug = '' OR v_slug !~ '^[a-z0-9][a-z0-9-]{1,40}$' THEN
    RETURN json_build_object('success', false,
      'error', 'Slug tidak valid (a-z, 0-9, tanda -, 2-41 karakter)');
  END IF;

  IF EXISTS (SELECT 1 FROM organizations WHERE slug = v_slug) THEN
    RETURN json_build_object('success', false, 'error', 'Slug instansi sudah dipakai');
  END IF;

  -- 1. Buat instansi (trigger seed shift + schedule + settings jalan otomatis)
  INSERT INTO organizations (name, slug) VALUES (p_org_name, v_slug)
  RETURNING id INTO v_org_id;

  -- 2. Buat akun admin instansi
  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE username = p_admin_username AND organization_id = v_org_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Username admin sudah dipakai');
  END IF;

  v_auth_email := LOWER(v_slug || '__' || p_admin_username) || '@users.presensiku.app';

  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_auth_email) THEN
    RETURN json_build_object('success', false, 'error', 'Username admin sudah terdaftar (auth)');
  END IF;

  v_new_user_id := gen_random_uuid();
  v_encrypted_pw := crypt(p_admin_password, gen_salt('bf'));

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
    jsonb_build_object('username', p_admin_username, 'full_name', p_admin_full_name),
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
    role, employee_status, organization_id, password_changed, created_at
  ) VALUES (
    v_new_user_id, p_admin_username, p_admin_full_name, p_admin_email, v_auth_email,
    'admin'::user_role, NULL, v_org_id, false, NOW()
  );

  RETURN json_build_object(
    'success', true,
    'organization_id', v_org_id,
    'admin_id', v_new_user_id,
    'login', p_admin_username || '@' || v_slug,
    'message', 'Instansi dan admin berhasil dibuat'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE EXECUTE ON FUNCTION create_organization_with_admin(text,text,text,text,text,text)
  FROM anon, public;
GRANT EXECUTE ON FUNCTION create_organization_with_admin(text,text,text,text,text,text)
  TO authenticated;

-- ---------------------------------------------------------------------
-- 3. Buat pegawai: status kosong → NULL, nilai bebas (universal)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_employee_with_auth(
  p_username TEXT,
  p_full_name TEXT,
  p_email TEXT,
  p_password TEXT,
  p_role TEXT DEFAULT 'pegawai',
  p_employee_status TEXT DEFAULT NULL,
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
  v_org_id UUID;
  v_org_slug TEXT;
  v_new_user_id UUID;
  v_auth_email TEXT;
  v_encrypted_pw TEXT;
  v_role TEXT;
  v_status TEXT;
BEGIN
  SELECT role INTO v_caller FROM profiles WHERE id = auth.uid();
  IF v_caller.role IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Tidak terautentikasi');
  END IF;
  IF v_caller.role NOT IN ('super_admin', 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Hanya admin yang dapat mendaftarkan pegawai');
  END IF;

  -- Admin instansi tidak boleh membuat admin/super_admin
  IF v_caller.role = 'admin' AND LOWER(TRIM(p_role)) NOT IN ('pegawai', 'kepala_unit') THEN
    RETURN json_build_object('success', false, 'error', 'Admin instansi hanya dapat membuat pegawai/kepala unit');
  END IF;

  -- Org tujuan = instansi aktif (override untuk super_admin yang switch)
  v_org_id := current_org_id();
  IF v_org_id IS NULL THEN
    RETURN json_build_object('success', false, 'error',
      'Pilih instansi dulu: buka Kelola Instansi → Masuk sebagai Admin');
  END IF;

  -- Normalisasi role: trim + lowercase, default pegawai, validasi enum
  v_role := LOWER(TRIM(COALESCE(NULLIF(p_role, ''), 'pegawai')));
  IF NOT EXISTS (
    SELECT 1 FROM unnest(enum_range(NULL::user_role)) e WHERE e::text = v_role
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Role tidak valid: ' || p_role);
  END IF;

  -- Status kepegawaian: opsional & bebas (universal). Kosong → NULL.
  -- Daftar pilihan dikendalikan tiap instansi via master employment_statuses.
  v_status := NULLIF(TRIM(p_employee_status), '');

  SELECT slug INTO v_org_slug FROM organizations WHERE id = v_org_id;

  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE username = p_username AND organization_id = v_org_id
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
    v_role::user_role, v_status, p_department, p_position,
    v_org_id, false, NOW()
  );

  RETURN json_build_object(
    'success', true,
    'id', v_new_user_id,
    'email', v_auth_email,
    'organization_id', v_org_id,
    'message', 'Pegawai berhasil didaftarkan'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

NOTIFY pgrst, 'reload schema';
