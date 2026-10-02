-- =====================================================================
-- SEMENTARA (diagnosis): function baca-saja untuk memeriksa kondisi
-- pengingat shift — job cron, log dedupe hari ini, jadwal shift hari
-- ini, jumlah device token. Dipanggil via edge function debug-cron
-- dengan secret. DIHAPUS setelah diagnosis (lihat migration berikutnya).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.debug_cron_state()
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, cron
AS $$
  SELECT json_build_object(
    'wita_now', to_char(now() AT TIME ZONE 'Asia/Makassar', 'YYYY-MM-DD HH24:MI:SS'),
    'cron_jobs', (
      SELECT COALESCE(json_agg(json_build_object(
        'jobid', j.jobid, 'jobname', j.jobname, 'schedule', j.schedule,
        'last_run', (
          SELECT json_build_object('status', r.status, 'return_message', r.return_message, 'start_time', r.start_time)
          FROM cron.job_run_details r
          WHERE r.jobid = j.jobid
          ORDER BY r.start_time DESC LIMIT 1
        )
      )), '[]')
      FROM cron.job j
    ),
    'today_logs', (
      SELECT COALESCE(json_agg(json_build_object(
        'user_id', user_id, 'shift_code', shift_code, 'kind', kind,
        'created_at', created_at
      )), '[]')
      FROM shift_notification_log WHERE notif_date = CURRENT_DATE
    ),
    'device_tokens', (SELECT COUNT(*) FROM device_tokens),
    'today_schedules', (
      SELECT COALESCE(json_agg(json_build_object(
        'user_id', user_id, 'shift_code', shift_code, 'date', date
      )), '[]')
      FROM employee_schedules WHERE date = CURRENT_DATE
    )
  );
$$;

REVOKE ALL ON FUNCTION public.debug_cron_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.debug_cron_state() TO service_role;
