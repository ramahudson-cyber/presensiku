-- ============================================================================
-- SANGGAHAN: kolom JENIS (5 nilai dari form redesign)
-- keterlambatan | dinas_luar | tidak_hadir | kendala_sistem | tidak_absen_pulang
-- Nullable: data lama tanpa jenis tetap valid & tampil normal.
-- RPC create_sanggahan dipatch (pola fragmen WAJIB ditemukan): signature
-- +param p_jenis, whitelist nilai, dan INSERT menyertakan jenis.
-- ============================================================================

ALTER TABLE sanggahan ADD COLUMN IF NOT EXISTS jenis TEXT;

DO $patch$
DECLARE
  v_def TEXT;
BEGIN
  v_def := pg_get_functiondef('public.create_sanggahan(date,text,text)'::regprocedure);

  IF position('p_jenis' IN v_def) > 0 THEN
    RAISE NOTICE 'create_sanggahan sudah mendukung jenis — dilewati';
    RETURN;
  END IF;

  -- pg_get_functiondef menulis: p_attachment_url text DEFAULT NULL::text
  IF position('p_attachment_url text DEFAULT NULL::text)' IN v_def) = 0 THEN
    RAISE EXCEPTION 'Signature create_sanggahan tidak dikenali. Patch dibatalkan.';
  END IF;

  -- 1. Signature: tambah parameter p_jenis (default NULL — pemanggil lama aman)
  v_def := replace(v_def,
    'p_attachment_url text DEFAULT NULL::text)',
    'p_attachment_url text DEFAULT NULL::text, p_jenis text DEFAULT NULL::text)');

  -- 2. Whitelist nilai jenis (opsional — NULL boleh untuk kompatibilitas)
  v_def := replace(v_def,
    'INSERT INTO sanggahan (user_id, organization_id, tanggal, attendance_id, old_status, reason, attachment_url, status)',
    'IF p_jenis IS NOT NULL AND TRIM(p_jenis) <> '''' AND p_jenis NOT IN (''keterlambatan'', ''dinas_luar'', ''tidak_hadir'', ''kendala_sistem'', ''tidak_absen_pulang'') THEN' || chr(10) ||
    '    RETURN json_build_object(''success'', false, ''error'', ''Jenis sanggahan tidak valid'');' || chr(10) ||
    '  END IF;' || chr(10) ||
    '  INSERT INTO sanggahan (user_id, organization_id, tanggal, attendance_id, old_status, reason, attachment_url, jenis, status)');

  -- 3. VALUES: sertakan jenis
  IF position('TRIM(p_reason), p_attachment_url, ''pending'')' IN v_def) = 0 THEN
    RAISE EXCEPTION 'Fragmen VALUES create_sanggahan tidak dikenali. Patch dibatalkan.';
  END IF;
  v_def := replace(v_def, 'TRIM(p_reason), p_attachment_url, ''pending'')', 'TRIM(p_reason), p_attachment_url, NULLIF(TRIM(LOWER(p_jenis)), ''''), ''pending'')');

  EXECUTE v_def;
  RAISE NOTICE 'create_sanggahan: mendukung jenis sanggahan';
END;
$patch$;

NOTIFY pgrst, 'reload schema';
