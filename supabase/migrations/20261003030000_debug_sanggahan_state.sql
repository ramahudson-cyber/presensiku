-- SEMENTARA (diagnosis): baca baris sanggahan terbaru + attendance terkait
CREATE OR REPLACE FUNCTION public.debug_sanggahan_state()
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'wita_now', to_char(now() AT TIME ZONE 'Asia/Makassar', 'YYYY-MM-DD HH24:MI:SS'),
    'sanggahan_rows', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', s.id,
        'pegawai', p.full_name,
        'tanggal', s.tanggal,
        'status', s.status,
        'old_status', s.old_status,
        'reason', s.reason,
        'attendance_id', s.attendance_id,
        'reviewed_by', s.reviewed_by,
        'created_at', s.created_at
      ) ORDER BY s.created_at DESC), '[]')
      FROM sanggahan s
      LEFT JOIN profiles p ON p.id = s.user_id
    ),
    'attendance_okt', (
      SELECT COALESCE(json_agg(json_build_object(
        'pegawai', p.full_name,
        'tanggal', a.date,
        'status', a.attendance_status,
        'jam_masuk', a.clock_in_time,
        'jam_pulang', a.clock_out_time,
        'notes', a.notes
      ) ORDER BY a.date), '[]')
      FROM attendance a
      LEFT JOIN profiles p ON p.id = a.user_id
      WHERE a.date >= '2026-10-01'
    )
  );
$$;

REVOKE ALL ON FUNCTION public.debug_sanggahan_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.debug_sanggahan_state() TO service_role;
