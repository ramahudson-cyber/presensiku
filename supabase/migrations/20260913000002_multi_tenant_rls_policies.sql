-- =====================================================================
-- MULTI-TENANT FASE 1B — Helper RLS + policy per instansi
-- Jalankan SETELAH 20260913000001_multi_tenant_organizations.sql
-- Pola: hapus semua policy lama pada tiap tabel, lalu recreate dengan
-- predikat tenant. Idempotent (aman diulang).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Helper functions (SECURITY DEFINER supaya tidak rekursi RLS profiles)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION current_org_id() RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION is_platform_admin() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin');
$$;

-- Admin instansi ATAU platform super_admin
CREATE OR REPLACE FUNCTION is_org_admin() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('super_admin', 'admin_puskesmas')
  );
$$;

-- Supervisor (termasuk kepala_unit) — read-only di tingkat instansi
CREATE OR REPLACE FUNCTION is_org_supervisor() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin_puskesmas', 'kepala_unit')
  );
$$;

-- ---------------------------------------------------------------------
-- 2. Drop semua policy lama per tabel (guard: tabel mungkin tidak ada)
-- ---------------------------------------------------------------------
DO $$
DECLARE t TEXT; r RECORD;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles','attendance','employee_schedules','leave_requests',
    'device_requests','user_devices','otp_codes','attendance_locations',
    'announcements','system_settings','shifts','shift_schedules',
    'positions','employment_statuses','audit_logs','organizations'
  ] LOOP
    BEGIN
      FOR r IN SELECT policyname FROM pg_policies WHERE tablename = t LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, t);
      END LOOP;
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXCEPTION WHEN undefined_table THEN
      RAISE NOTICE 'Tabel % tidak ada, dilewati', t;
    END;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 3. Policies
--    Pola: self (pemilik baris) + supervisor instansi (read) +
--    admin instansi (write) + platform super_admin (semua).
-- ---------------------------------------------------------------------

-- profiles -------------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY profiles_self_select ON profiles FOR SELECT
    USING (id = auth.uid());
  CREATE POLICY profiles_self_update ON profiles FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid() AND organization_id = current_org_id());
  CREATE POLICY profiles_org_read ON profiles FOR SELECT
    USING (is_org_supervisor() AND organization_id = current_org_id());
  CREATE POLICY profiles_org_admin_update ON profiles FOR UPDATE
    USING (is_org_admin() AND role <> 'super_admin'
           AND organization_id = current_org_id())
    WITH CHECK (organization_id = current_org_id());
  CREATE POLICY profiles_platform_all ON profiles FOR ALL
    USING (is_platform_admin());
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- attendance -----------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY attendance_self_all ON attendance FOR ALL
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  CREATE POLICY attendance_org_read ON attendance FOR SELECT
    USING (is_org_supervisor() AND organization_id = current_org_id());
  CREATE POLICY attendance_platform_all ON attendance FOR ALL
    USING (is_platform_admin());
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- employee_schedules ---------------------------------------------------
DO $$ BEGIN
  CREATE POLICY schedules_self_read ON employee_schedules FOR SELECT
    USING (user_id = auth.uid());
  CREATE POLICY schedules_org_all ON employee_schedules FOR ALL
    USING (is_org_supervisor() AND organization_id = current_org_id())
    WITH CHECK (is_org_supervisor() AND organization_id = current_org_id());
  CREATE POLICY schedules_platform_all ON employee_schedules FOR ALL
    USING (is_platform_admin());
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- leave_requests -------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY leave_self_select ON leave_requests FOR SELECT
    USING (user_id = auth.uid());
  CREATE POLICY leave_self_insert ON leave_requests FOR INSERT
    WITH CHECK (user_id = auth.uid());
  CREATE POLICY leave_self_delete_pending ON leave_requests FOR DELETE
    USING (user_id = auth.uid() AND status = 'pending');
  CREATE POLICY leave_org_read ON leave_requests FOR SELECT
    USING (is_org_supervisor() AND organization_id = current_org_id());
  CREATE POLICY leave_platform_all ON leave_requests FOR ALL
    USING (is_platform_admin());
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- device_requests ------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY device_req_self_select ON device_requests FOR SELECT
    USING (user_id = auth.uid());
  CREATE POLICY device_req_self_insert ON device_requests FOR INSERT
    WITH CHECK (user_id = auth.uid());
  CREATE POLICY device_req_org_admin ON device_requests FOR ALL
    USING (is_org_admin() AND organization_id = current_org_id())
    WITH CHECK (is_org_admin() AND organization_id = current_org_id());
  CREATE POLICY device_req_platform_all ON device_requests FOR ALL
    USING (is_platform_admin());
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- user_devices ---------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY user_devices_self_all ON user_devices FOR ALL
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  CREATE POLICY user_devices_org_admin ON user_devices FOR ALL
    USING (is_org_admin() AND organization_id = current_org_id())
    WITH CHECK (is_org_admin() AND organization_id = current_org_id());
  CREATE POLICY user_devices_platform_all ON user_devices FOR ALL
    USING (is_platform_admin());
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- otp_codes (hanya self; penulisan lewat RPC definer) -------------------
DO $$ BEGIN
  CREATE POLICY otp_self_select ON otp_codes FOR SELECT
    USING (user_id = auth.uid());
  CREATE POLICY otp_platform_all ON otp_codes FOR ALL
    USING (is_platform_admin());
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- attendance_locations / announcements / system_settings ---------------
DO $$ BEGIN
  CREATE POLICY loc_org_read ON attendance_locations FOR SELECT
    USING (organization_id = current_org_id() OR is_platform_admin());
  CREATE POLICY loc_org_admin ON attendance_locations FOR ALL
    USING (is_org_admin() AND organization_id = current_org_id())
    WITH CHECK (is_org_admin() AND organization_id = current_org_id());
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY ann_org_read ON announcements FOR SELECT
    USING (organization_id = current_org_id() OR is_platform_admin());
  CREATE POLICY ann_org_admin ON announcements FOR ALL
    USING (is_org_admin() AND organization_id = current_org_id())
    WITH CHECK (is_org_admin() AND organization_id = current_org_id());
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY settings_org_read ON system_settings FOR SELECT
    USING (organization_id = current_org_id() OR is_platform_admin());
  CREATE POLICY settings_org_admin ON system_settings FOR ALL
    USING (is_org_admin() AND organization_id = current_org_id())
    WITH CHECK (is_org_admin() AND organization_id = current_org_id());
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- shifts / shift_schedules ---------------------------------------------
DO $$ BEGIN
  CREATE POLICY shifts_org_read ON shifts FOR SELECT
    USING (organization_id = current_org_id() OR is_platform_admin());
  CREATE POLICY shifts_org_admin ON shifts FOR ALL
    USING (is_org_admin() AND organization_id = current_org_id())
    WITH CHECK (is_org_admin() AND organization_id = current_org_id());
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY shift_sched_org_read ON shift_schedules FOR SELECT
    USING (organization_id = current_org_id() OR is_platform_admin());
  CREATE POLICY shift_sched_org_admin ON shift_schedules FOR ALL
    USING (is_org_admin() AND organization_id = current_org_id())
    WITH CHECK (is_org_admin() AND organization_id = current_org_id());
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- positions / employment_statuses (master data instansi) ----------------
DO $$ BEGIN
  CREATE POLICY positions_org_read ON positions FOR SELECT
    USING (organization_id = current_org_id() OR is_platform_admin());
  CREATE POLICY positions_org_admin ON positions FOR ALL
    USING (is_org_admin() AND organization_id = current_org_id())
    WITH CHECK (is_org_admin() AND organization_id = current_org_id());
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY estatus_org_read ON employment_statuses FOR SELECT
    USING (organization_id = current_org_id() OR is_platform_admin());
  CREATE POLICY estatus_org_admin ON employment_statuses FOR ALL
    USING (is_org_admin() AND organization_id = current_org_id())
    WITH CHECK (is_org_admin() AND organization_id = current_org_id());
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- audit_logs -----------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY audit_self_read ON audit_logs FOR SELECT
    USING (user_id = auth.uid());
  CREATE POLICY audit_org_read ON audit_logs FOR SELECT
    USING (is_org_admin() AND organization_id = current_org_id());
  CREATE POLICY audit_platform_read ON audit_logs FOR SELECT
    USING (is_platform_admin());
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- organizations --------------------------------------------------------
DO $$ BEGIN
  -- Semua member boleh membaca instansinya sendiri (untuk branding).
  CREATE POLICY org_member_read ON organizations FOR SELECT
    USING (id = current_org_id() OR is_platform_admin());
  -- Write hanya platform super_admin (via RPC definer / dashboard).
  CREATE POLICY org_platform_all ON organizations FOR ALL
    USING (is_platform_admin());
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ---------------------------------------------------------------------
-- 4. Storage avatars: INSERT wajib di folder sendiri (tutup celah
--    upload ke folder user lain). Public read dipertahankan untuk URL.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Avatar upload own folder" ON storage.objects;
CREATE POLICY "Avatar upload own folder" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
