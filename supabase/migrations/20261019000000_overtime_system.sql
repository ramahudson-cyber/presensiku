-- ============================================================
-- MIGRATION: Sistem Lembur (overtime) + uang lembur custom
-- ============================================================
-- Aditif: tidak mengubah tabel/kolom yang ada. Idempotent.
--
-- Alur:
--   1. Pegawai mengajukan lembur (tanggal, jam, alasan) ATAU admin
--      langsung membuatkan lembur untuk pegawai (langsung approved).
--   2. Admin setujui (jam dibayar bisa diubah sebelum setuju) atau
--      tolak dengan alasan.
--   3. pay_amount = approved_hours × pay_rate_per_hour DIHITUNG DI
--      SERVER saat approve — klien tidak bisa menulis angka uang.
--   4. Angka dikunci saat disetujui: perubahan tarif kemudian tidak
--      merusak lembur lama.
--
-- Settings per instansi (system_settings, dibaca dengan default):
--   overtime_rate_per_hour      : tarif lembur per jam (rupiah)
--   overtime_min_minutes        : durasi minimal dihitung (default 30)
--   overtime_max_hours_per_day  : batas jam lembur per hari (default 4)
-- ============================================================

-- ----------------------------------------------------------------------------
-- 1. Tabel overtime_requests
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.overtime_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  reason TEXT,
  requested_hours NUMERIC(5,2) NOT NULL,
  approved_hours NUMERIC(5,2),
  pay_rate_per_hour NUMERIC(12,2),
  pay_amount NUMERIC(14,2),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT overtime_requests_time_order CHECK (end_time > start_time),
  CONSTRAINT overtime_requests_hours_positive
    CHECK (requested_hours > 0 AND requested_hours <= 24),
  CONSTRAINT overtime_requests_approved_hours_positive
    CHECK (approved_hours IS NULL OR (approved_hours > 0 AND approved_hours <= 24))
);

-- Anti dobel: satu pegawai satu slot (tanggal + jam mulai) hanya boleh sekali
-- apapun statusnya. Pagar sesungguhnya; RPC juga mengecek defensif.
CREATE UNIQUE INDEX IF NOT EXISTS overtime_requests_unique_slot
  ON public.overtime_requests(user_id, date, start_time);

CREATE INDEX IF NOT EXISTS idx_overtime_org_date
  ON public.overtime_requests(organization_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_overtime_user_date
  ON public.overtime_requests(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_overtime_pending
  ON public.overtime_requests(organization_id) WHERE status = 'pending';

-- ----------------------------------------------------------------------------
-- 2. Helper: baca setting lembur per instansi (pola attendance_setting)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.overtime_setting(p_key TEXT, p_default TEXT DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v TEXT;
BEGIN
  SELECT value INTO v FROM system_settings
  WHERE organization_id = current_org_id() AND setting_key = p_key
  LIMIT 1;
  RETURN COALESCE(v, p_default);
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. RPC: pegawai mengajukan lembur
--    Validasi: format jam, durasi >= min & <= maks dari settings, tanggal
--    ±30 hari, punya jadwal kerja (pegawai biasa), slot belum terpakai.
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
  IF v_end_min <= v_start_min THEN
    RETURN json_build_object('success', false, 'error', 'Jam selesai harus setelah jam mulai');
  END IF;
  v_hours := ROUND(((v_end_min - v_start_min) / 60.0)::numeric, 2);

  v_min_minutes := COALESCE(NULLIF(overtime_setting('overtime_min_minutes', '30'), '')::int, 30);
  v_max_hours   := COALESCE(NULLIF(overtime_setting('overtime_max_hours_per_day', '4'), '')::numeric, 4);

  IF (v_end_min - v_start_min) < v_min_minutes THEN
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
-- 4. RPC: admin membuatkan lembur untuk pegawai (langsung approved).
--    Uang dihitung server dari tarif setting saat itu.
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

  v_rate := COALESCE(NULLIF(overtime_setting('overtime_rate_per_hour', '0'), '')::numeric, 0);

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
-- 5. RPC: admin menyetujui / menolak pengajuan.
--    approve: p_hours = jam dibayar (NULL = sesuai pengajuan). Tarif dibaca
--    dari setting saat itu; pay_amount dihitung & DIKUNCI di sini.
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
    v_rate := COALESCE(NULLIF(overtime_setting('overtime_rate_per_hour', '0'), '')::numeric, 0);

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

-- ----------------------------------------------------------------------------
-- 6. RPC: pegawai membatalkan pengajuan sendiri (masih pending)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_overtime_request(p_request_id UUID)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req overtime_requests%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Tidak terautentikasi');
  END IF;

  SELECT * INTO v_req FROM overtime_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Pengajuan tidak ditemukan');
  END IF;
  IF v_req.user_id <> auth.uid() THEN
    RETURN json_build_object('success', false, 'error', 'Bukan pengajuan Anda');
  END IF;
  IF v_req.status <> 'pending' THEN
    RETURN json_build_object('success', false, 'error', 'Pengajuan sudah diproses');
  END IF;

  DELETE FROM overtime_requests WHERE id = p_request_id;
  RETURN json_build_object('success', true, 'message', 'Pengajuan dibatalkan');
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. GRANT eksekusi (tulis hanya via RPC — tidak ada policy INSERT/UPDATE/DELETE)
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.overtime_setting(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_overtime_request(date, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_overtime_request(date, text, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_create_overtime(uuid, date, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_overtime(uuid, date, text, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.review_overtime_request(uuid, text, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_overtime_request(uuid, text, numeric, text) TO authenticated;
REVOKE ALL ON FUNCTION public.cancel_overtime_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_overtime_request(uuid) TO authenticated;

GRANT SELECT ON public.overtime_requests TO authenticated;

-- ----------------------------------------------------------------------------
-- 8. RLS: baca milik sendiri + admin instansi. Tulis HANYA via RPC.
-- ----------------------------------------------------------------------------
ALTER TABLE public.overtime_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS overtime_select_own ON public.overtime_requests;
CREATE POLICY overtime_select_own ON public.overtime_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS overtime_select_org ON public.overtime_requests;
CREATE POLICY overtime_select_org ON public.overtime_requests
  FOR SELECT TO authenticated
  USING (is_org_admin() AND organization_id = current_org_id());

NOTIFY pgrst, 'reload schema';
