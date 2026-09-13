-- =====================================================================
-- MULTI-TENANT FASE 1A — organizations + organization_id di semua tabel
-- Jalankan di Supabase Dashboard → SQL Editor. Idempotent (aman diulang).
-- Urutan wajib: file ini SEBELUM policy RLS (Fase 1B) dan RPC security (Fase 1C).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tabel organizations
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Instansi pertama = seluruh data existing yang sudah ada sekarang.
INSERT INTO organizations (id, name, slug)
SELECT '11111111-1111-1111-1111-111111111111', 'Puskesmas Ampenan', 'ampenan'
WHERE NOT EXISTS (SELECT 1 FROM organizations);

-- ---------------------------------------------------------------------
-- 2. profiles: kolom tenant + auth_email (email login sintetis per org)
-- ---------------------------------------------------------------------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS auth_email TEXT;

UPDATE profiles SET organization_id = (SELECT id FROM organizations LIMIT 1)
WHERE organization_id IS NULL;
UPDATE profiles SET auth_email = email
WHERE auth_email IS NULL AND email IS NOT NULL AND email <> '';

DO $$ BEGIN
  ALTER TABLE profiles ADD CONSTRAINT profiles_org_fk
    FOREIGN KEY (organization_id) REFERENCES organizations(id);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_column THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_profiles_org ON profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_profiles_org_username ON profiles(organization_id, username);

-- ---------------------------------------------------------------------
-- 3. Tabel transaksional dengan user_id → org diisi trigger dari profile
-- ---------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['attendance','employee_schedules','leave_requests',
                           'device_requests','user_devices','audit_logs']
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS organization_id UUID', t);
      EXECUTE format($f$
        UPDATE %I SET organization_id = (SELECT id FROM organizations LIMIT 1)
        WHERE organization_id IS NULL
          AND user_id IN (SELECT id FROM profiles)
      $f$, t);
      EXECUTE format($f$
        CREATE OR REPLACE FUNCTION set_org_from_user() RETURNS TRIGGER
        LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
        BEGIN
          IF NEW.organization_id IS NULL AND NEW.user_id IS NOT NULL THEN
            SELECT organization_id INTO NEW.organization_id
            FROM profiles WHERE id = NEW.user_id;
          END IF;
          RETURN NEW;
        END $fn$;
      $f$);
      -- Nama trigger spesifik per tabel supaya DROP IF EXISTS akurat.
      EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_set_org ON %I', t, t);
      EXECUTE format(
        'CREATE TRIGGER trg_%I_set_org BEFORE INSERT ON %I
         FOR EACH ROW EXECUTE FUNCTION set_org_from_user()', t, t);
      EXECUTE format($f$
        DO $blk$ BEGIN
          ALTER TABLE %I ADD CONSTRAINT %I_org_fk
            FOREIGN KEY (organization_id) REFERENCES organizations(id);
        EXCEPTION WHEN duplicate_object THEN NULL; END $blk$;
      $f$, t, t);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_org ON %I(organization_id)', t, t);
    EXCEPTION WHEN undefined_table THEN
      RAISE NOTICE 'Tabel % tidak ada, dilewati', t;
    END;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 4. Tabel konfigurasi/master per instansi (tanpa user_id)
-- ---------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['attendance_locations','announcements',
                           'shifts','shift_schedules','positions','employment_statuses']
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS organization_id UUID', t);
      EXECUTE format($f$
        UPDATE %I SET organization_id = (SELECT id FROM organizations LIMIT 1)
        WHERE organization_id IS NULL
      $f$, t);
      EXECUTE format($f$
        DO $blk$ BEGIN
          ALTER TABLE %I ADD CONSTRAINT %I_org_fk
            FOREIGN KEY (organization_id) REFERENCES organizations(id);
        EXCEPTION WHEN duplicate_object THEN NULL; END $blk$;
      $f$, t, t);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_org ON %I(organization_id)', t, t);
    EXCEPTION WHEN undefined_table THEN
      RAISE NOTICE 'Tabel % tidak ada, dilewati', t;
    END;
  END LOOP;
END $$;

-- system_settings: unique(setting_key) global → unique(organization_id, setting_key)
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS organization_id UUID;
UPDATE system_settings SET organization_id = (SELECT id FROM organizations LIMIT 1)
WHERE organization_id IS NULL;
DO $$ BEGIN
  ALTER TABLE system_settings DROP CONSTRAINT system_settings_setting_key_key;
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE system_settings ADD CONSTRAINT system_settings_org_key_key
    UNIQUE (organization_id, setting_key);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE system_settings ADD CONSTRAINT system_settings_org_fk
    FOREIGN KEY (organization_id) REFERENCES organizations(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_system_settings_org ON system_settings(organization_id);

-- ---------------------------------------------------------------------
-- 5. Seed default untuk instansi baru (berjalan saat organizations diisi)
--    4 shift + 7 hari shift_schedules + setting dasar, per organization.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION seed_org_defaults() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE d INT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM shifts WHERE organization_id = NEW.id AND code = 'PG') THEN
    INSERT INTO shifts (organization_id, code, name)
    VALUES
      (NEW.id, 'PG', 'Shift Pagi'),
      (NEW.id, 'SR', 'Shift Poli Sore'),
      (NEW.id, 'SI', 'Shift Siang'),
      (NEW.id, 'ML', 'Shift Malam');
  END IF;

  FOR d IN 0..6 LOOP
    IF NOT EXISTS (SELECT 1 FROM shift_schedules
                   WHERE organization_id = NEW.id AND day_of_week = d) THEN
      INSERT INTO shift_schedules (organization_id, shift_code, day_of_week, start_time, end_time, latest_check_in)
      VALUES
        (NEW.id, 'PG', d, '07:30'::time, CASE WHEN d = 4 THEN '11:00'::time WHEN d = 5 THEN '12:30'::time ELSE '14:00'::time END, '07:35'::time),
        (NEW.id, 'SI', d, '14:00'::time, '20:00'::time, '14:05'::time),
        (NEW.id, 'ML', d, '20:00'::time, '07:00'::time, '20:05'::time);
      -- SR hanya Senin-Kamis
      IF d <= 3 THEN
        INSERT INTO shift_schedules (organization_id, shift_code, day_of_week, start_time, end_time, latest_check_in)
        VALUES (NEW.id, 'SR', d, '14:00'::time, '16:30'::time, '14:05'::time);
      END IF;
    END IF;
  END LOOP;

  INSERT INTO system_settings (organization_id, setting_key, value, category)
  VALUES
    (NEW.id, 'default_password', 'Presensiku@123', 'security'),
    (NEW.id, 'late_tolerance_minutes', '5', 'attendance')
  ON CONFLICT (organization_id, setting_key) DO NOTHING;

  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS trg_org_seed_defaults ON organizations;
CREATE TRIGGER trg_org_seed_defaults AFTER INSERT ON organizations
FOR EACH ROW EXECUTE FUNCTION seed_org_defaults();
