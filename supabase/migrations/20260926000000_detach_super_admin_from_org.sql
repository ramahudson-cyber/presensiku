-- Lepas keterikatan organisasi dari akun super_admin.
-- super_admin adalah akun platform-level: akses lintas instansi lewat is_platform_admin(),
-- jadi tidak perlu (dan tidak boleh) tertaut ke organisasi tertentu.

UPDATE public.profiles
SET organization_id = NULL
WHERE role = 'super_admin'
  AND organization_id IS NOT NULL;

-- Jaga invarian ke depan: penulisan apa pun ke profiles dengan role super_admin
-- selalu mengosongkan organization_id.
CREATE OR REPLACE FUNCTION public.detach_super_admin_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.role = 'super_admin' AND NEW.organization_id IS NOT NULL THEN
    NEW.organization_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_detach_super_admin_org ON public.profiles;

CREATE TRIGGER trg_detach_super_admin_org
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.detach_super_admin_org();
