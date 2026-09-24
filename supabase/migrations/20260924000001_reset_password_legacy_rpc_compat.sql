-- ============================================================
-- MIGRATION: Kompatibilitas RPC reset password versi frontend lama
-- ============================================================
-- Bundle web lama masih mengirim { user_email, new_password }.
-- Wrapper ini hanya menerjemahkan identifier lama ke UUID, lalu
-- melewatkan seluruh otorisasi ke reset_user_password(UUID, TEXT).
-- ============================================================

DROP FUNCTION IF EXISTS reset_user_password(TEXT, TEXT);

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
  v_target_id UUID;
BEGIN
  -- Prioritaskan email kontak; auth_email dipakai untuk akun legacy/multi-tenant.
  SELECT p.id
    INTO v_target_id
  FROM profiles p
  WHERE p.email = user_email
  ORDER BY p.id
  LIMIT 1;

  IF v_target_id IS NULL THEN
    SELECT p.id
      INTO v_target_id
    FROM profiles p
    WHERE p.auth_email = user_email
    ORDER BY p.id
    LIMIT 1;
  END IF;

  IF v_target_id IS NULL THEN
    RAISE EXCEPTION 'User tidak ditemukan';
  END IF;

  -- UUID overload melakukan seluruh validasi caller, role, tenant, dan auth.users.
  PERFORM reset_user_password(v_target_id, new_password);
END;
$$;

REVOKE ALL ON FUNCTION reset_user_password(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION reset_user_password(TEXT, TEXT) TO authenticated;

-- Minta PostgREST memuat signature baru tanpa menunggu restart.
NOTIFY pgrst, 'reload schema';
