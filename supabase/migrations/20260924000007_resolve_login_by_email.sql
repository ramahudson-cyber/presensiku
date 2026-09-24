-- ============================================================
-- MIGRATION: Login dengan username atau email terdaftar
-- ============================================================
-- profiles.email adalah email kontak; profiles.auth_email adalah email
-- canonical Supabase Auth untuk akun baru. Keduanya dapat menjadi input.
-- RPC hanya mengembalikan email Auth dan tidak membuka row profiles.
-- ============================================================

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
  v_identifier TEXT := LOWER(TRIM(COALESCE(p_username, '')));
  v_slug TEXT := LOWER(TRIM(COALESCE(p_org_slug, '')));
  v_email TEXT;
  v_count INTEGER;
BEGIN
  IF v_identifier = '' THEN
    RAISE EXCEPTION 'Username atau email wajib diisi';
  END IF;

  -- Namespace username@slug tetap didukung. Email berdomain titik tidak
  -- dipotong di client; email kontak juga harus melewati resolver ini.
  IF v_slug <> '' THEN
    SELECT COUNT(*) INTO v_count
    FROM profiles p
    JOIN organizations o ON o.id = p.organization_id
    WHERE LOWER(p.username) = v_identifier
      AND LOWER(o.slug) = v_slug;

    IF v_count = 0 THEN
      RAISE EXCEPTION 'Akun tidak ditemukan. Hubungi admin.';
    END IF;
    IF v_count > 1 THEN
      RAISE EXCEPTION 'Identitas login ambigu. Hubungi admin.';
    END IF;

    SELECT COALESCE(NULLIF(TRIM(p.auth_email), ''), NULLIF(TRIM(p.email), ''))
      INTO v_email
    FROM profiles p
    JOIN organizations o ON o.id = p.organization_id
    WHERE LOWER(p.username) = v_identifier
      AND LOWER(o.slug) = v_slug;
  ELSE
    SELECT COUNT(*) INTO v_count
    FROM profiles p
    WHERE LOWER(p.username) = v_identifier
       OR LOWER(p.email) = v_identifier
       OR LOWER(p.auth_email) = v_identifier;

    IF v_count = 0 THEN
      RAISE EXCEPTION 'Akun tidak ditemukan. Hubungi admin.';
    END IF;
    IF v_count > 1 THEN
      RAISE EXCEPTION 'Identitas login ambigu. Gunakan username@kode-instansi.';
    END IF;

    SELECT COALESCE(NULLIF(TRIM(p.auth_email), ''), NULLIF(TRIM(p.email), ''))
      INTO v_email
    FROM profiles p
    WHERE LOWER(p.username) = v_identifier
       OR LOWER(p.email) = v_identifier
       OR LOWER(p.auth_email) = v_identifier;
  END IF;

  IF COALESCE(TRIM(v_email), '') = '' THEN
    RAISE EXCEPTION 'Email login belum tersedia. Hubungi admin.';
  END IF;

  RETURN v_email;
END;
$$;

REVOKE ALL ON FUNCTION resolve_login_identity(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION resolve_login_identity(text, text) TO anon, authenticated;
