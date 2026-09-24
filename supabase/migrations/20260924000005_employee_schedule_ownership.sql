-- ============================================================
-- MIGRATION: Jadwal hanya untuk admin pembuat pegawai
-- ============================================================
-- Admin dapat mengatur jadwal dirinya sendiri dan pegawai yang dibuatnya.
-- Super admin tetap dapat mengatur seluruh tenant.
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS created_by UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_created_by_fkey'
      AND conrelid = 'profiles'::regclass
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_created_by ON profiles(created_by);

CREATE OR REPLACE FUNCTION set_profile_creator()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;

  IF TG_OP = 'UPDATE' AND NOT is_platform_admin()
     AND OLD.created_by IS DISTINCT FROM NEW.created_by THEN
    NEW.created_by := OLD.created_by;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_creator ON profiles;
CREATE TRIGGER trg_profiles_creator
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_profile_creator();

-- Helper dipakai oleh policy dan RPC legacy. Admin hanya boleh mengatur
-- dirinya sendiri atau user yang dibuatnya, dalam organisasi yang sama.
CREATE OR REPLACE FUNCTION can_manage_employee_schedule(p_target_user UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_platform_admin()
      OR (
        EXISTS (
          SELECT 1 FROM profiles caller
          WHERE caller.id = auth.uid()
            AND caller.role = 'admin'
            AND caller.organization_id = current_org_id()
        )
        AND EXISTS (
          SELECT 1 FROM profiles target
          WHERE target.id = p_target_user
            AND target.organization_id = current_org_id()
            AND (target.id = auth.uid() OR target.created_by = auth.uid())
        )
      );
$$;

-- Admin hanya menerima profil dirinya dan profil pegawai yang dibuatnya.
-- Super admin tetap dapat melihat dan mengelola semua profil.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'profiles' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON profiles', r.policyname);
  END LOOP;
END $$;

CREATE POLICY profiles_self_select
  ON profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY profiles_owned_select
  ON profiles FOR SELECT
  TO authenticated
  USING (
    is_platform_admin()
    OR (
      organization_id = current_org_id()
      AND (id = auth.uid() OR created_by = auth.uid())
    )
  );

CREATE POLICY profiles_self_update
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND organization_id = current_org_id());

CREATE POLICY profiles_owned_update
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    is_platform_admin()
    OR (
      organization_id = current_org_id()
      AND created_by = auth.uid()
    )
  )
  WITH CHECK (
    is_platform_admin()
    OR (
      organization_id = current_org_id()
      AND created_by = auth.uid()
    )
  );

CREATE POLICY profiles_platform_insert
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (is_platform_admin() OR organization_id = current_org_id());

-- Hilangkan policy lama yang memberi akses jadwal ke semua supervisor dalam
-- organisasi. Jadwal pegawai adalah kewenangan admin pembuatnya.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'employee_schedules' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON employee_schedules', r.policyname);
  END LOOP;
END $$;

CREATE POLICY employee_schedules_select
  ON employee_schedules FOR SELECT
  TO authenticated
  USING (
    can_manage_employee_schedule(user_id)
    OR user_id = auth.uid()
  );

CREATE POLICY employee_schedules_insert
  ON employee_schedules FOR INSERT
  TO authenticated
  WITH CHECK (
    can_manage_employee_schedule(user_id)
    AND organization_id = current_org_id()
  );

CREATE POLICY employee_schedules_update
  ON employee_schedules FOR UPDATE
  TO authenticated
  USING (can_manage_employee_schedule(user_id))
  WITH CHECK (
    can_manage_employee_schedule(user_id)
    AND organization_id = current_org_id()
  );

CREATE POLICY employee_schedules_delete
  ON employee_schedules FOR DELETE
  TO authenticated
  USING (can_manage_employee_schedule(user_id));

-- Perketat jalur legacy bila masih dipanggil oleh client lama.
CREATE OR REPLACE FUNCTION assign_shift(
  p_user_id UUID, p_shift_code TEXT, p_work_date DATE, p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schedule_id UUID;
  v_org UUID := current_org_id();
  v_assigner UUID := auth.uid();
BEGIN
  IF NOT can_manage_employee_schedule(p_user_id) THEN
    RAISE EXCEPTION 'Anda tidak berhak mengatur jadwal pegawai ini';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM shifts
    WHERE organization_id = v_org AND code = p_shift_code
  ) THEN
    RAISE EXCEPTION 'Shift tidak ditemukan pada instansi Anda';
  END IF;

  INSERT INTO public.schedules
    (user_id, shift_code, work_date, notes, created_by, organization_id)
  VALUES
    (p_user_id, p_shift_code, p_work_date, p_notes, v_assigner, v_org)
  ON CONFLICT (user_id, work_date)
  DO UPDATE SET
    shift_code = EXCLUDED.shift_code,
    notes = EXCLUDED.notes,
    created_by = v_assigner,
    organization_id = v_org
  RETURNING id INTO v_schedule_id;

  PERFORM public.log_audit(
    'ASSIGN_SHIFT',
    'Assign shift ' || p_shift_code || ' untuk user ' || p_user_id::text,
    'schedules', v_schedule_id
  );

  RETURN v_schedule_id;
END;
$$;

REVOKE ALL ON FUNCTION assign_shift(uuid, text, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION assign_shift(uuid, text, date, text) TO authenticated, service_role;
