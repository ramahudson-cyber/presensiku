-- ============================================================
-- Migration: Add INSERT/DELETE policies for admin on user_devices
-- Karena RPC approve_device_request tidak ada di database,
-- admin perlu akses langsung ke user_devices.
-- ============================================================

-- Policy: admin bisa insert user_devices
DROP POLICY IF EXISTS admin_insert_user_devices ON user_devices;
CREATE POLICY admin_insert_user_devices ON user_devices
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role IN ('super_admin', 'admin_puskesmas')
    )
  );

-- Policy: admin bisa delete user_devices
DROP POLICY IF EXISTS admin_delete_user_devices ON user_devices;
CREATE POLICY admin_delete_user_devices ON user_devices
  FOR DELETE USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role IN ('super_admin', 'admin_puskesmas')
    )
  );

-- Policy: admin bisa update user_devices
DROP POLICY IF EXISTS admin_update_user_devices ON user_devices;
CREATE POLICY admin_update_user_devices ON user_devices
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role IN ('super_admin', 'admin_puskesmas')
    )
  );
