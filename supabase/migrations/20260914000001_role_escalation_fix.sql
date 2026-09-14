-- =====================================================================
-- MULTI-TENANT FASE 1D — Tutup eskalasi role admin instansi
-- Jalankan SETELAH 20260913000003_multi_tenant_rpc_security.sql
--
-- Masalah: admin_puskesmas bisa membuat/mengubah user menjadi
-- super_admin / admin_puskesmas via UPDATE profiles langsung atau RPC.
-- Aturan yang benar:
--   super_admin  : kelola semua role (termasuk angkat admin/super_admin)
--   admin_puskesmas: hanya boleh membuat/mengubah pegawai & kepala_unit
--   kepala_unit  : tidak boleh mengelola user sama sekali
-- Idempotent (aman diulang).
-- =====================================================================

-- 1. RLS profiles: admin instansi tidak boleh SET role di luar
--    pegawai/kepala_unit. USING tetap lindungi baris super_admin.
DO $$ BEGIN
  DROP POLICY IF EXISTS profiles_org_admin_update ON profiles;
  CREATE POLICY profiles_org_admin_update ON profiles FOR UPDATE
    USING (is_org_admin() AND role <> 'super_admin'
           AND organization_id = current_org_id())
    WITH CHECK (
      organization_id = current_org_id()
      AND (
        -- platform super_admin bebas set role apa pun
        is_platform_admin()
        -- admin instansi hanya boleh hasilkan pegawai/kepala_unit
        OR role IN ('pegawai', 'kepala_unit')
      )
    );
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- 2. RPC reset password: hanya admin org yang sama / platform,
--    target bukan super_admin (kecuali oleh platform),
--    admin instansi tidak boleh reset password sesama admin.
--    Dibuat dari nol karena definisi server tak ada di repo.
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
  IF v_caller_role = 'admin_puskesmas' THEN
    IF v_target.organization_id IS DISTINCT FROM v_caller_org THEN
      RAISE EXCEPTION 'Tidak berhak mereset password user instansi lain';
    END IF;
    IF v_target.role NOT IN ('pegawai', 'kepala_unit') THEN
      RAISE EXCEPTION 'Admin instansi hanya boleh mereset password pegawai/kepala unit';
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
