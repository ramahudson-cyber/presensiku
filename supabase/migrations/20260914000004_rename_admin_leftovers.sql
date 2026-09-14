-- =====================================================================
-- RENAME ROLE (lanjutan): ganti literal di function lama + policy yatim
-- Migrasi 000003 menulis ulang 4 function tapi UPDATE pg_proc langsung
-- gagal diam-diam (prosrc katalog tak bisa ditulis begitu). Blok ini
-- me-recreate 4 function dengan definisi yang SAMA PERSIS kecuali
-- literal 'admin_puskesmas' -> 'admin'. Diambil dari prosrc live
-- (dibaca via supabase db query, 2026-09-14) + policy yatim di-drop.
-- Idempotent (aman diulang).
-- =====================================================================

-- 1. assign_shift: guard role admin
CREATE OR REPLACE FUNCTION assign_shift(
  p_user_id UUID, p_shift_code TEXT, p_work_date DATE, p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_schedule_id UUID;
  v_assigner_id UUID := auth.uid();
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_assigner_id
    AND role IN ('super_admin', 'admin')
  ) THEN
    RAISE EXCEPTION 'Akses ditolak. Hanya admin yang bisa assign shift.';
  END IF;

  INSERT INTO public.schedules (user_id, shift_code, work_date, notes, created_by)
  VALUES (p_user_id, p_shift_code, p_work_date, p_notes, v_assigner_id)
  ON CONFLICT (user_id, work_date)
  DO UPDATE SET
    shift_code = EXCLUDED.shift_code,
    notes = EXCLUDED.notes,
    created_by = v_assigner_id
  RETURNING id INTO v_schedule_id;

  PERFORM public.log_audit(
    'ASSIGN_SHIFT',
    'Assign shift ' || p_shift_code || ' untuk user ' || p_user_id::text,
    'schedules', v_schedule_id
  );

  RETURN v_schedule_id;
END;
$$;

-- 2. approve_leave_request_impl: guard role admin
CREATE OR REPLACE FUNCTION approve_leave_request_impl(p_request_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $function$
DECLARE
  v_request RECORD;
  v_role TEXT;
  v_created INT := 0;
  v_skipped INT := 0;
  v_day DATE;
BEGIN
  SELECT role::TEXT INTO v_role FROM profiles WHERE id = auth.uid();
  IF v_role IS NULL OR v_role NOT IN ('super_admin', 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Akses ditolak');
  END IF;

  SELECT * INTO v_request FROM leave_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Permohonan tidak ditemukan');
  END IF;
  IF v_request.status <> 'pending' THEN
    RETURN json_build_object('success', false, 'error', 'Permohonan sudah diproses');
  END IF;

  FOR v_day IN
    SELECT generate_series(v_request.start_date, v_request.end_date, INTERVAL '1 day')::DATE
  LOOP
    IF EXISTS (
      SELECT 1 FROM attendance WHERE user_id = v_request.user_id AND date = v_day
    ) THEN
      v_skipped := v_skipped + 1;
    ELSE
      INSERT INTO attendance (user_id, date, attendance_status, schedule_match, is_late, late_minutes, notes)
      VALUES (v_request.user_id, v_day, v_request.leave_type, false, false, 0,
              'Auto dari permohonan ' || v_request.leave_type);
      v_created := v_created + 1;
    END IF;
  END LOOP;

  UPDATE leave_requests
  SET status = 'approved', approved_by = auth.uid(), approved_at = NOW(), rejection_reason = NULL, updated_at = NOW()
  WHERE id = p_request_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Permohonan disetujui',
    'created', v_created,
    'skipped', v_skipped
  );
END;
$function$;

-- 3. reject_leave_request_impl: guard role admin
CREATE OR REPLACE FUNCTION reject_leave_request_impl(p_request_id uuid, p_reason text DEFAULT NULL::text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $function$
DECLARE
  v_role TEXT;
  v_status TEXT;
BEGIN
  SELECT role::TEXT INTO v_role FROM profiles WHERE id = auth.uid();
  IF v_role IS NULL OR v_role NOT IN ('super_admin', 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Akses ditolak');
  END IF;

  SELECT status INTO v_status FROM leave_requests WHERE id = p_request_id;
  IF v_status IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Permohonan tidak ditemukan');
  END IF;
  IF v_status <> 'pending' THEN
    RETURN json_build_object('success', false, 'error', 'Permohonan sudah diproses');
  END IF;

  UPDATE leave_requests
  SET status = 'rejected', rejection_reason = p_reason, approved_by = auth.uid(), approved_at = NOW(), updated_at = NOW()
  WHERE id = p_request_id;

  RETURN json_build_object('success', true, 'message', 'Permohonan ditolak');
END;
$function$;

-- 4. create_organization_with_admin: sinkronkan file repo 000004
--    (sudah applied di remote — edit ini hanya untuk catatan; yang live
--    di-patch via blok DO di bawah agar konsisten dengan riwayat push).
DO $$ DECLARE src TEXT; BEGIN
  SELECT pg_get_functiondef(oid) INTO src FROM pg_proc
  WHERE proname = 'create_organization_with_admin';
  IF src IS NULL THEN RAISE NOTICE 'create_organization_with_admin tidak ada, lewati'; RETURN; END IF;
  src := REPLACE(src, '''admin_puskesmas''::user_role', '''admin''::user_role');
  src := REPLACE(src, 'CREATE OR REPLACE FUNCTION public.', 'CREATE OR REPLACE FUNCTION ');
  EXECUTE src;
END $$;

-- 5. Policy yatim tabel schedules lama (0 baris, app tak pakai):
--    ganti literal agar admin baru tetap bisa kelola bila dipakai lagi.
DROP POLICY IF EXISTS "Admin manage schedules" ON schedules;
CREATE POLICY "Admin manage schedules" ON schedules FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role = ANY (ARRAY['super_admin'::user_role, 'admin'::user_role])));
DROP POLICY IF EXISTS "Users read own schedules" ON schedules;
CREATE POLICY "Users read own schedules" ON schedules FOR SELECT
  TO authenticated
  USING ((user_id = auth.uid()) OR (EXISTS (SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role = ANY (ARRAY['super_admin'::user_role, 'admin'::user_role, 'kepala_unit'::user_role]))));

-- 3. Policy yatim bucket selfies: ganti literal.
DROP POLICY IF EXISTS "Admin can view all selfies" ON storage.objects;
CREATE POLICY "Admin can view all selfies" ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'selfies' AND (EXISTS (SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = ANY (ARRAY['super_admin'::user_role, 'admin'::user_role, 'kepala_unit'::user_role]))));
