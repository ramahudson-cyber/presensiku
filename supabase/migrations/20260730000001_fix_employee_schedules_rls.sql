-- ============================================================
-- FIX RLS POLICIES FOR employee_schedules
-- Enable RLS + create proper policies for all roles
-- ============================================================

-- 1. Enable RLS (safe if already enabled)
ALTER TABLE employee_schedules ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to avoid duplicates
DROP POLICY IF EXISTS "admin_all_employee_schedules" ON employee_schedules;
DROP POLICY IF EXISTS "employee_read_own_schedules" ON employee_schedules;

-- 3. Policy: Admin (super_admin, admin_puskesmas, kepala_unit) can do ALL operations
CREATE POLICY "admin_all_employee_schedules" ON employee_schedules
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin_puskesmas', 'kepala_unit')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin_puskesmas', 'kepala_unit')
    )
  );

-- 4. Policy: Regular employees can only READ their own schedules
CREATE POLICY "employee_read_own_schedules" ON employee_schedules
  FOR SELECT
  USING (
    user_id = auth.uid()
  );