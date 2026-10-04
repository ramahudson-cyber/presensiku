-- =====================================================================
-- MENU GAJI HILANG UNTUK INSTANSI BARU
--
-- Menu "Gaji" di sidebar admin hanya tampil bila system_settings
-- payroll_enabled = 'true' untuk instansi tersebut. Migrasi lama
-- (20260927000003) mengaktifkannya hanya untuk instansi yang SUDAH ada
-- saat itu, sedangkan seed instansi baru (seed_org_defaults) tidak
-- mengisi key ini — akibatnya instansi yang dibuat/dibuat ulang
-- setelahnya (mis. awilys) tidak punya barisnya dan menunya hilang.
--
-- Perbaikan:
--   1. Backfill: payroll_enabled = 'true' untuk semua instansi yang
--      belum punya barisnya (yang sudah punya tidak disentuh).
--   2. seed_org_defaults menyertakan payroll_enabled = 'true' sehingga
--      instansi baru langsung mendapat menu Gaji. Toggle modul tetap
--      bisa dimatikan admin lewat pengaturan seperti semula.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Backfill instansi yang belum punya setting payroll_enabled
-- ---------------------------------------------------------------------
INSERT INTO system_settings (organization_id, setting_key, value, category)
SELECT o.id, 'payroll_enabled', 'true', 'payroll'
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM system_settings s
  WHERE s.organization_id = o.id AND s.setting_key = 'payroll_enabled'
)
ON CONFLICT (organization_id, setting_key) DO NOTHING;

-- ---------------------------------------------------------------------
-- 2. Seed instansi baru: sertakan payroll_enabled
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION seed_org_defaults() RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Jangan membuat PG/SR/SI/ML otomatis. Admin instansi mengisi sendiri
  -- melalui menu Kelola Shift setelah organisasi dibuat.
  INSERT INTO system_settings (organization_id, setting_key, value, category)
  VALUES
    (NEW.id, 'default_password', 'Presensiku@123', 'security'),
    (NEW.id, 'late_tolerance_minutes', '5', 'attendance'),
    (NEW.id, 'payroll_enabled', 'true', 'payroll')
  ON CONFLICT (organization_id, setting_key) DO NOTHING;

  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
