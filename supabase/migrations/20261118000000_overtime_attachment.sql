-- ============================================================
-- Dokumentasi kegiatan lembur (foto opsional dari pegawai)
--
-- Kolom baru bersifat opsional. RPC create_overtime_request diganti
-- dengan tanda tangan 5 argumen yang argumen terakhirnya punya default
-- NULL, sehingga semua pemanggil lama (4 argumen) tetap bekerja.
-- Storage memakai bucket publik 'overtime' dengan pola folder
-- <user_id>/ sebagaimana bucket 'sanggahan'.
-- ============================================================

ALTER TABLE public.overtime_requests
  ADD COLUMN IF NOT EXISTS attachment_url TEXT;

-- ── Bucket foto dokumentasi lembur ─────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('overtime', 'overtime', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "overtime_bucket_select" ON storage.objects;
CREATE POLICY "overtime_bucket_select" ON storage.objects FOR SELECT
USING (bucket_id = 'overtime');

DROP POLICY IF EXISTS "overtime_bucket_insert" ON storage.objects;
CREATE POLICY "overtime_bucket_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'overtime');

DROP POLICY IF EXISTS "overtime_bucket_own_update" ON storage.objects;
CREATE POLICY "overtime_bucket_own_update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'overtime' AND (auth.uid())::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "overtime_bucket_own_delete" ON storage.objects;
CREATE POLICY "overtime_bucket_own_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'overtime' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- ── RPC dengan attachment ──────────────────────────────────────────────────
-- Tanda tangan lama diganti supaya hanya ada satu fungsi. Argumen kelima
-- punya default NULL, jadi pemanggil 4 argumen tetap valid.
-- Validasi identik dengan migrasi 20261025000000.
DROP FUNCTION IF EXISTS public.create_overtime_request(date, text, text, text);

CREATE OR REPLACE FUNCTION public.create_overtime_request(
  p_date DATE,
  p_start_time TEXT,
  p_end_time TEXT,
  p_reason TEXT DEFAULT NULL,
  p_attachment_url TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID := current_org_id();
  v_start_min INT;
  v_end_min INT;
  v_dur_min INT;
  v_hours NUMERIC(5,2);
  v_min_minutes INT;
  v_max_hours NUMERIC(5,2);
BEGIN
  IF v_org IS NULL OR auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Tidak terautentikasi');
  END IF;

  IF p_start_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
     OR p_end_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
    RETURN json_build_object('success', false, 'error', 'Format jam harus HH:MM');
  END IF;

  v_start_min := split_part(p_start_time, ':', 1)::int * 60 + split_part(p_start_time, ':', 2)::int;
  v_end_min   := split_part(p_end_time, ':', 1)::int * 60 + split_part(p_end_time, ':', 2)::int;
  IF v_end_min = v_start_min THEN
    RETURN json_build_object('success', false, 'error', 'Jam selesai tidak boleh sama dengan jam mulai');
  END IF;
  IF v_end_min < v_start_min AND v_end_min > 360 THEN
    RETURN json_build_object('success', false, 'error', 'Lembur lintas tengah malam maksimal sampai jam 06.00');
  END IF;
  v_dur_min := CASE WHEN v_end_min < v_start_min
                    THEN (v_end_min + 1440) - v_start_min
                    ELSE v_end_min - v_start_min END;
  v_hours := ROUND((v_dur_min / 60.0)::numeric, 2);

  v_min_minutes := COALESCE(NULLIF(overtime_setting('overtime_min_minutes', '30'), '')::int, 30);
  v_max_hours   := COALESCE(NULLIF(overtime_setting('overtime_max_hours_per_day', '4'), '')::numeric, 4);

  IF v_dur_min < v_min_minutes THEN
    RETURN json_build_object('success', false, 'error',
      'Durasi lembur minimal ' || v_min_minutes || ' menit');
  END IF;
  IF v_hours > v_max_hours THEN
    RETURN json_build_object('success', false, 'error',
      'Lembur maksimal ' || v_max_hours::text || ' jam per hari');
  END IF;

  IF p_date > CURRENT_DATE + INTERVAL '30 days' THEN
    RETURN json_build_object('success', false, 'error', 'Tidak bisa mengajukan lebih dari 30 hari ke depan');
  END IF;
  IF p_date < CURRENT_DATE - INTERVAL '30 days' THEN
    RETURN json_build_object('success', false, 'error', 'Pengajuan terlalu lama (maksimal 30 hari ke belakang)');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'admin_puskesmas')
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM employee_schedules
      WHERE user_id = auth.uid() AND date = p_date
    ) THEN
      RETURN json_build_object('success', false, 'error',
        'Tidak ada jadwal kerja pada tanggal tersebut');
    END IF;
  END IF;

  INSERT INTO overtime_requests
    (organization_id, user_id, date, start_time, end_time, reason, requested_hours, requested_by, attachment_url)
  VALUES
    (v_org, auth.uid(), p_date, p_start_time, p_end_time,
     NULLIF(TRIM(COALESCE(p_reason, '')), ''), v_hours, auth.uid(),
     NULLIF(TRIM(COALESCE(p_attachment_url, '')), ''));

  RETURN json_build_object('success', true, 'message', 'Pengajuan lembur terkirim');
EXCEPTION WHEN unique_violation THEN
  RETURN json_build_object('success', false, 'error', 'Pengajuan lembur pada tanggal & jam itu sudah ada');
WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.create_overtime_request(date, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_overtime_request(date, text, text, text, text) TO authenticated;
