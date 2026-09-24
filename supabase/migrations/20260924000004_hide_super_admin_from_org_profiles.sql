-- ============================================================
-- MIGRATION: Sembunyikan profil super_admin dari admin instansi
-- ============================================================
-- Super admin tetap melihat seluruh profil melalui profiles_platform_all.
-- Supervisor organisasi hanya melihat profil non-super_admin dalam org-nya.
-- ============================================================

DROP POLICY IF EXISTS profiles_org_read ON public.profiles;

CREATE POLICY profiles_org_read
  ON public.profiles
  FOR SELECT
  USING (
    is_org_supervisor()
    AND organization_id = current_org_id()
    AND role <> 'super_admin'
  );
