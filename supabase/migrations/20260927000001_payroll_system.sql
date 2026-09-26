-- =====================================================================
-- SISTEM GAJI BERBASIS KEHADIRAN (opsional per instansi, default MATI)
-- Jalankan SETELAH migration multi-tenant (20260913xxxxxx) dan
-- platform_view_all (20260926000008).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Config gaji per pegawai (angka yang dipotong oleh disiplin hadir)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payroll_employee_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  user_id UUID NOT NULL,
  base_component NUMERIC(14,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payroll_config_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT payroll_config_user_fk FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT payroll_config_org_user_key UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_payroll_config_org ON payroll_employee_config(organization_id);

-- ---------------------------------------------------------------------
-- 2. Snapshot rekap bulanan per pegawai (audit-able, tidak berubah diam-diam)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payroll_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  user_id UUID NOT NULL,
  period_month DATE NOT NULL,
  base_component NUMERIC(14,2) NOT NULL DEFAULT 0,
  work_days INTEGER NOT NULL DEFAULT 0,
  hadir INTEGER NOT NULL DEFAULT 0,
  terlambat INTEGER NOT NULL DEFAULT 0,
  late_minutes_total INTEGER NOT NULL DEFAULT 0,
  alpha_days INTEGER NOT NULL DEFAULT 0,
  izin_days INTEGER NOT NULL DEFAULT 0,
  sakit_days INTEGER NOT NULL DEFAULT 0,
  daily_rate NUMERIC(14,2) NOT NULL DEFAULT 0,
  late_deduction NUMERIC(14,2) NOT NULL DEFAULT 0,
  alpha_deduction NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_deduction NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_received NUMERIC(14,2) NOT NULL DEFAULT 0,
  config_snapshot JSONB,
  details JSONB,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','final')),
  generated_by UUID,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payroll_lines_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT payroll_lines_user_fk FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT payroll_lines_org_user_period_key UNIQUE (organization_id, user_id, period_month)
);

CREATE INDEX IF NOT EXISTS idx_payroll_lines_org_period ON payroll_lines(organization_id, period_month);
CREATE INDEX IF NOT EXISTS idx_payroll_lines_user ON payroll_lines(user_id, period_month);

-- ---------------------------------------------------------------------
-- 3. RLS
-- ---------------------------------------------------------------------
ALTER TABLE payroll_employee_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY payroll_config_org_read ON payroll_employee_config FOR SELECT
  USING (organization_id = current_org_id() OR platform_view_all());
CREATE POLICY payroll_config_org_admin ON payroll_employee_config FOR ALL
  USING (is_org_admin() AND organization_id = current_org_id())
  WITH CHECK (is_org_admin() AND organization_id = current_org_id());

CREATE POLICY payroll_lines_self_read ON payroll_lines FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY payroll_lines_org_read ON payroll_lines FOR SELECT
  USING (organization_id = current_org_id() OR platform_view_all());
CREATE POLICY payroll_lines_org_admin ON payroll_lines FOR ALL
  USING (is_org_admin() AND organization_id = current_org_id())
  WITH CHECK (is_org_admin() AND organization_id = current_org_id());
