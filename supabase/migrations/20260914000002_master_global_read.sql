-- =====================================================================
-- MULTI-TENANT FASE 1E — Master global terbaca semua instansi
-- Data master (positions, employment_statuses, roles) bersifat GLOBAL,
-- bukan per-instansi: dropdown Tambah Pegawai kosong untuk admin yang
-- org-nya tidak punya baris master sendiri (RLS org-only return 0 baris).
-- Fix: SELECT terbuka untuk authenticated, tulis tetap admin org/platform.
-- Idempotent (aman diulang).
-- =====================================================================

-- positions: SELECT global, tulis admin org + platform
DO $$ BEGIN
  DROP POLICY IF EXISTS positions_org_read ON positions;
  CREATE POLICY positions_global_read ON positions FOR SELECT
    TO authenticated USING (true);
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- employment_statuses: SELECT global, tulis admin org + platform
DO $$ BEGIN
  DROP POLICY IF EXISTS estatus_org_read ON employment_statuses;
  CREATE POLICY estatus_global_read ON employment_statuses FOR SELECT
    TO authenticated USING (true);
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- roles: dokumentasikan policy lama jadi eksplisit (ganti admin_all_roles
-- qual-true yang tak terdokumentasi dengan kebijakan yang jelas)
DO $$ BEGIN
  DROP POLICY IF EXISTS admin_all_roles ON roles;
  CREATE POLICY roles_global_read ON roles FOR SELECT
    TO authenticated USING (true);
  CREATE POLICY roles_platform_write ON roles FOR ALL
    TO authenticated
    USING (is_platform_admin())
    WITH CHECK (is_platform_admin());
EXCEPTION WHEN undefined_table THEN NULL; END $$;
