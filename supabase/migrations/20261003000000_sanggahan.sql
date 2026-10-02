-- ============================================================
-- Fitur "Sanggah" — komplain absensi (pegawai → admin → koreksi)
--
-- Alur:
--   1. Pegawai mengajukan sanggah untuk tanggal absen yang salah
--      (status alpha/terlambat) + alasan + foto bukti (opsional).
--   2. Admin instansi meninjau: Setujui / Tolak (+ alasan).
--   3. Disetujui → attendance dikoreksi otomatis jadi 'hadir'
--      (UPDATE baris yang ada, atau INSERT untuk hari alpha tanpa
--      record — shift diambil dari employee_schedules).
-- Anti-double: satu sanggahan PENDING per user per tanggal
--   (partial unique index); setelah diproses bisa mengajukan lagi.
-- RPC create/review SECURITY DEFINER (RLS tabel tidak perlu policy
-- INSERT/UPDATE dari client). Cancel pending = DELETE milik sendiri.
-- ============================================================

-- ── Bucket foto bukti (pola bucket avatars) ────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('sanggahan', 'sanggahan', true, 2097152, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "sanggahan_bucket_select" ON storage.objects;
CREATE POLICY "sanggahan_bucket_select" ON storage.objects FOR SELECT
USING (bucket_id = 'sanggahan');

DROP POLICY IF EXISTS "sanggahan_bucket_insert" ON storage.objects;
CREATE POLICY "sanggahan_bucket_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'sanggahan');

DROP POLICY IF EXISTS "sanggahan_bucket_own_update" ON storage.objects;
CREATE POLICY "sanggahan_bucket_own_update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'sanggahan' AND (auth.uid())::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "sanggahan_bucket_own_delete" ON storage.objects;
CREATE POLICY "sanggahan_bucket_own_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'sanggahan' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- ── Tabel sanggahan ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sanggahan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  tanggal DATE NOT NULL,
  attendance_id UUID REFERENCES attendance(id) ON DELETE SET NULL,
  old_status TEXT,
  reason TEXT NOT NULL,
  attachment_url TEXT,
  status VARCHAR NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Anti-double: maksimal SATU pending per user per tanggal
CREATE UNIQUE INDEX IF NOT EXISTS uniq_sanggahan_pending
ON sanggahan(user_id, tanggal) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_sanggahan_user ON sanggahan(user_id);
CREATE INDEX IF NOT EXISTS idx_sanggahan_org_status ON sanggahan(organization_id, status);

ALTER TABLE sanggahan ENABLE ROW LEVEL SECURITY;

-- Pegawai melihat sanggahan miliknya
DROP POLICY IF EXISTS sanggahan_select_own ON sanggahan;
CREATE POLICY sanggahan_select_own ON sanggahan FOR SELECT
USING (auth.uid() = user_id);

-- Admin instansi melihat org-nya; super_admin melihat semua
DROP POLICY IF EXISTS sanggahan_select_admin ON sanggahan;
CREATE POLICY sanggahan_select_admin ON sanggahan FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('super_admin', 'admin', 'admin_puskesmas', 'kepala_unit')
      AND (p.role = 'super_admin' OR p.organization_id = sanggahan.organization_id)
  )
);

-- Pegawai boleh membatalkan sanggahan yang masih pending
DROP POLICY IF EXISTS sanggahan_delete_own_pending ON sanggahan;
CREATE POLICY sanggahan_delete_own_pending ON sanggahan FOR DELETE
USING (auth.uid() = user_id AND status = 'pending');

-- Insert/Update HANYA lewat RPC SECURITY DEFINER (tanpa policy INSERT/UPDATE)

-- updated_at otomatis (function sudah ada, dipakai attendance)
DROP TRIGGER IF EXISTS trg_sanggahan_updated_at ON sanggahan;
CREATE TRIGGER trg_sanggahan_updated_at
BEFORE UPDATE ON sanggahan
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── RPC: create_sanggahan (pegawai) ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_sanggahan(p_tanggal DATE, p_reason TEXT, p_attachment_url TEXT DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_org UUID := current_org_id();
  v_att RECORD;
  v_status TEXT;
  v_att_id UUID;
BEGIN
  IF v_uid IS NULL OR v_org IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Sesi tidak valid');
  END IF;

  IF p_tanggal IS NULL OR p_tanggal > (now() AT TIME ZONE 'Asia/Makassar')::DATE THEN
    RETURN json_build_object('success', false, 'error', 'Tanggal tidak valid');
  END IF;

  IF COALESCE(TRIM(p_reason), '') = '' THEN
    RETURN json_build_object('success', false, 'error', 'Alasan wajib diisi');
  END IF;

  -- Anti-double: maksimal satu pending per user per tanggal
  IF EXISTS (
    SELECT 1 FROM sanggahan
    WHERE user_id = v_uid AND tanggal = p_tanggal AND status = 'pending'
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Sudah ada sanggahan menunggu review untuk tanggal ini');
  END IF;

  -- Tanggal harus punya absensi ATAU jadwal kerja
  SELECT id, attendance_status::text AS st INTO v_att
  FROM attendance WHERE user_id = v_uid AND date = p_tanggal;
  IF FOUND THEN
    v_status := v_att.st;
    v_att_id := v_att.id;
    IF v_status NOT IN ('alpha', 'terlambat') THEN
      RETURN json_build_object('success', false, 'error', 'Status ' || v_status || ' tidak dapat disanggah');
    END IF;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM employee_schedules WHERE user_id = v_uid AND date = p_tanggal) THEN
      RETURN json_build_object('success', false, 'error', 'Tidak ada absensi/jadwal kerja pada tanggal tersebut');
    END IF;
    v_status := 'alpha';
  END IF;

  INSERT INTO sanggahan (user_id, organization_id, tanggal, attendance_id, old_status, reason, attachment_url, status)
  VALUES (v_uid, v_org, p_tanggal, v_att_id, v_status, TRIM(p_reason), p_attachment_url, 'pending');

  RETURN json_build_object('success', true, 'message', 'Sanggahan terkirim, menunggu review admin');
END;
$$;

-- ── RPC: review_sanggahan (admin instansi / super admin) ──────────────────
CREATE OR REPLACE FUNCTION public.review_sanggahan(p_sanggahan_id UUID, p_approve BOOLEAN, p_rejection_reason TEXT DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT;
  v_org UUID;
  v_s RECORD;
  v_new_att_id UUID;
  v_shift TEXT;
BEGIN
  SELECT role::TEXT INTO v_role FROM profiles WHERE id = v_uid;
  IF v_role IS NULL OR v_role NOT IN ('super_admin', 'admin', 'admin_puskesmas') THEN
    RETURN json_build_object('success', false, 'error', 'Akses ditolak');
  END IF;

  SELECT * INTO v_s FROM sanggahan WHERE id = p_sanggahan_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Sanggahan tidak ditemukan');
  END IF;
  IF v_s.status <> 'pending' THEN
    RETURN json_build_object('success', false, 'error', 'Sanggahan sudah diproses');
  END IF;

  -- Admin instansi hanya boleh memproses org-nya sendiri
  IF v_role <> 'super_admin' THEN
    SELECT organization_id INTO v_org FROM profiles WHERE id = v_uid;
    IF v_org IS NULL OR v_org <> v_s.organization_id THEN
      RETURN json_build_object('success', false, 'error', 'Tidak berhak memproses sanggahan ini');
    END IF;
  END IF;

  IF p_approve THEN
    IF v_s.attendance_id IS NOT NULL THEN
      -- Koreksi record absensi yang ada → jadi Hadir/valid
      UPDATE attendance
      SET attendance_status = 'hadir',
          is_late = false,
          late_minutes = 0,
          notes = CASE WHEN COALESCE(TRIM(notes), '') = ''
                       THEN 'Dikoreksi via sanggahan'
                       ELSE notes || ' — dikoreksi via sanggahan' END
      WHERE id = v_s.attendance_id;
      v_new_att_id := v_s.attendance_id;
    ELSE
      -- Hari alpha tanpa record: buat record Hadir (shift dari jadwal bila ada)
      SELECT shift_code INTO v_shift
      FROM employee_schedules WHERE user_id = v_s.user_id AND date = v_s.tanggal;

      IF EXISTS (SELECT 1 FROM attendance WHERE user_id = v_s.user_id AND date = v_s.tanggal) THEN
        UPDATE attendance
        SET attendance_status = 'hadir', is_late = false, late_minutes = 0
        WHERE user_id = v_s.user_id AND date = v_s.tanggal
        RETURNING id INTO v_new_att_id;
      ELSE
        INSERT INTO attendance (user_id, date, attendance_status, is_late, late_minutes, schedule_match, shift_code, notes)
        VALUES (v_s.user_id, v_s.tanggal, 'hadir', false, 0, true, v_shift, 'Dikoreksi via sanggahan')
        RETURNING id INTO v_new_att_id;
      END IF;
    END IF;

    UPDATE sanggahan
    SET status = 'approved',
        reviewed_by = v_uid,
        reviewed_at = NOW(),
        rejection_reason = NULL,
        attendance_id = COALESCE(v_new_att_id, attendance_id),
        updated_at = NOW()
    WHERE id = p_sanggahan_id;

    RETURN json_build_object('success', true, 'message', 'Sanggahan disetujui — absensi dikoreksi menjadi Hadir');
  ELSE
    IF COALESCE(TRIM(p_rejection_reason), '') = '' THEN
      RETURN json_build_object('success', false, 'error', 'Alasan penolakan wajib diisi');
    END IF;

    UPDATE sanggahan
    SET status = 'rejected',
        rejection_reason = TRIM(p_rejection_reason),
        reviewed_by = v_uid,
        reviewed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_sanggahan_id;

    RETURN json_build_object('success', true, 'message', 'Sanggahan ditolak');
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_sanggahan(DATE, TEXT, TEXT) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.create_sanggahan(DATE, TEXT, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.review_sanggahan(UUID, BOOLEAN, TEXT) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.review_sanggahan(UUID, BOOLEAN, TEXT) TO authenticated;
