-- =====================================================================
-- PLATFORM ORG SWITCH: super_admin "masuk" ke instansi manapun dengan
-- akses penuh via RLS, tanpa mengubah JWT/session.
--
-- Mekanisme:
--   profiles.active_org_override (UUID, nullable) = instansi aktif saat
--   switch. current_org_id() membaca COALESCE(override, organization_id)
--   — override HANYA efektif untuk role super_admin. Semua policy/RPC
--   yang memakai current_org_id() otomatis mengikuti instansi target.
-- =====================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS active_org_override UUID;
DO $$ BEGIN
  ALTER TABLE profiles ADD CONSTRAINT profiles_active_org_override_fkey
    FOREIGN KEY (active_org_override) REFERENCES organizations(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- current_org_id: override hanya untuk platform super_admin
CREATE OR REPLACE FUNCTION current_org_id() RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN role = 'super_admin' THEN COALESCE(active_org_override, organization_id)
    ELSE organization_id
  END
  FROM profiles WHERE id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- RPC: masuk ke instansi (khusus platform super_admin)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION platform_switch_to_org(p_org_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_org organizations%ROWTYPE;
BEGIN
  IF NOT is_platform_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Hanya platform super_admin');
  END IF;

  SELECT * INTO v_org FROM organizations WHERE id = p_org_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Instansi tidak ditemukan');
  END IF;
  IF NOT v_org.is_active THEN
    RETURN json_build_object('success', false, 'error', 'Instansi sedang disuspend');
  END IF;

  UPDATE profiles SET active_org_override = p_org_id WHERE id = auth.uid();

  RETURN json_build_object(
    'success', true,
    'organization', json_build_object('id', v_org.id, 'name', v_org.name, 'slug', v_org.slug),
    'message', 'Kini mengakses instansi: ' || v_org.name
  );
END;
$$;

-- ---------------------------------------------------------------------
-- RPC: kembali ke platform
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION platform_switch_back()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_name TEXT;
BEGIN
  IF NOT is_platform_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Hanya platform super_admin');
  END IF;

  SELECT o.name INTO v_name FROM profiles p
  JOIN organizations o ON o.id = p.active_org_override
  WHERE p.id = auth.uid();

  UPDATE profiles SET active_org_override = NULL WHERE id = auth.uid();

  RETURN json_build_object('success', true,
    'message', COALESCE(v_name, 'Tidak sedang switch') || ' — kembali ke akses platform');
END;
$$;

REVOKE EXECUTE ON FUNCTION platform_switch_to_org(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION platform_switch_back() FROM anon, public;
GRANT EXECUTE ON FUNCTION platform_switch_to_org(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION platform_switch_back() TO authenticated;

-- ---------------------------------------------------------------------
-- create_employee_with_auth: org diambil dari current_org_id() agar
-- super_admin yang sedang switch mendaftarkan pegawai di instansi target
-- (sebelumnya memakai organization_id mentah → super_admin ter-detach
-- selalu gagal guard NULL).
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

  -- Normalisasi status kepegawaian: trim + lowercase + spasi→underscore
  v_status := LOWER(TRIM(COALESCE(NULLIF(p_employee_status, ''), 'tpk')));
  v_status := REPLACE(v_status, ' ', '_');
  IF NOT EXISTS (
    SELECT 1 FROM unnest(enum_range(NULL::employee_status)) e WHERE e::text = v_status
  ) THEN
    RETURN json_build_object('success', false, 'error',
      'Status kepegawaian tidak valid: "' || p_employee_status ||
      '". Nilai yang tersedia: asn, pppk_penuh_waktu, pppk_paruh_waktu, tpk');
  END IF;

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
    v_role::user_role, v_status::employee_status, p_department, p_position,
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
