-- =====================================================================
-- MULTI-TENANT FASE 3 — RPC pembuatan instansi + admin pertama
-- Khusus platform super_admin. Trigger seed_org_defaults otomatis
-- mengisi shift, shift_schedules, dan system_settings untuk org baru.
-- Jalankan SETELAH 20260913000003_multi_tenant_rpc_security.sql
-- =====================================================================

-- ---------------------------------------------------------------------
-- Resolve identitas login dari username (dipanggil anon di halaman login).
-- Mengembalikan auth_email saja — TIDAK membuka tabel profiles ke anon.
-- p_org_slug opsional: wajib bila username dipakai di >1 instansi.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION resolve_login_identity(
  p_username TEXT,
  p_org_slug TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_count INT;
BEGIN
  p_username := TRIM(p_username);
  IF p_username IS NULL OR p_username = '' THEN
    RAISE EXCEPTION 'Username tidak boleh kosong';
  END IF;

  IF p_org_slug IS NOT NULL THEN
    SELECT COALESCE(p.auth_email, p.email) INTO v_email
    FROM profiles p
    JOIN organizations o ON o.id = p.organization_id
    WHERE p.username = p_username AND o.slug = LOWER(p_org_slug)
    LIMIT 1;
    IF v_email IS NULL THEN
      RAISE EXCEPTION 'Akun tidak ditemukan. Hubungi admin.';
    END IF;
    RETURN v_email;
  END IF;

  SELECT COUNT(*) INTO v_count FROM profiles WHERE username = p_username;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'Akun tidak ditemukan. Hubungi admin.';
  END IF;
  IF v_count > 1 THEN
    RAISE EXCEPTION 'Username dipakai di beberapa instansi. Login dengan username@kode-instansi';
  END IF;

  SELECT COALESCE(auth_email, email) INTO v_email
  FROM profiles WHERE username = p_username LIMIT 1;
  RETURN v_email;
END;
$$;

GRANT EXECUTE ON FUNCTION resolve_login_identity(text,text) TO anon, authenticated;

-- ---------------------------------------------------------------------
-- RPC pembuatan instansi + admin pertama
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
    role, organization_id, password_changed, created_at
  ) VALUES (
    v_new_user_id, p_admin_username, p_admin_full_name, p_admin_email, v_auth_email,
    'admin_puskesmas'::user_role, v_org_id, false, NOW()
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
