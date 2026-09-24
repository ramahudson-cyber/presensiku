-- ============================================================
-- MIGRATION: Organisasi baru mulai tanpa master shift bawaan
-- ============================================================
-- Master shift tetap scoped per organization_id agar kompatibel
-- dengan employee_schedules dan validasi attendance berbasis shift_code.
-- Organisasi lama dan histori attendance tidak diubah.
-- ============================================================

CREATE OR REPLACE FUNCTION set_shift_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT is_platform_admin() THEN
    NEW.organization_id := current_org_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shifts_set_organization ON shifts;
CREATE TRIGGER trg_shifts_set_organization
  BEFORE INSERT OR UPDATE ON shifts
  FOR EACH ROW EXECUTE FUNCTION set_shift_organization();

DROP TRIGGER IF EXISTS trg_shift_schedules_set_organization ON shift_schedules;
CREATE TRIGGER trg_shift_schedules_set_organization
  BEFORE INSERT OR UPDATE ON shift_schedules
  FOR EACH ROW EXECUTE FUNCTION set_shift_organization();

CREATE OR REPLACE FUNCTION seed_org_defaults() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  -- Jangan membuat PG/SR/SI/ML otomatis. Admin instansi mengisi sendiri
  -- melalui menu Kelola Shift setelah organisasi dibuat.
  INSERT INTO system_settings (organization_id, setting_key, value, category)
  VALUES
    (NEW.id, 'default_password', 'Presensiku@123', 'security'),
    (NEW.id, 'late_tolerance_minutes', '5', 'attendance')
  ON CONFLICT (organization_id, setting_key) DO NOTHING;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_org_seed_defaults ON organizations;
CREATE TRIGGER trg_org_seed_defaults
  AFTER INSERT ON organizations
  FOR EACH ROW EXECUTE FUNCTION seed_org_defaults();
