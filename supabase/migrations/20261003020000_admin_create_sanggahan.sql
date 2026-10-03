-- =====================================================================
-- Admin sanggahkan pegawai (tanpa pengajuan dari pegawai):
-- admin_create_sanggahan(p_user_id, p_date_from, p_date_to, p_reason,
--                        p_attachment_url)
-- Memproses rentang tanggal per hari dengan aturan yang sama seperti
-- pengajuan pegawai, lalu LANGSUNG disetujui (review_sanggahan dipanggil
-- ulang sehingga seluruh logika koreksi — hadir, jam dikosongkan, penanda
-- notes — terpakai tanpa duplikasi). Hari yang tidak valid dilewati dan
-- dilaporkan: sudah ada sanggahan, status sudah hadir/izin/sakit,
-- tidak ada jadwal/absensi, atau tanggal masa depan.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.admin_create_sanggahan(
  p_user_id UUID,
  p_date_from DATE,
  p_date_to DATE,
  p_reason TEXT,
  p_attachment_url TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT;
  v_caller_org UUID;
  v_target_org UUID;
  v_today DATE := (now() AT TIME ZONE 'Asia/Makassar')::DATE;
  v_d DATE;
  v_att RECORD;
  v_sang_id UUID;
  v_res JSON;
  v_created INT := 0;
  v_skipped JSONB := '[]'::JSONB;
BEGIN
  SELECT role::TEXT, organization_id INTO v_role, v_caller_org
  FROM profiles WHERE id = v_uid;
  IF v_role IS NULL OR v_role NOT IN ('super_admin', 'admin', 'admin_puskesmas') THEN
    RETURN json_build_object('success', false, 'error', 'Akses ditolak');
  END IF;

  SELECT organization_id INTO v_target_org FROM profiles WHERE id = p_user_id;
  IF v_target_org IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Pegawai tidak ditemukan');
  END IF;
  -- Non-super_admin hanya boleh untuk pegawai satu organisasi
  IF v_role <> 'super_admin' AND (v_caller_org IS NULL OR v_caller_org <> v_target_org) THEN
    RETURN json_build_object('success', false, 'error', 'Pegawai bukan dari instansi Anda');
  END IF;

  IF p_date_from IS NULL OR p_date_to IS NULL OR p_date_from > p_date_to THEN
    RETURN json_build_object('success', false, 'error', 'Rentang tanggal tidak valid');
  END IF;
  IF p_date_from < v_today - 366 THEN
    RETURN json_build_object('success', false, 'error', 'Rentang terlalu lama (maksimal 1 tahun ke belakang)');
  END IF;
  IF COALESCE(TRIM(p_reason), '') = '' THEN
    RETURN json_build_object('success', false, 'error', 'Alasan wajib diisi');
  END IF;

  v_d := p_date_from;
  WHILE v_d <= p_date_to LOOP
    BEGIN
      IF v_d > v_today THEN
        v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
          'tanggal', to_char(v_d, 'YYYY-MM-DD'), 'alasan', 'Tanggal masa depan'));
        v_d := v_d + 1;
        CONTINUE;
      END IF;

      -- Sudah ada sanggahan (pending/approved) untuk user+tanggal?
      IF EXISTS (
        SELECT 1 FROM sanggahan
        WHERE user_id = p_user_id AND tanggal = v_d AND status IN ('pending', 'approved')
      ) THEN
        v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
          'tanggal', to_char(v_d, 'YYYY-MM-DD'), 'alasan', 'Sudah ada sanggahan'));
        v_d := v_d + 1;
        CONTINUE;
      END IF;

      -- Tentukan status lama dari attendance (alpha/terlambat) atau jadwal
      SELECT id, attendance_status::text AS st INTO v_att
      FROM attendance WHERE user_id = p_user_id AND date = v_d;
      IF FOUND THEN
        IF v_att.st NOT IN ('alpha', 'terlambat') THEN
          v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
            'tanggal', to_char(v_d, 'YYYY-MM-DD'), 'alasan', 'Status sudah ' || v_att.st));
          v_d := v_d + 1;
          CONTINUE;
        END IF;
        INSERT INTO sanggahan (user_id, organization_id, tanggal, attendance_id, old_status, reason, attachment_url, status)
        VALUES (p_user_id, v_target_org, v_d, v_att.id, v_att.st, TRIM(p_reason), p_attachment_url, 'pending')
        RETURNING id INTO v_sang_id;
      ELSE
        IF NOT EXISTS (SELECT 1 FROM employee_schedules WHERE user_id = p_user_id AND date = v_d) THEN
          v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
            'tanggal', to_char(v_d, 'YYYY-MM-DD'), 'alasan', 'Tidak ada jadwal/absensi'));
          v_d := v_d + 1;
          CONTINUE;
        END IF;
        INSERT INTO sanggahan (user_id, organization_id, tanggal, attendance_id, old_status, reason, attachment_url, status)
        VALUES (p_user_id, v_target_org, v_d, NULL, 'alpha', TRIM(p_reason), p_attachment_url, 'pending')
        RETURNING id INTO v_sang_id;
      END IF;

      -- Langsung setujui (caller = admin) — reuse logika koreksi review_sanggahan
      v_res := review_sanggahan(v_sang_id, true, NULL);
      IF COALESCE((v_res::JSONB->>'success')::BOOLEAN, false) THEN
        v_created := v_created + 1;
      ELSE
        v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
          'tanggal', to_char(v_d, 'YYYY-MM-DD'),
          'alasan', COALESCE(v_res::JSONB->>'error', 'Gagal diproses')));
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Satu hari gagal tidak menggagalkan hari lain (subtransaction rollback)
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'tanggal', to_char(v_d, 'YYYY-MM-DD'), 'alasan', SQLERRM));
    END;

    v_d := v_d + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'created_count', v_created,
    'skipped', v_skipped
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_sanggahan(UUID, DATE, DATE, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_sanggahan(UUID, DATE, DATE, TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
