-- ============================================================================
-- ADMIN: BATALKAN LEMBUR YANG SUDAH DISETUJUI
-- ============================================================================
-- Lembur berstatus approved (dibuat admin via admin_create_overtime atau
-- disetujui lewat review_overtime_request) sebelumnya tidak punya aksi apa
-- pun — salah input jam/pegawai tidak bisa diperbaiki. RPC ini menghapus
-- slot lembur approved dan mengoreksi slip gaji DRAFT yang terpengaruh.
--
-- Efek pembatalan (semuanya otomatis dari desain yang sudah ada):
--   - Batas absen pulang kembali normal: effective_checkout_deadline()
--     membaca overtime_requests live, slot hilang = jam selesai lembur
--     tidak lagi diperhitungkan (trigger guard & payroll ikut).
--   - Slip DRAFT bulan lembur yang memuat overtime_amount dihitung ulang
--     via upsert_payroll_line (pola recalc 20261023000000). Slip FINAL
--     tidak disentuh.
--   - Slot (user, date, start_time) bebas dipakai pengajuan ulang.
--
-- Pegawai tetap hanya bisa membatalkan miliknya yang pending
-- (cancel_overtime_request, tidak diubah).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_cancel_overtime(p_request_id UUID)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req overtime_requests%ROWTYPE;
  v_org UUID := current_org_id();
  v_cfg JSONB;
  v_gen UUID;
  v_month DATE;
BEGIN
  IF NOT is_org_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Hanya admin yang dapat membatalkan lembur');
  END IF;

  SELECT * INTO v_req FROM overtime_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Lembur tidak ditemukan');
  END IF;
  IF v_req.organization_id <> v_org AND NOT is_platform_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Lembur bukan dari instansi Anda');
  END IF;
  IF v_req.status <> 'approved' THEN
    RETURN json_build_object('success', false, 'error',
      'Hanya lembur berstatus Disetujui yang dapat dibatalkan');
  END IF;

  v_month := date_trunc('month', v_req.date)::date;

  DELETE FROM overtime_requests WHERE id = p_request_id;

  -- Koreksi slip DRAFT yang memuat uang lembur bulan lembur tsb.
  -- (Slip final tidak disentuh — koreksi manual bila sudah difinalkan.)
  IF EXISTS (
    SELECT 1 FROM payroll_lines
    WHERE user_id = v_req.user_id
      AND period_month = v_month
      AND status = 'draft'
      AND overtime_amount > 0
  ) THEN
    SELECT value::jsonb INTO v_cfg
    FROM system_settings
    WHERE organization_id = v_req.organization_id AND setting_key = 'payroll_config'
    LIMIT 1;

    IF v_cfg IS NOT NULL THEN
      SELECT generated_by INTO v_gen
      FROM payroll_lines
      WHERE user_id = v_req.user_id
        AND period_month = v_month
        AND status = 'draft'
      ORDER BY generated_at DESC
      LIMIT 1;

      PERFORM upsert_payroll_line(v_req.organization_id, v_req.user_id, v_month, v_cfg, COALESCE(v_gen, v_req.approved_by));
    END IF;
  END IF;

  RETURN json_build_object('success', true, 'message', 'Lembur dibatalkan');
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_cancel_overtime(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_cancel_overtime(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
