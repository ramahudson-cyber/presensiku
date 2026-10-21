-- ============================================================
-- MIGRATION: Default tarif lembur 15000 + seed setting per instansi
-- ============================================================
-- Masalah yang diperbaiki:
--   RPC review_overtime_request & admin_create_overtime membaca
--   overtime_setting('overtime_rate_per_hour', '0'). Bila admin belum
--   pernah menyimpan tarif di Pengaturan, server memakai 0 → uang lembur
--   tersimpan Rp0 walaupun UI menampilkan Rp15.000 (default klien).
--
-- Perbaikan:
--   1. Default di kedua RPC diubah dari '0' menjadi '15000'.
--   2. Seed system_settings untuk semua instansi yang belum punya nilai,
--      supaya nilai terlihat & bisa diubah admin (bukan hanya default
--      implisit di fungsi).
--
-- Idempotent: CREATE OR REPLACE + INSERT ... WHERE NOT EXISTS.
-- ============================================================

-- ----------------------------------------------------------------------------
-- 1. Seed tarif default untuk instansi yang belum punya setting
-- ----------------------------------------------------------------------------
INSERT INTO system_settings (organization_id, setting_key, value, category)
SELECT o.id, 'overtime_rate_per_hour', '15000', 'overtime'
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM system_settings s
  WHERE s.organization_id = o.id
    AND s.setting_key = 'overtime_rate_per_hour'
);

INSERT INTO system_settings (organization_id, setting_key, value, category)
SELECT o.id, 'overtime_min_minutes', '30', 'overtime'
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM system_settings s
  WHERE s.organization_id = o.id
    AND s.setting_key = 'overtime_min_minutes'
);

INSERT INTO system_settings (organization_id, setting_key, value, category)
SELECT o.id, 'overtime_max_hours_per_day', '4', 'overtime'
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM system_settings s
  WHERE s.organization_id = o.id
    AND s.setting_key = 'overtime_max_hours_per_day'
);

-- ----------------------------------------------------------------------------
-- 2. admin_create_overtime — default tarif 15000
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_create_overtime(
  p_user_id UUID,
  p_date DATE,
  p_start_time TEXT,
  p_end_time TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID := current_org_id();
  v_start_min INT;
  v_end_min INT;
  v_hours NUMERIC(5,2);
  v_rate NUMERIC(12,2);
  v_target_org UUID;
  v_max_hours NUMERIC(5,2);
BEGIN
  IF NOT is_org_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Hanya admin yang dapat membuat lembur');
  END IF;

  SELECT organization_id INTO v_target_org FROM profiles WHERE id = p_user_id;
  IF v_target_org IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Pegawai tidak ditemukan');
  END IF;
  IF v_target_org <> v_org AND NOT is_platform_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Pegawai bukan dari instansi Anda');
  END IF;

  IF p_start_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
     OR p_end_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
    RETURN json_build_object('success', false, 'error', 'Format jam harus HH:MM');
  END IF;

  v_start_min := split_part(p_start_time, ':', 1)::int * 60 + split_part(p_start_time, ':', 2)::int;
  v_end_min   := split_part(p_end_time, ':', 1)::int * 60 + split_part(p_end_time, ':', 2)::int;
  IF v_end_min <= v_start_min THEN
    RETURN json_build_object('success', false, 'error', 'Jam selesai harus setelah jam mulai');
  END IF;
  v_hours := ROUND(((v_end_min - v_start_min) / 60.0)::numeric, 2);

  v_max_hours := COALESCE(NULLIF(overtime_setting('overtime_max_hours_per_day', '4'), '')::numeric, 4);
  IF v_hours > v_max_hours THEN
    RETURN json_build_object('success', false, 'error',
      'Lembur maksimal ' || v_max_hours::text || ' jam per hari');
  END IF;

  -- Default 15000 (bukan 0): tarif belum diset bukan berarti gratis.
  v_rate := COALESCE(NULLIF(overtime_setting('overtime_rate_per_hour', '15000'), '')::numeric, 15000);

  INSERT INTO overtime_requests
    (organization_id, user_id, date, start_time, end_time, reason, requested_hours,
     approved_hours, pay_rate_per_hour, pay_amount, status, requested_by, approved_by, approved_at)
  VALUES
    (v_org, p_user_id, p_date, p_start_time, p_end_time, NULLIF(TRIM(COALESCE(p_reason, '')), ''), v_hours,
     v_hours, v_rate, ROUND(v_hours * v_rate, 2), 'approved', auth.uid(), auth.uid(), now());

  RETURN json_build_object('success', true, 'message', 'Lembur tercatat & disetujui');
EXCEPTION WHEN unique_violation THEN
  RETURN json_build_object('success', false, 'error', 'Lembur pada tanggal & jam itu sudah ada');
WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. review_overtime_request — default tarif 15000
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.review_overtime_request(
  p_request_id UUID,
  p_action TEXT,
  p_hours NUMERIC DEFAULT NULL,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req overtime_requests%ROWTYPE;
  v_hours NUMERIC(5,2);
  v_rate NUMERIC(12,2);
  v_max_hours NUMERIC(5,2);
BEGIN
  IF NOT is_org_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Hanya admin yang dapat memproses lembur');
  END IF;

  SELECT * INTO v_req FROM overtime_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Pengajuan tidak ditemukan');
  END IF;
  IF v_req.organization_id <> current_org_id() AND NOT is_platform_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Pengajuan bukan dari instansi Anda');
  END IF;
  IF v_req.status <> 'pending' THEN
    RETURN json_build_object('success', false, 'error', 'Pengajuan sudah diproses');
  END IF;

  IF p_action = 'approve' THEN
    v_hours := COALESCE(p_hours, v_req.requested_hours);
    IF v_hours IS NULL OR v_hours <= 0 OR v_hours > 24 THEN
      RETURN json_build_object('success', false, 'error', 'Jam lembur dibayar tidak valid');
    END IF;
    v_max_hours := COALESCE(NULLIF(overtime_setting('overtime_max_hours_per_day', '4'), '')::numeric, 4);
    IF v_hours > v_max_hours THEN
      RETURN json_build_object('success', false, 'error',
        'Melebihi batas ' || v_max_hours::text || ' jam per hari — ubah pengaturan lembur dulu');
    END IF;
    -- Default 15000 (bukan 0): tarif belum diset bukan berarti gratis.
    v_rate := COALESCE(NULLIF(overtime_setting('overtime_rate_per_hour', '15000'), '')::numeric, 15000);

    UPDATE overtime_requests SET
      status = 'approved',
      approved_hours = v_hours,
      pay_rate_per_hour = v_rate,
      pay_amount = ROUND(v_hours * v_rate, 2),
      approved_by = auth.uid(),
      approved_at = now(),
      updated_at = now()
    WHERE id = p_request_id;

    RETURN json_build_object('success', true, 'message',
      'Disetujui: ' || v_hours::text || ' jam × Rp' || v_rate::text);

  ELSIF p_action = 'reject' THEN
    UPDATE overtime_requests SET
      status = 'rejected',
      rejection_reason = NULLIF(TRIM(COALESCE(p_rejection_reason, '')), ''),
      approved_by = auth.uid(),
      approved_at = now(),
      updated_at = now()
    WHERE id = p_request_id;
    RETURN json_build_object('success', true, 'message', 'Pengajuan ditolak');
  ELSE
    RETURN json_build_object('success', false, 'error', 'Aksi tidak dikenal');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

NOTIFY pgrst, 'reload schema';
