-- =====================================================================
-- SANGGAH UNTUK "TIDAK ABSEN PULANG"
--
-- Sebelumnya Sanggah hanya menerima status alpha/terlambat, sehingga
-- pegawai yang hadir tapi lupa absen pulang tidak punya jalur komplain —
-- padahal potongan payroll "tidak absen pulang" kini berlaku.
--
-- Aturan baru di create_sanggahan & admin_create_sanggahan:
--   status 'hadir' BOLEH disanggah HANYA bila
--     - jam masuk terisi & jam pulang kosong (kasus tanpa pulang),
--     - tanggal sudah lewat (hari ini masih bisa absen pulang).
--   old_status = 'tanpa_pulang' supaya admin tahu jenis pengajuannya.
--
-- review_sanggahan tidak diubah: jalur approve yang ada sudah
-- mengosongkan jam masuk/pulang + penanda notes, dan hitungan payroll
-- otomatis melewati hari dengan sanggahan pending/approved maupun
-- baris hasil koreksi sanggahan. Ditolak → potongan kembali berlaku.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. create_sanggahan (pengajuan pegawai)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_sanggahan(
  p_tanggal DATE,
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
  v_org UUID := current_org_id();
  v_today DATE := (now() AT TIME ZONE 'Asia/Makassar')::DATE;
  v_att RECORD;
  v_status TEXT;
  v_att_id UUID;
BEGIN
  IF v_uid IS NULL OR v_org IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Sesi tidak valid');
  END IF;

  IF p_tanggal IS NULL OR p_tanggal > v_today THEN
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
  SELECT id, attendance_status::text AS st, clock_in_time, clock_out_time INTO v_att
  FROM attendance WHERE user_id = v_uid AND date = p_tanggal;
  IF FOUND THEN
    v_status := v_att.st;
    v_att_id := v_att.id;
    IF v_status IN ('alpha', 'terlambat') THEN
      NULL; -- jalur lama, tidak berubah
    ELSIF v_status = 'hadir'
          AND v_att.clock_in_time IS NOT NULL
          AND v_att.clock_out_time IS NULL
          AND p_tanggal < v_today THEN
      -- Hadir tapi tidak pernah absen pulang, hari sudah lewat
      v_status := 'tanpa_pulang';
    ELSE
      RETURN json_build_object('success', false, 'error', 'Status ' || v_att.st || ' tidak dapat disanggah');
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

-- ---------------------------------------------------------------------
-- 2. admin_create_sanggahan (koreksi langsung oleh admin, auto-approve)
--    Hari hadir-tanpa-pulang yang sudah lewat kini ikut diproses;
--    hari hadir yang jam pulangnya sudah tercatat tetap dilewati.
-- ---------------------------------------------------------------------
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

      SELECT id, attendance_status::text AS st, clock_in_time, clock_out_time INTO v_att
      FROM attendance WHERE user_id = p_user_id AND date = v_d;
      IF FOUND THEN
        IF v_att.st IN ('alpha', 'terlambat') THEN
          NULL; -- jalur lama
        ELSIF v_att.st = 'hadir'
              AND v_att.clock_in_time IS NOT NULL
              AND v_att.clock_out_time IS NULL
              AND v_d < v_today THEN
          NULL; -- hadir tanpa absen pulang: boleh dikoreksi admin
        ELSE
          v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
            'tanggal', to_char(v_d, 'YYYY-MM-DD'), 'alasan', 'Status sudah ' || v_att.st));
          v_d := v_d + 1;
          CONTINUE;
        END IF;
        INSERT INTO sanggahan (user_id, organization_id, tanggal, attendance_id, old_status, reason, attachment_url, status)
        VALUES (p_user_id, v_target_org, v_d, v_att.id,
                CASE WHEN v_att.st = 'hadir' THEN 'tanpa_pulang' ELSE v_att.st END,
                TRIM(p_reason), p_attachment_url, 'pending')
        RETURNING id INTO v_sang_id;
      ELSE
        IF NOT EXISTS (SELECT 1 FROM employee_schedules WHERE user_id = p_user_id AND date = v_d) THEN
          v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
            'tanggal', to_char(v_d, 'YYYY-MM-DD'), 'alasan', 'Tidak ada jadwal/absensi'));
          v_d := v_d + 1;
          CONTINUE;
        END IF;
        -- Tanggal masa depan = hari bebas terjadwal → old_status 'belum'
        INSERT INTO sanggahan (user_id, organization_id, tanggal, attendance_id, old_status, reason, attachment_url, status)
        VALUES (p_user_id, v_target_org, v_d, NULL,
                CASE WHEN v_d > v_today THEN 'belum' ELSE 'alpha' END,
                TRIM(p_reason), p_attachment_url, 'pending')
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
