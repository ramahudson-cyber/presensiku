-- ============================================================
-- MIGRATION: Per-admin attendance-location ownership
-- ============================================================
-- Admin biasa hanya dapat melihat dan mengelola lokasi yang dibuatnya.
-- Super admin tetap dapat mengelola semua lokasi.
-- Lokasi lama tanpa owner sengaja hanya terlihat oleh super_admin sampai
-- pemiliknya ditetapkan secara eksplisit.
-- ============================================================

ALTER TABLE attendance_locations
  ADD COLUMN IF NOT EXISTS created_by UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'attendance_locations_created_by_fkey'
      AND conrelid = 'attendance_locations'::regclass
  ) THEN
    ALTER TABLE attendance_locations
      ADD CONSTRAINT attendance_locations_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_attendance_locations_created_by
  ON attendance_locations(created_by);

ALTER TABLE attendance_locations
  DROP CONSTRAINT IF EXISTS attendance_locations_latitude_range,
  DROP CONSTRAINT IF EXISTS attendance_locations_longitude_range,
  DROP CONSTRAINT IF EXISTS attendance_locations_radius_range;

ALTER TABLE attendance_locations
  ADD CONSTRAINT attendance_locations_latitude_range
    CHECK (latitude BETWEEN -90 AND 90),
  ADD CONSTRAINT attendance_locations_longitude_range
    CHECK (longitude BETWEEN -180 AND 180),
  ADD CONSTRAINT attendance_locations_radius_range
    CHECK (radius_meter BETWEEN 10 AND 2000);

-- Derive ownership and tenant from the authenticated profile. The browser
-- must never be able to choose another admin as owner or another tenant.
CREATE OR REPLACE FUNCTION set_attendance_location_context()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID := current_org_id();
  v_platform_admin BOOLEAN := is_platform_admin();
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Autentikasi diperlukan untuk membuat lokasi';
    END IF;

    IF NOT v_platform_admin THEN
      NEW.created_by := auth.uid();
      NEW.organization_id := v_org;
    ELSE
      NEW.created_by := COALESCE(NEW.created_by, auth.uid());
      NEW.organization_id := COALESCE(NEW.organization_id, v_org);
    END IF;

    IF NEW.organization_id IS NULL THEN
      RAISE EXCEPTION 'Organisasi lokasi wajib ditentukan';
    END IF;
  ELSE
    IF NOT v_platform_admin THEN
      IF OLD.created_by IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Anda bukan pemilik lokasi ini';
      END IF;
      NEW.created_by := OLD.created_by;
      NEW.organization_id := OLD.organization_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_attendance_location_context ON attendance_locations;
CREATE TRIGGER trg_attendance_location_context
  BEFORE INSERT OR UPDATE ON attendance_locations
  FOR EACH ROW
  EXECUTE FUNCTION set_attendance_location_context();

ALTER TABLE attendance_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS loc_org_read ON attendance_locations;
DROP POLICY IF EXISTS loc_org_admin ON attendance_locations;
DROP POLICY IF EXISTS attendance_locations_select ON attendance_locations;
DROP POLICY IF EXISTS attendance_locations_insert ON attendance_locations;
DROP POLICY IF EXISTS attendance_locations_update ON attendance_locations;
DROP POLICY IF EXISTS attendance_locations_delete ON attendance_locations;

CREATE POLICY attendance_locations_select
  ON attendance_locations FOR SELECT
  TO authenticated
  USING (
    is_platform_admin()
    OR (
      is_org_admin()
      AND organization_id = current_org_id()
      AND created_by = auth.uid()
    )
  );

CREATE POLICY attendance_locations_insert
  ON attendance_locations FOR INSERT
  TO authenticated
  WITH CHECK (
    is_platform_admin()
    OR (
      is_org_admin()
      AND organization_id = current_org_id()
      AND created_by = auth.uid()
    )
  );

CREATE POLICY attendance_locations_update
  ON attendance_locations FOR UPDATE
  TO authenticated
  USING (
    is_platform_admin()
    OR (
      is_org_admin()
      AND organization_id = current_org_id()
      AND created_by = auth.uid()
    )
  )
  WITH CHECK (
    is_platform_admin()
    OR (
      is_org_admin()
      AND organization_id = current_org_id()
      AND created_by = auth.uid()
    )
  );

CREATE POLICY attendance_locations_delete
  ON attendance_locations FOR DELETE
  TO authenticated
  USING (
    is_platform_admin()
    OR (
      is_org_admin()
      AND organization_id = current_org_id()
      AND created_by = auth.uid()
    )
  );

-- Location matching is intentionally organization-scoped, not owner-scoped,
-- so employees can still use any active location in their organization.
REVOKE ALL ON FUNCTION get_active_location() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_active_location() TO authenticated, service_role;

REVOKE ALL ON FUNCTION verify_attendance_location(double precision, double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION verify_attendance_location(double precision, double precision, double precision) TO authenticated, service_role;
