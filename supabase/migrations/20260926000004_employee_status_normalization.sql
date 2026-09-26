-- =====================================================================
-- FIX: invalid input value for enum employee_status ("TPK")
-- Dropdown status kepegawaian memakai master `employment_statuses`
-- (nama bebas, bisa "TPK"/"TPK Penuh Waktu"), sedangkan enum
-- employee_status berisi lowercase dengan underscore (tpk, asn,
-- pppk_penuh_waktu, pppk_paruh_waktu). RPC kini menormalisasi input
-- (trim, lowercase, spasi→underscore) + validasi dengan pesan ramah,
-- untuk p_role dan p_employee_status.
-- Idempotent (CREATE OR REPLACE).
-- =====================================================================

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
  v_role TEXT;
  v_status TEXT;
BEGIN
  SELECT role, organization_id INTO v_caller FROM profiles WHERE id = auth.uid();
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

  IF v_caller.organization_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Akun admin tidak terhubung ke instansi');
  END IF;

  -- Normalisasi role: trim + lowercase, default pegawai, validasi enum
  v_role := LOWER(TRIM(COALESCE(NULLIF(p_role, ''), 'pegawai')));
  IF NOT EXISTS (
    SELECT 1 FROM unnest(enum_range(NULL::user_role)) e WHERE e::text = v_role
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Role tidak valid: ' || p_role);
  END IF;

  -- Normalisasi status kepegawaian: trim + lowercase + spasi→underscore,
  -- default tpk, validasi enum dengan pesan ramah.
  -- Contoh yang kini cocok: "TPK"→tpk, "ASN"→asn,
  -- "Pppk Penuh Waktu"→pppk_penuh_waktu.
  v_status := LOWER(TRIM(COALESCE(NULLIF(p_employee_status, ''), 'tpk')));
  v_status := REPLACE(v_status, ' ', '_');
  IF NOT EXISTS (
    SELECT 1 FROM unnest(enum_range(NULL::employee_status)) e WHERE e::text = v_status
  ) THEN
    RETURN json_build_object('success', false, 'error',
      'Status kepegawaian tidak valid: "' || p_employee_status ||
      '". Nilai yang tersedia: asn, pppk_penuh_waktu, pppk_paruh_waktu, tpk');
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
    v_role::user_role, v_status::employee_status, p_department, p_position,
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
