-- ============================================================================
-- LEMBUR LINTAS TENGAH MALAM (mis. 22:00–01:00)
-- ============================================================================
-- Sebelumnya: end_time WAJIB > start_time (CHECK tabel + validasi client +
-- validasi 3 RPC), sehingga lembur yang melewati 24:00 tidak bisa diajukan
-- dalam satu slot (harus dipecah dua tanggal).
--
-- Perubahan ini (semuanya aditif terhadap perilaku lama):
--   1. Constraint tabel: end_time <> start_time (end < start = lintas malam).
--   2. create_overtime_request: izinkan end < start dengan jendela malam
--      (selesai maksimal 06:00); durasi = end+24h−start.
--   3. admin_create_overtime: aturan yang sama (mode hourly maupun fixed).
--   4. effective_checkout_deadline: dua agregat terpisah — slot sehari
--      (end > start, perilaku lama termasuk lembur pagi shift malam +1 hari)
--      dan slot lintas malam (end <= start → selalu selesai besok).
--      Trigger guard absen pulang & payroll otomatis ikut fungsi ini.
--   5. upsert_payroll_line: lembur lintas malam dianggap tuntas absen pulang
--      bila checkout ada di tanggal lembur ATAU tanggal berikutnya
--      (slot biasa tetap aturan lama: checkout di tanggal lembur).
--
-- review_overtime_request TIDAK diubah (memvalidasi jam dibayar, bukan
-- start/end; requested_hours sudah dihitung benar saat create).
-- overtime_approved_end TIDAK diubah (tidak lagi dipakai; digantikan query
-- langsung dua-agregat di dalam effective_checkout_deadline).
--
-- Idempoten: aman dijalankan berulang; gagal keras bila fragmen patch
-- payroll tidak ditemukan (pola migrasi payroll sebelumnya).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Constraint tabel: end_time <> start_time
-- ----------------------------------------------------------------------------
DO $constraint$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'overtime_requests_time_order'
      AND conrelid = 'public.overtime_requests'::regclass
  ) THEN
    EXECUTE 'ALTER TABLE public.overtime_requests DROP CONSTRAINT overtime_requests_time_order';
  END IF;
  EXECUTE 'ALTER TABLE public.overtime_requests ADD CONSTRAINT overtime_requests_time_order CHECK (end_time <> start_time)';
END;
$constraint$;

-- ----------------------------------------------------------------------------
-- 2. create_overtime_request — pegawai mengajukan lembur
--    (body = 20261019000000, hanya blok validasi menit yang berubah)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_overtime_request(
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
  -- Lintas tengah malam: selesai < mulai = berlanjut keesokan hari,
  -- dibatasi sampai jam 06:00 agar tidak tertukar dengan slot pagi biasa.
  IF v_end_min < v_start_min AND v_end_min > 360 THEN
    RETURN json_build_object('success', false, 'error', 'Lembur lintas tengah malam maksimal sampai jam 06:00');
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

  -- Pegawai biasa wajib punya jadwal kerja pada tanggal tsb (admin bebas)
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
    (organization_id, user_id, date, start_time, end_time, reason, requested_hours, requested_by)
  VALUES
    (v_org, auth.uid(), p_date, p_start_time, p_end_time, NULLIF(TRIM(COALESCE(p_reason, '')), ''), v_hours, auth.uid());

  RETURN json_build_object('success', true, 'message', 'Pengajuan lembur terkirim');
EXCEPTION WHEN unique_violation THEN
  RETURN json_build_object('success', false, 'error', 'Pengajuan lembur pada tanggal & jam itu sudah ada');
WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. admin_create_overtime — admin membuat lembur (langsung approved)
--    (body = 20261022020000, hanya blok validasi menit yang berubah)
-- ----------------------------------------------------------------------------
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
  v_dur_min INT;
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
  IF v_end_min = v_start_min THEN
    RETURN json_build_object('success', false, 'error', 'Jam selesai tidak boleh sama dengan jam mulai');
  END IF;
  IF v_end_min < v_start_min AND v_end_min > 360 THEN
    RETURN json_build_object('success', false, 'error', 'Lembur lintas tengah malam maksimal sampai jam 06:00');
  END IF;
  v_dur_min := CASE WHEN v_end_min < v_start_min
                    THEN (v_end_min + 1440) - v_start_min
                    ELSE v_end_min - v_start_min END;
  v_hours := ROUND((v_dur_min / 60.0)::numeric, 2);

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
-- 4. effective_checkout_deadline — batas absen pulang (dipakai trigger guard
--    absen pulang + payroll no_checkout). Dua agregat terpisah:
--      a. slot sehari (end > start): perilaku lama persis, termasuk geser
--         +1 hari untuk lembur pagi setelah shift malam;
--      b. slot lintas malam (end <= start): selalu selesai besok.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.effective_checkout_deadline(
  p_user        UUID,
  p_date        DATE,
  p_shift_start TIME,
  p_shift_end   TIME,
  p_crosses     BOOLEAN
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shift_end TIMESTAMPTZ;
  v_ot_plain  TIMESTAMPTZ;
  v_ot_cross  TIMESTAMPTZ;
  v_base      TIMESTAMPTZ;
BEGIN
  IF p_shift_end IS NULL THEN
    RETURN NULL;
  END IF;

  v_shift_end := ((p_date + p_shift_end) AT TIME ZONE 'Asia/Makassar');
  IF COALESCE(p_crosses, false)
     AND p_shift_start IS NOT NULL
     AND p_shift_end <= p_shift_start THEN
    v_shift_end := v_shift_end + INTERVAL '1 day';
  END IF;

  -- a. Slot lembur sehari (end > start) — berakhir pada tanggal lembur.
  SELECT MAX((p_date + ot.end_time::time) AT TIME ZONE 'Asia/Makassar')
    INTO v_ot_plain
  FROM overtime_requests ot
  WHERE ot.user_id = p_user
    AND ot.date = p_date
    AND ot.status = 'approved'
    AND ot.end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    AND ot.end_time::time > ot.start_time::time;

  -- Shift malam: lembur sehari yang selesai sebelum jam mulai shift
  -- (mis. 07:00–09:00) terjadi setelah tengah malam → geser satu hari
  -- (perilaku lama dipertahankan).
  IF v_ot_plain IS NOT NULL
     AND COALESCE(p_crosses, false)
     AND p_shift_start IS NOT NULL
     AND (v_ot_plain AT TIME ZONE 'Asia/Makassar')::time <= p_shift_start THEN
    v_ot_plain := v_ot_plain + INTERVAL '1 day';
  END IF;

  -- b. Slot lintas tengah malam (end <= start) — selesai besok.
  SELECT MAX(((p_date + ot.end_time::time) AT TIME ZONE 'Asia/Makassar') + INTERVAL '1 day')
    INTO v_ot_cross
  FROM overtime_requests ot
  WHERE ot.user_id = p_user
    AND ot.date = p_date
    AND ot.status = 'approved'
    AND ot.end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    AND ot.end_time::time <= ot.start_time::time;

  -- GREATEST mengabaikan NULL: bila tak ada lembur, kembali ke shift_end.
  v_base := GREATEST(v_shift_end, v_ot_plain, v_ot_cross);
  RETURN v_base + INTERVAL '1 hour';
END;
$$;

REVOKE ALL ON FUNCTION public.effective_checkout_deadline(uuid, date, time, time, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.effective_checkout_deadline(uuid, date, time, time, boolean) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5. upsert_payroll_line — lembur lintas malam tuntas bila absen pulang di
--    tanggal lembur ATAU tanggal berikutnya (slot biasa: aturan lama).
--    Pendekatan patch = migrasi 20261023000000: fragmen WAJIB ditemukan.
-- ----------------------------------------------------------------------------
DO $patch_ot_checkout$
DECLARE
  v_def TEXT;
  v_old TEXT := $q$    AND ot.status = 'approved'
    AND EXISTS (
      SELECT 1 FROM attendance ca
      WHERE ca.user_id = ot.user_id
        AND ca.date = ot.date
        AND ca.clock_out_time IS NOT NULL
    )
    AND ot.date >= v_start$q$;
  v_new TEXT := $q$    AND ot.status = 'approved'
    AND EXISTS (
      SELECT 1 FROM attendance ca
      WHERE ca.user_id = ot.user_id
        AND ca.clock_out_time IS NOT NULL
        AND ca.date = CASE WHEN ot.end_time::time <= ot.start_time::time
                           THEN ot.date + 1 ELSE ot.date END
    )
    AND ot.date >= v_start$q$;
BEGIN
  v_def := pg_get_functiondef('public.upsert_payroll_line(uuid,uuid,date,jsonb,uuid)'::regprocedure);

  IF position('ot.date + 1' IN v_def) > 0 THEN
    RAISE NOTICE 'upsert_payroll_line sudah lintas-malam aware — dilewati';
    RETURN;
  END IF;

  IF position(v_old IN v_def) = 0 THEN
    RAISE EXCEPTION 'Fragmen lembur tidak ditemukan pada upsert_payroll_line. Patch dibatalkan.';
  END IF;

  EXECUTE replace(v_def, v_old, v_new);
  RAISE NOTICE 'upsert_payroll_line: lembur lintas malam tuntas via checkout tanggal lembur atau besoknya';
END;
$patch_ot_checkout$;
