-- =====================================================================
-- ORG SWITCH SCOPING: saat super_admin switch ke instansi (override
-- aktif), bypass platform dinonaktifkan agar seluruh data yang terlihat
-- & dapat ditulis ter-scope ke instansi target ("beroperasi sebagai
-- instansi itu"). Tanpa switch: perilaku platform seperti semula.
-- Jalankan SETELAH 20260926000007_platform_org_switch.sql
-- =====================================================================

CREATE OR REPLACE FUNCTION platform_view_all() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role = 'super_admin'
      AND active_org_override IS NULL
  );
$$;

-- profiles -------------------------------------------------------------
DROP POLICY IF EXISTS profiles_owned_select ON profiles;
CREATE POLICY profiles_owned_select ON profiles FOR SELECT
  USING (
    platform_view_all()
    OR organization_id = current_org_id()
    OR id = auth.uid()
  );
DROP POLICY IF EXISTS profiles_owned_update ON profiles;
CREATE POLICY profiles_owned_update ON profiles FOR UPDATE
  USING (
    platform_view_all()
    OR organization_id = current_org_id()
  )
  WITH CHECK (organization_id = current_org_id() OR is_platform_admin());

-- attendance -----------------------------------------------------------
DROP POLICY IF EXISTS attendance_platform_all ON attendance;
CREATE POLICY attendance_platform_all ON attendance FOR ALL
  USING (platform_view_all() OR organization_id = current_org_id())
  WITH CHECK (platform_view_all() OR organization_id = current_org_id());

-- leave_requests -------------------------------------------------------
DROP POLICY IF EXISTS leave_platform_all ON leave_requests;
CREATE POLICY leave_platform_all ON leave_requests FOR ALL
  USING (platform_view_all() OR organization_id = current_org_id())
  WITH CHECK (platform_view_all() OR organization_id = current_org_id());

-- device_requests ------------------------------------------------------
DROP POLICY IF EXISTS device_req_platform_all ON device_requests;
CREATE POLICY device_req_platform_all ON device_requests FOR ALL
  USING (platform_view_all() OR organization_id = current_org_id())
  WITH CHECK (platform_view_all() OR organization_id = current_org_id());

-- user_devices ---------------------------------------------------------
DROP POLICY IF EXISTS user_devices_platform_all ON user_devices;
CREATE POLICY user_devices_platform_all ON user_devices FOR ALL
  USING (platform_view_all() OR organization_id = current_org_id())
  WITH CHECK (platform_view_all() OR organization_id = current_org_id());

-- otp_codes: user-scoped (auth.uid()) — tidak perlu scoping org

-- audit_logs -----------------------------------------------------------
DROP POLICY IF EXISTS audit_platform_read ON audit_logs;
CREATE POLICY audit_platform_read ON audit_logs FOR SELECT
  USING (platform_view_all() OR organization_id = current_org_id());

-- announcements / system_settings --------------------------------------
DROP POLICY IF EXISTS ann_org_read ON announcements;
CREATE POLICY ann_org_read ON announcements FOR SELECT
  USING (organization_id = current_org_id() OR platform_view_all());
DROP POLICY IF EXISTS settings_org_read ON system_settings;
CREATE POLICY settings_org_read ON system_settings FOR SELECT
  USING (organization_id = current_org_id() OR platform_view_all());

-- shifts / shift_schedules ---------------------------------------------
DROP POLICY IF EXISTS shifts_org_read ON shifts;
CREATE POLICY shifts_org_read ON shifts FOR SELECT
  USING (organization_id = current_org_id() OR platform_view_all());
DROP POLICY IF EXISTS shift_sched_org_read ON shift_schedules;
CREATE POLICY shift_sched_org_read ON shift_schedules FOR SELECT
  USING (organization_id = current_org_id() OR platform_view_all());

-- attendance_locations (per-cmd policies dari migration 20260924000002 --
DROP POLICY IF EXISTS attendance_locations_select ON attendance_locations;
CREATE POLICY attendance_locations_select ON attendance_locations FOR SELECT
  USING (
    platform_view_all()
    OR organization_id = current_org_id()
    OR (is_org_admin() AND organization_id = current_org_id())
  );
DROP POLICY IF EXISTS attendance_locations_update ON attendance_locations;
CREATE POLICY attendance_locations_update ON attendance_locations FOR UPDATE
  USING (
    platform_view_all()
    OR (is_org_admin() AND organization_id = current_org_id())
  );
DROP POLICY IF EXISTS attendance_locations_delete ON attendance_locations;
CREATE POLICY attendance_locations_delete ON attendance_locations FOR DELETE
  USING (
    platform_view_all()
    OR (is_org_admin() AND organization_id = current_org_id())
  );

-- catatan: organizations tetap is_platform_admin() penuh (daftar instansi
-- harus selalu terlihat untuk switch), master data global (roles/positions/
-- employment_statuses) juga tetap global sesuai desain.
