-- =====================================================================
-- FIX 403: super_admin tidak bisa tambah jabatan/status kepegawaian
--
-- Setelah 20260926000000_detach_super_admin_from_org (organization_id
-- super_admin = NULL), policy org_admin (organization_id =
-- current_org_id()) tidak pernah terpenuhi untuk super_admin, sehingga
-- INSERT ke master data global ditolak 403.
--
-- Tabel roles sudah punya roles_platform_write; positions dan
-- employment_statuses menyusul dengan pattern yang sama:
-- master data global → dibaca semua authenticated, ditulis platform
-- super_admin (atau admin org untuk baris instansinya sendiri).
-- Idempotent per statement (DROP IF EXISTS sebelum CREATE).
-- =====================================================================

DROP POLICY IF EXISTS positions_platform_write ON positions;
CREATE POLICY positions_platform_write ON positions FOR ALL
  USING (is_platform_admin()) WITH CHECK (is_platform_admin());

DROP POLICY IF EXISTS estatus_platform_write ON employment_statuses;
CREATE POLICY estatus_platform_write ON employment_statuses FOR ALL
  USING (is_platform_admin()) WITH CHECK (is_platform_admin());
