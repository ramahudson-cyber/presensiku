-- ============================================================
-- MIGRATION: Lembur pada hari tanpa jadwal (hari libur)
-- ============================================================
-- Masalah:
--   Pegawai hanya bisa absen bila punya baris employee_schedules pada
--   tanggal itu. Akibatnya lembur di hari libur (mis. Minggu) tidak bisa
--   dibuktikan kehadirannya:
--     1. create_overtime_request menolak pengajuan pegawai,
--     2. guard_attendance_self_write menolak absen masuk,
--     3. upsert_payroll_line mensyaratkan clock_out_time terisi,
--   sehingga uang lembur tidak pernah masuk slip gaji.
--
-- Solusi (jalur tanpa jadwal HANYA terbuka bila ada lembur approved):
--   1. create_overtime_request: pengajuan tidak lagi wajib punya jadwal.
--   2. guard INSERT: absen masuk diizinkan tanpa jadwal → baris attendance
--      dengan shift_code NULL, schedule_match=false, tanpa keterlambatan.
--   3. guard UPDATE: batas absen pulang baris tanpa jadwal = jam selesai
--      lembur + 1 jam.
--   4. upsert_payroll_line:
--        - baris absensi tanpa jadwal TIDAK dihitung sebagai hari hadir
--          (kalau dihitung, alpha hari kerja lain bisa tertutupi sehingga
--          potongan yang sah hilang),
--        - baris absensi tanpa jadwal TIDAK kena potongan "tidak absen
--          pulang" (hari libur tidak punya shift untuk dipulangkan).
--      Uang lembur sendiri otomatis masuk karena syaratnya "ada attendance
--      dengan clock_out_time pada tanggal lembur" sudah terpenuhi.
--
-- Tanpa jadwal DAN tanpa lembur approved: perilaku lama dipertahankan
-- (absen tetap ditolak). Jalur reguler tidak berubah.
--
-- Batasan: check-in dini hari (mis. 02:00) untuk lembur lintas tengah malam
-- yang dimulai hari sebelumnya tidak ditangani di sini — pegawai absen masuk
-- saat lembur dimulai. Kasus dini hari sudah tertangani untuk pegawai yang
-- punya jadwal shift malam lewat guard kontinuasi yang sudah ada.
--
-- Pendekatan patch mengikuti migrasi 20261022000000 / 20261025000000:
-- definisi AKTIF diambil dari katalog, fragmen WAJIB ditemukan, migrasi
-- GAGAL bila tidak ketemu (tidak pernah diam-diam tidak diterapkan).
-- Body fungsi dinormalkan dulu (\r dibuang) supaya pencocokan fragmen tidak
-- bergantung pada line ending file sumber migrasi sebelumnya.
-- Idempotent: patch yang sudah ada terdeteksi dan dilewati.
-- ============================================================

-- ----------------------------------------------------------------------------
-- 1. create_overtime_request — pengajuan pegawai tidak wajib punya jadwal
-- ----------------------------------------------------------------------------
DO $patch_ot_request$
DECLARE
  v_def TEXT;
  v_old TEXT := $q$  IF NOT EXISTS (
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
  END IF;$q$;
  v_new TEXT := $q$  -- Lembur boleh diajukan pada hari tanpa jadwal (hari libur).
  -- Kehadiran tetap wajib dibuktikan lewat absen masuk & pulang agar uang
  -- lembur dihitung payroll; persetujuan tetap di tangan admin.
  NULL;$q$;
  v_marker TEXT := 'Lembur boleh diajukan pada hari tanpa jadwal';
BEGIN
  v_def := replace(pg_get_functiondef('public.create_overtime_request(date,text,text,text,text)'::regprocedure), chr(13), '');

  IF position(v_marker IN v_def) > 0 THEN
    RAISE NOTICE 'create_overtime_request sudah mengizinkan hari tanpa jadwal — dilewati';
    RETURN;
  END IF;

  IF position(v_old IN v_def) = 0 THEN
    RAISE EXCEPTION 'Fragmen syarat jadwal pada create_overtime_request tidak ditemukan. Patch dibatalkan.';
  END IF;

  EXECUTE replace(v_def, v_old, v_new);
  RAISE NOTICE 'create_overtime_request: pengajuan lembur tidak lagi wajib punya jadwal';
END;
$patch_ot_request$;

-- ----------------------------------------------------------------------------
-- 2. guard_attendance_self_write — absen lembur tanpa jadwal
-- ----------------------------------------------------------------------------
DO $patch_guard$
DECLARE
  v_def TEXT;

  -- Cabang INSERT dicocokkan dengan regexp agar tidak bergantung pada teks
  -- pesan (mengandung em dash) maupun spasi/indentasi persis.
  v_ins_pat TEXT := $r$IF v_shift IS NULL THEN\s+RAISE EXCEPTION 'Tidak ada jadwal kerja hari ini[^']*';\s+END IF;\s+NEW\.shift_code := v_shift;$r$;
  v_ins_new TEXT := $q$IF v_shift IS NULL THEN
      -- Tanpa jadwal: hanya boleh absen bila ada lembur approved pada
      -- tanggal ini (hari libur). Kehadiran jadi bukti untuk uang lembur.
      IF NOT EXISTS (
        SELECT 1 FROM overtime_requests ot
        WHERE ot.user_id = NEW.user_id
          AND ot.date = v_date
          AND ot.status = 'approved'
      ) THEN
        RAISE EXCEPTION 'Tidak ada jadwal kerja hari ini';
      END IF;

      -- Baris absensi lembur: shift_code NULL menandai "tanpa jadwal"
      -- (dipakai payroll agar tidak menggeser hitungan alpha hari kerja).
      NEW.shift_code        := NULL;
      NEW.schedule_match    := false;
      NEW.is_late           := false;
      NEW.late_minutes      := 0;
      NEW.attendance_status := 'hadir';
      NEW.clock_out_time    := NULL;
      NEW.location_in       := assert_within_radius(NEW.location_in);
      RETURN NEW;
    END IF;
    NEW.shift_code := v_shift;$q$;
  v_ins_marker TEXT := 'Baris absensi lembur: shift_code NULL';

  -- Cabang UPDATE: batas absen pulang untuk baris tanpa jadwal.
  v_upd_old TEXT := $q$    IF v_start IS NOT NULL AND v_end IS NOT NULL THEN
      v_end_at := OLD.date + v_end;$q$;
  v_upd_new TEXT := $q$    IF OLD.shift_code IS NULL THEN
      -- Absensi lembur tanpa jadwal: batas pulang = jam selesai lembur + 1 jam.
      -- (v_wita AT TIME ZONE ...) dipakai agar perbandingan tidak bergantung
      -- pada timezone sesi — pola sama dengan patch deadline sebelumnya.
      IF (v_wita AT TIME ZONE 'Asia/Makassar') > COALESCE((
           SELECT MAX(((OLD.date + ot.end_time::time) AT TIME ZONE 'Asia/Makassar')
                      + CASE WHEN ot.end_time::time <= ot.start_time::time
                             THEN INTERVAL '1 day' ELSE INTERVAL '0 minutes' END)
           FROM overtime_requests ot
           WHERE ot.user_id = OLD.user_id
             AND ot.date = OLD.date
             AND ot.status = 'approved'
             AND ot.end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
             AND ot.start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
         ), ((OLD.date + TIME '23:59') AT TIME ZONE 'Asia/Makassar'))
         + INTERVAL '1 hour' THEN
        RAISE EXCEPTION 'Batas absen pulang lembur sudah lewat';
      END IF;
    ELSIF v_start IS NOT NULL AND v_end IS NOT NULL THEN
      v_end_at := OLD.date + v_end;$q$;
  v_upd_marker TEXT := 'Batas absen pulang lembur sudah lewat';
BEGIN
  v_def := replace(pg_get_functiondef('public.guard_attendance_self_write()'::regprocedure), chr(13), '');

  -- 2a. Cabang INSERT (regexp: toleran spasi & pesan)
  IF position(v_ins_marker IN v_def) = 0 THEN
    v_def := regexp_replace(v_def, v_ins_pat, v_ins_new);
    IF position(v_ins_marker IN v_def) = 0 THEN
      RAISE EXCEPTION 'Fragmen INSERT guard tidak ditemukan. Patch dibatalkan.';
    END IF;
    RAISE NOTICE 'guard: absen masuk lembur tanpa jadwal diizinkan';
  ELSE
    RAISE NOTICE 'guard: cabang INSERT sudah dipatch — dilewati';
  END IF;

  -- 2b. Cabang UPDATE
  IF position(v_upd_marker IN v_def) = 0 THEN
    IF position(v_upd_old IN v_def) = 0 THEN
      RAISE EXCEPTION 'Fragmen UPDATE guard tidak ditemukan. Patch dibatalkan.';
    END IF;
    v_def := replace(v_def, v_upd_old, v_upd_new);
    RAISE NOTICE 'guard: batas absen pulang lembur tanpa jadwal diterapkan';
  ELSE
    RAISE NOTICE 'guard: cabang UPDATE sudah dipatch — dilewati';
  END IF;

  EXECUTE v_def;
END;
$patch_guard$;

-- ----------------------------------------------------------------------------
-- 3. upsert_payroll_line — jangan kotori hitungan hari kerja / potongan
-- ----------------------------------------------------------------------------
DO $patch_payroll$
DECLARE
  v_def TEXT;

  -- 3a. SELECT perlu membawa shift_code agar baris lembur bisa dikenali.
  v_sel_old TEXT := $q$    SELECT a.date, a.attendance_status, a.is_late, a.late_minutes,$q$;
  v_sel_new TEXT := $q$    SELECT a.date, a.shift_code, a.attendance_status, a.is_late, a.late_minutes,$q$;
  v_sel_marker TEXT := 'SELECT a.date, a.shift_code, a.attendance_status';

  -- 3b. Baris tanpa jadwal bukan hari kerja → jangan dihitung hadir.
  v_hadir_old TEXT := $q$    IF v_att.attendance_status IN ('hadir','terlambat') THEN
      v_hadir := v_hadir + 1;
    ELSIF v_att.attendance_status = 'izin' THEN$q$;
  v_hadir_new TEXT := $q$    IF v_att.attendance_status IN ('hadir','terlambat')
       AND v_att.shift_code IS NOT NULL THEN
      v_hadir := v_hadir + 1;
    ELSIF v_att.attendance_status IN ('hadir','terlambat') THEN
      -- Absensi lembur di hari tanpa jadwal: bukan hari kerja. Uang
      -- lemburnya dihitung terpisah, jadi tidak menambah hitungan hadir.
      NULL;
    ELSIF v_att.attendance_status = 'izin' THEN$q$;
  v_hadir_marker TEXT := 'Absensi lembur di hari tanpa jadwal';

  -- 3c. Tanpa shift tidak ada yang bisa "lupa absen pulang".
  v_nc_old TEXT := $q$       AND v_att.clock_out_time IS NULL
       AND COALESCE(v_att.notes, '') NOT ILIKE '%dikoreksi via sanggahan%'$q$;
  v_nc_new TEXT := $q$       AND v_att.clock_out_time IS NULL
       -- Lembur tanpa jadwal: tidak ada shift, jadi tidak ada pulang shift.
       AND v_att.shift_code IS NOT NULL
       AND COALESCE(v_att.notes, '') NOT ILIKE '%dikoreksi via sanggahan%'$q$;
  v_nc_marker TEXT := 'tidak ada shift, jadi tidak ada pulang shift';
BEGIN
  v_def := replace(pg_get_functiondef('public.upsert_payroll_line(uuid,uuid,date,jsonb,uuid)'::regprocedure), chr(13), '');

  -- 3a. Tambah a.shift_code ke SELECT (sekali saja)
  IF position(v_sel_marker IN v_def) = 0 THEN
    IF position(v_sel_old IN v_def) = 0 THEN
      RAISE EXCEPTION 'Fragmen SELECT attendance payroll tidak ditemukan. Patch dibatalkan.';
    END IF;
    v_def := replace(v_def, v_sel_old, v_sel_new);
    RAISE NOTICE 'upsert_payroll_line: SELECT membawa shift_code';
  END IF;

  -- 3b. Hitungan hadir
  IF position(v_hadir_marker IN v_def) = 0 THEN
    IF position(v_hadir_old IN v_def) = 0 THEN
      RAISE EXCEPTION 'Fragmen hitungan hadir payroll tidak ditemukan. Patch dibatalkan.';
    END IF;
    v_def := replace(v_def, v_hadir_old, v_hadir_new);
    RAISE NOTICE 'upsert_payroll_line: absensi lembur tanpa jadwal tidak dihitung hadir';
  ELSE
    RAISE NOTICE 'upsert_payroll_line: hitungan hadir sudah dipatch — dilewati';
  END IF;

  -- 3c. Potongan no_checkout
  IF position(v_nc_marker IN v_def) = 0 THEN
    IF position(v_nc_old IN v_def) = 0 THEN
      RAISE EXCEPTION 'Fragmen no_checkout payroll tidak ditemukan. Patch dibatalkan.';
    END IF;
    v_def := replace(v_def, v_nc_old, v_nc_new);
    RAISE NOTICE 'upsert_payroll_line: potongan no_checkout hanya untuk baris berjadwal';
  ELSE
    RAISE NOTICE 'upsert_payroll_line: potongan no_checkout sudah dipatch — dilewati';
  END IF;

  EXECUTE v_def;
END;
$patch_payroll$;

-- ----------------------------------------------------------------------------
-- 4. Hitung ulang slip DRAFT yang punya baris absensi tanpa jadwal (lembur
--    hari libur), agar hitungan hadir & potongan no_checkout ikut benar.
--    Slip lain dan slip final tidak disentuh.
-- ----------------------------------------------------------------------------
DO $recalc$
DECLARE
  r RECORD;
  v_cfg JSONB;
BEGIN
  FOR r IN
    SELECT DISTINCT pl.organization_id, pl.user_id, pl.period_month, pl.generated_by
    FROM payroll_lines pl
    WHERE pl.status = 'draft'
      AND EXISTS (
        SELECT 1 FROM attendance a
        WHERE a.user_id = pl.user_id
          AND a.shift_code IS NULL
          AND a.date >= (pl.period_month::date)
          AND a.date <  (pl.period_month::date + INTERVAL '1 month')
      )
  LOOP
    SELECT value::jsonb INTO v_cfg
    FROM system_settings
    WHERE organization_id = r.organization_id AND setting_key = 'payroll_config'
    LIMIT 1;
    IF v_cfg IS NULL THEN
      CONTINUE;
    END IF;
    PERFORM upsert_payroll_line(r.organization_id, r.user_id, r.period_month, v_cfg, r.generated_by);
  END LOOP;
  RAISE NOTICE 'Slip DRAFT dengan absensi lembur tanpa jadwal dihitung ulang';
END;
$recalc$;

NOTIFY pgrst, 'reload schema';
