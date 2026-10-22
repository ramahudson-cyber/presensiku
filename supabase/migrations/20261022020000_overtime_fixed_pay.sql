-- ============================================================
-- MIGRATION: Lembur nominal tetap (borongan)
-- ============================================================
-- Latar belakang:
--   Saat ini semua lembur dibayar per jam (approved_hours × tarif).
--   Kebutuhan nyata: kerja di hari libur, mis. Minggu 07.00-23.00,
--   dibayar nominal tetap Rp500.000 (bukan 16 jam × tarif).
--
-- Desain:
--   Dua mode berdampingan:
--     'hourly' -> pay_amount = approved_hours × pay_rate_per_hour
--     'fixed'  -> pay_amount = fixed_amount (diketik admin)
--   Jam mulai/selesai TETAP WAJIB di kedua mode:
--     - durasi tetap tampil
--     - batas absen pulang tetap otomatis diperpanjang (overtime_approved_end)
--   Nominal hanya boleh ditentukan admin (pegawai tetap mengajukan seperti biasa).
--
-- Perubahan:
--   1. Kolom pay_mode + fixed_amount (default 'hourly' → data lama aman).
--   2. admin_create_overtime & review_overtime_request: parameter mode + nominal.
--      Signature berubah → fungsi lama DROP dulu, lalu GRANT ulang.
--   3. Trigger payroll diperluas agar koreksi nominal ikut me-refresh slip.
--
-- Idempotent: ALTER ... IF NOT EXISTS, CREATE OR REPLACE, DROP FUNCTION IF EXISTS.
-- ============================================================

-- ----------------------------------------------------------------------------
-- 1. Kolom mode bayar
-- ----------------------------------------------------------------------------
ALTER TABLE public.overtime_requests
  ADD COLUMN IF NOT EXISTS pay_mode TEXT NOT NULL DEFAULT 'hourly',
  ADD COLUMN IF NOT EXISTS fixed_amount NUMERIC(14,2);

DO $$ BEGIN
  ALTER TABLE public.overtime_requests
    ADD CONSTRAINT overtime_requests_pay_mode_chk
    CHECK (pay_mode IN ('hourly', 'fixed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.overtime_requests
    ADD CONSTRAINT overtime_requests_fixed_amount_chk
    CHECK (fixed_amount IS NULL OR fixed_amount > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON COLUMN public.overtime_requests.pay_mode IS
  'hourly = jam × tarif; fixed = nominal borongan yang ditentukan admin';
COMMENT ON COLUMN public.overtime_requests.fixed_amount IS
  'Nominal borongan (rupiah). NULL untuk mode hourly.';

-- ----------------------------------------------------------------------------
-- 2. admin_create_overtime — dukung mode nominal tetap
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_create_overtime(uuid, date, text, text, text);

CREATE OR REPLACE FUNCTION public.admin_create_overtime(
  p_user_id UUID,
  p_date DATE,
  p_start_time TEXT,
  p_end_time TEXT,
  p_reason TEXT DEFAULT NULL,
  p_pay_mode TEXT DEFAULT 'hourly',
  p_fixed_amount NUMERIC DEFAULT NULL
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
  v_mode TEXT := COALESCE(NULLIF(TRIM(LOWER(p_pay_mode)), ''), 'hourly');
  v_amount NUMERIC(14,2);
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

  IF v_mode NOT IN ('hourly', 'fixed') THEN
    RETURN json_build_object('success', false, 'error', 'Mode bayar tidak dikenal');
  END IF;

  -- Jam tetap wajib di kedua mode (durasi + batas absen pulang).
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

  IF v_mode = 'hourly' THEN
    -- Batas jam/hari hanya relevan untuk upah per jam. Borongan (mis. jaga
    -- hari libur 16 jam) sengaja tidak dibatasi angka ini.
    v_max_hours := COALESCE(NULLIF(overtime_setting('overtime_max_hours_per_day', '4'), '')::numeric, 4);
    IF v_hours > v_max_hours THEN
      RETURN json_build_object('success', false, 'error',
        'Lembur maksimal ' || v_max_hours::text || ' jam per hari');
    END IF;
    -- Default 15000 (bukan 0): tarif belum diset bukan berarti gratis.
    v_rate := COALESCE(NULLIF(overtime_setting('overtime_rate_per_hour', '15000'), '')::numeric, 15000);
    v_amount := ROUND(v_hours * v_rate, 2);
  ELSE
    v_rate := NULL;
    IF p_fixed_amount IS NULL OR p_fixed_amount <= 0 THEN
      RETURN json_build_object('success', false, 'error', 'Nominal lembur harus lebih dari 0');
    END IF;
    v_amount := ROUND(p_fixed_amount, 2);
  END IF;

  INSERT INTO overtime_requests
    (organization_id, user_id, date, start_time, end_time, reason, requested_hours,
     approved_hours, pay_rate_per_hour, pay_amount, status, requested_by, approved_by, approved_at,
     pay_mode, fixed_amount)
  VALUES
    (v_org, p_user_id, p_date, p_start_time, p_end_time, NULLIF(TRIM(COALESCE(p_reason, '')), ''), v_hours,
     v_hours, v_rate, v_amount, 'approved', auth.uid(), auth.uid(), now(),
     v_mode, CASE WHEN v_mode = 'fixed' THEN v_amount ELSE NULL END);

  RETURN json_build_object('success', true, 'message',
    CASE WHEN v_mode = 'fixed'
      THEN 'Lembur tercatat: nominal tetap Rp' || v_amount::text
      ELSE 'Lembur tercatat & disetujui'
    END);
EXCEPTION WHEN unique_violation THEN
  RETURN json_build_object('success', false, 'error', 'Lembur pada tanggal & jam itu sudah ada');
WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. review_overtime_request — admin bisa menetapkan nominal saat menyetujui
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.review_overtime_request(uuid, text, numeric, text);

CREATE OR REPLACE FUNCTION public.review_overtime_request(
  p_request_id UUID,
  p_action TEXT,
  p_hours NUMERIC DEFAULT NULL,
  p_rejection_reason TEXT DEFAULT NULL,
  p_pay_mode TEXT DEFAULT NULL,
  p_fixed_amount NUMERIC DEFAULT NULL
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
  v_mode TEXT;
  v_amount NUMERIC(14,2);
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
    -- Mode default mengikuti pengajuan; admin boleh mengganti ke borongan.
    v_mode := COALESCE(NULLIF(TRIM(LOWER(p_pay_mode)), ''), v_req.pay_mode, 'hourly');
    IF v_mode NOT IN ('hourly', 'fixed') THEN
      RETURN json_build_object('success', false, 'error', 'Mode bayar tidak dikenal');
    END IF;

    v_hours := COALESCE(p_hours, v_req.requested_hours);
    IF v_hours IS NULL OR v_hours <= 0 OR v_hours > 24 THEN
      RETURN json_build_object('success', false, 'error', 'Jam lembur dibayar tidak valid');
    END IF;

    IF v_mode = 'hourly' THEN
      v_max_hours := COALESCE(NULLIF(overtime_setting('overtime_max_hours_per_day', '4'), '')::numeric, 4);
      IF v_hours > v_max_hours THEN
        RETURN json_build_object('success', false, 'error',
          'Melebihi batas ' || v_max_hours::text || ' jam per hari — ubah pengaturan lembur dulu');
      END IF;
      -- Default 15000 (bukan 0): tarif belum diset bukan berarti gratis.
      v_rate := COALESCE(NULLIF(overtime_setting('overtime_rate_per_hour', '15000'), '')::numeric, 15000);
      v_amount := ROUND(v_hours * v_rate, 2);
    ELSE
      v_rate := NULL;
      IF p_fixed_amount IS NULL OR p_fixed_amount <= 0 THEN
        RETURN json_build_object('success', false, 'error', 'Nominal lembur harus lebih dari 0');
      END IF;
      v_amount := ROUND(p_fixed_amount, 2);
    END IF;

    UPDATE overtime_requests SET
      status = 'approved',
      approved_hours = v_hours,
      pay_mode = v_mode,
      pay_rate_per_hour = v_rate,
      fixed_amount = CASE WHEN v_mode = 'fixed' THEN v_amount ELSE NULL END,
      pay_amount = v_amount,
      approved_by = auth.uid(),
      approved_at = now(),
      updated_at = now()
    WHERE id = p_request_id;

    RETURN json_build_object('success', true, 'message',
      CASE WHEN v_mode = 'fixed'
        THEN 'Disetujui: nominal tetap Rp' || v_amount::text
        ELSE 'Disetujui: ' || v_hours::text || ' jam × Rp' || v_rate::text
      END);

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

-- ----------------------------------------------------------------------------
-- 4. GRANT ulang (signature berubah)
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.admin_create_overtime(uuid, date, text, text, text, text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_overtime(uuid, date, text, text, text, text, numeric) TO authenticated;
REVOKE ALL ON FUNCTION public.review_overtime_request(uuid, text, numeric, text, text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_overtime_request(uuid, text, numeric, text, text, numeric) TO authenticated;

-- ----------------------------------------------------------------------------
-- 5. Trigger payroll: koreksi nominal ikut me-refresh slip
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_overtime_refresh_payroll ON public.overtime_requests;
CREATE TRIGGER trg_overtime_refresh_payroll
  AFTER INSERT OR UPDATE OF status, pay_amount ON public.overtime_requests
  FOR EACH ROW
  WHEN (NEW.status = 'approved')
  EXECUTE FUNCTION public.refresh_payroll_after_overtime();

-- ----------------------------------------------------------------------------
-- 6. Slip: jam lembur hanya dihitung dari baris mode hourly
--    (borongan tetap punya durasi, tapi bukan "jam yang dibayar").
-- ----------------------------------------------------------------------------
DO $patch_payroll_hours$
DECLARE
  v_def TEXT;
  v_old TEXT := $frag$  SELECT COALESCE(SUM(ot.approved_hours), 0), COALESCE(SUM(ot.pay_amount), 0)$frag$;
  v_new TEXT := $frag$  SELECT COALESCE(SUM(CASE WHEN COALESCE(ot.pay_mode, 'hourly') = 'hourly'
                                         THEN ot.approved_hours ELSE 0 END), 0),
         COALESCE(SUM(ot.pay_amount), 0)$frag$;
BEGIN
  v_def := pg_get_functiondef('public.upsert_payroll_line(uuid,uuid,date,jsonb,uuid)'::regprocedure);

  IF position('ot.pay_mode' IN v_def) > 0 THEN
    RAISE NOTICE 'upsert_payroll_line sudah membedakan mode bayar — dilewati';
    RETURN;
  END IF;
  IF position(v_old IN v_def) = 0 THEN
    RAISE EXCEPTION 'Fragmen jam lembur payroll tidak ditemukan. Patch dibatalkan.';
  END IF;

  v_def := replace(v_def, v_old, v_new);
  EXECUTE v_def;
  RAISE NOTICE 'upsert_payroll_line: jam lembur hanya dari mode hourly';
END;
$patch_payroll_hours$;

NOTIFY pgrst, 'reload schema';
