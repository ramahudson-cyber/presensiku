-- =====================================================================
-- PENGUMUMAN: konteks otomatis per instansi
-- - organization_id dipaksa = current_org_id() (admin instansi tidak
--   bisa & tidak perlu mengirim org lain — isolasi lintas instansi
--   dijamin di level DB)
-- - published_by = auth.uid() otomatis
-- Pola: attendance_location_ownership (20260924000002)
-- =====================================================================

CREATE OR REPLACE FUNCTION set_announcement_context() RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID := current_org_id();
BEGIN
  -- Platform admin tanpa switch: org tidak terdeteksi → tolak dengan pesan jelas
  IF v_org IS NULL THEN
    RAISE EXCEPTION
      'Instansi tidak terdeteksi. Pilih instansi dulu (Kelola Instansi → Masuk sebagai Admin) atau login sebagai admin instansi.';
  END IF;

  NEW.organization_id := v_org;
  NEW.published_by := auth.uid();

  -- Validasi field wajib agar tidak ada pengumuman kosong tersimpan
  IF COALESCE(TRIM(NEW.title), '') = '' THEN
    RAISE EXCEPTION 'Judul pengumuman wajib diisi';
  END IF;
  IF COALESCE(TRIM(NEW.content), '') = '' THEN
    RAISE EXCEPTION 'Isi pengumuman wajib diisi';
  END IF;

  NEW.title := TRIM(NEW.title);
  NEW.content := TRIM(NEW.content);
  NEW.priority := COALESCE(NULLIF(TRIM(LOWER(NEW.priority)), ''), 'normal');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_announcement_context ON announcements;
CREATE TRIGGER trg_set_announcement_context
  BEFORE INSERT OR UPDATE OF title, content, priority, is_active, organization_id ON announcements
  FOR EACH ROW EXECUTE FUNCTION set_announcement_context();
