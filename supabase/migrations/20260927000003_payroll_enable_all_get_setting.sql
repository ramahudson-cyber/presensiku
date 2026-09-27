-- =====================================================================
-- PAYROLL: aktifkan modul untuk SEMUA instansi existing
-- + RPC get_org_setting (baca setting berdasarkan instansi aktif —
--   memperbaiki getSetting yang bisa mengembalikan nilai org lain
--   untuk platform admin)
-- =====================================================================

-- 1. Semua instansi existing: modul gaji aktif
INSERT INTO system_settings (organization_id, setting_key, value, category)
SELECT o.id, 'payroll_enabled', 'true', 'payroll'
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM system_settings s
  WHERE s.organization_id = o.id AND s.setting_key = 'payroll_enabled'
);

UPDATE system_settings SET value = 'true'
WHERE setting_key = 'payroll_enabled' AND value <> 'true';

-- Seed default payroll_config untuk org yang belum punya
INSERT INTO system_settings (organization_id, setting_key, value, category)
SELECT o.id, 'payroll_config',
  '{"late_tiers":[{"min":1,"max":15,"nominal":5000},{"min":16,"max":30,"nominal":10000},{"min":31,"max":60,"nominal":25000},{"min":61,"max":null,"nominal":50000}],"alpha_nominal_per_day":100000}',
  'payroll'
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM system_settings s
  WHERE s.organization_id = o.id AND s.setting_key = 'payroll_config'
);

-- 2. RPC baca setting per instansi aktif
CREATE OR REPLACE FUNCTION get_org_setting(p_key TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT value FROM system_settings
  WHERE organization_id = current_org_id() AND setting_key = p_key
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION get_org_setting(text) FROM anon;
GRANT EXECUTE ON FUNCTION get_org_setting(text) TO authenticated;
