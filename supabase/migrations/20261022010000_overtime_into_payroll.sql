-- ============================================================
-- MIGRATION: Uang lembur masuk ke Total Diterima (payroll)
-- ============================================================
-- Sebelumnya:
--   total_received = GREATEST(gaji_pokok - total_potongan, 0)
--   Uang lembur hanya tampil sebagai komponen "+" terpisah di rekap/slip,
--   TIDAK ikut dijumlahkan ke angka DITERIMA.
--
-- Sesudahnya:
--   total_received = GREATEST(gaji_pokok - total_potongan, 0) + uang_lembur
--   dengan uang_lembur = SUM(pay_amount) lembur status 'approved' pada bulan
--   periode tersebut. pay_amount sudah dikunci saat approve (snapshot tarif),
--   sehingga perubahan tarif di kemudian hari tidak mengubah slip lama.
--
-- Kolom baru disimpan di payroll_lines agar slip bersifat snapshot:
--   overtime_hours  NUMERIC(6,2)  DEFAULT 0
--   overtime_amount NUMERIC(14,2) DEFAULT 0
--
-- Pendekatan patch (aman):
--   Body upsert_payroll_line diambil dari katalog (pg_get_functiondef),
--   lalu 5 fragmen diganti satu per satu. Setiap fragmen WAJIB ditemukan;
--   bila tidak, migrasi gagal dengan pesan jelas (tidak pernah diam-diam
--   tidak diterapkan). Idempotent: patch yang sudah ada dilewati.
-- ============================================================

-- ----------------------------------------------------------------------------
-- 1. Kolom snapshot lembur pada payroll_lines
-- ----------------------------------------------------------------------------
ALTER TABLE public.payroll_lines
  ADD COLUMN IF NOT EXISTS overtime_hours  NUMERIC(6,2)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overtime_amount NUMERIC(14,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.payroll_lines.overtime_hours IS
  'Total jam lembur disetujui pada periode ini (snapshot saat slip dihitung)';
COMMENT ON COLUMN public.payroll_lines.overtime_amount IS
  'Total uang lembur disetujui pada periode ini, sudah termasuk dalam total_received';

-- ----------------------------------------------------------------------------
-- 2. Patch upsert_payroll_line
-- ----------------------------------------------------------------------------
DO $patch_payroll_ot$
DECLARE
  v_def TEXT;
  v_frag TEXT[][] := ARRAY[
    -- [1] deklarasi variabel
    ARRAY[
      $q$  v_received NUMERIC(14,2);
  v_details JSONB := '[]'::jsonb;$q$,
      $q$  v_received NUMERIC(14,2);
  v_ot_hours NUMERIC(6,2) := 0;
  v_ot_amount NUMERIC(14,2) := 0;
  v_details JSONB := '[]'::jsonb;$q$
    ],
    -- [2] hitung lembur + rumus penerimaan
    ARRAY[
      $q$  v_received := GREATEST(v_base - v_total_cut, 0);$q$,
      $q$  -- Lembur DISETUJUI menambah penerimaan. pay_amount sudah dikunci
  -- saat approve (snapshot tarif), jadi tarif baru tidak mengubah slip lama.
  SELECT COALESCE(SUM(ot.approved_hours), 0), COALESCE(SUM(ot.pay_amount), 0)
    INTO v_ot_hours, v_ot_amount
  FROM overtime_requests ot
  WHERE ot.user_id = p_user
    AND ot.organization_id = p_org
    AND ot.status = 'approved'
    AND ot.date >= v_start
    AND ot.date <= v_end;

  v_received := GREATEST(v_base - v_total_cut, 0) + v_ot_amount;$q$
    ],
    -- [3] daftar kolom INSERT
    ARRAY[
      $q$    daily_rate, late_deduction, alpha_deduction, total_deduction, total_received,
    config_snapshot, details, status, generated_by, generated_at$q$,
      $q$    daily_rate, late_deduction, alpha_deduction, total_deduction,
    overtime_hours, overtime_amount, total_received,
    config_snapshot, details, status, generated_by, generated_at$q$
    ],
    -- [4] daftar nilai INSERT
    ARRAY[
      $q$    v_daily, v_late_cut, v_alpha_cut, v_total_cut, v_received,
    p_cfg, v_details, 'draft', p_generated_by, NOW()$q$,
      $q$    v_daily, v_late_cut, v_alpha_cut, v_total_cut,
    v_ot_hours, v_ot_amount, v_received,
    p_cfg, v_details, 'draft', p_generated_by, NOW()$q$
    ],
    -- [5] klausa ON CONFLICT
    ARRAY[
      $q$    total_deduction = EXCLUDED.total_deduction,
    total_received = EXCLUDED.total_received,$q$,
      $q$    total_deduction = EXCLUDED.total_deduction,
    overtime_hours = EXCLUDED.overtime_hours,
    overtime_amount = EXCLUDED.overtime_amount,
    total_received = EXCLUDED.total_received,$q$
    ]
  ];
  i INT;
BEGIN
  v_def := pg_get_functiondef('public.upsert_payroll_line(uuid,uuid,date,jsonb,uuid)'::regprocedure);

  IF position('v_ot_amount NUMERIC(14,2) := 0;' IN v_def) > 0 THEN
    RAISE NOTICE 'upsert_payroll_line sudah memasukkan lembur — dilewati';
    RETURN;
  END IF;

  FOR i IN 1 .. array_length(v_frag, 1) LOOP
    IF position(v_frag[i][1] IN v_def) = 0 THEN
      RAISE EXCEPTION 'Fragmen % tidak ditemukan pada upsert_payroll_line. Patch dibatalkan.', i;
    END IF;
    v_def := replace(v_def, v_frag[i][1], v_frag[i][2]);
  END LOOP;

  EXECUTE v_def;
  RAISE NOTICE 'upsert_payroll_line: lembur masuk total_received';
END;
$patch_payroll_ot$;

-- ----------------------------------------------------------------------------
-- 3. Backfill slip yang sudah ada (agar angka lama ikut terkoreksi)
--    total_received dihitung ulang dari base - potongan + lembur approved.
-- ----------------------------------------------------------------------------
UPDATE public.payroll_lines pl
SET
  overtime_hours  = COALESCE(ot.hours, 0),
  overtime_amount = COALESCE(ot.amount, 0),
  total_received  = GREATEST(pl.base_component - pl.total_deduction, 0) + COALESCE(ot.amount, 0)
FROM (
  SELECT user_id,
         organization_id,
         date_trunc('month', date)::date AS period,
         SUM(COALESCE(approved_hours, 0)) AS hours,
         SUM(COALESCE(pay_amount, 0))     AS amount
  FROM public.overtime_requests
  WHERE status = 'approved'
  GROUP BY 1, 2, 3
) ot
WHERE pl.user_id = ot.user_id
  AND pl.organization_id = ot.organization_id
  AND pl.period_month = ot.period;

-- ----------------------------------------------------------------------------
-- 4. Trigger: begitu lembur DISETUJUI, slip bulan itu langsung dihitung ulang
--    agar uang lembur segera tampil di Total Diterima.
--    Best-effort: kegagalan refresh tidak boleh menggagalkan approval.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_payroll_after_overtime()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cfg    JSONB;
  v_org    UUID;
  v_user   UUID;
  v_period DATE;
BEGIN
  IF NEW.status <> 'approved' THEN
    RETURN NEW;
  END IF;

  v_org := NEW.organization_id;
  v_user := NEW.user_id;
  v_period := date_trunc('month', NEW.date)::date;

  -- Hanya refresh bila modul payroll dikonfigurasi untuk instansi ini.
  SELECT value::jsonb INTO v_cfg
  FROM system_settings
  WHERE organization_id = v_org AND setting_key = 'payroll_config'
  LIMIT 1;
  IF v_cfg IS NULL THEN
    RETURN NEW;
  END IF;

  -- Hanya bila pegawai punya config gaji aktif.
  IF NOT EXISTS (
    SELECT 1 FROM payroll_employee_config
    WHERE organization_id = v_org AND user_id = v_user AND is_active
  ) THEN
    RETURN NEW;
  END IF;

  PERFORM upsert_payroll_line(v_org, v_user, v_period, v_cfg, auth.uid());
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Jangan gagalkan approval lembur karena masalah payroll.
  RAISE WARNING 'Refresh payroll setelah lembur gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_overtime_refresh_payroll ON public.overtime_requests;
CREATE TRIGGER trg_overtime_refresh_payroll
  AFTER INSERT OR UPDATE OF status ON public.overtime_requests
  FOR EACH ROW
  WHEN (NEW.status = 'approved')
  EXECUTE FUNCTION public.refresh_payroll_after_overtime();

NOTIFY pgrst, 'reload schema';
