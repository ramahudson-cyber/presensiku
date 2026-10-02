-- =====================================================================
-- Jadwal cron pengingat shift: tiap 5 menit → tiap 1 menit.
-- Jendela reminder dipersempit jadi 2 menit sebelum shift mulai/berakhir
-- (WINDOW_MIN = 2 di function send-shift-reminder) — dengan cron 5 menit
-- jendela 2 menit sering terlewat, jadi cron harus tiap menit.
-- cron.schedule dengan jobname sama menimpa jadwal lama (upsert).
-- =====================================================================

SELECT cron.schedule(
  'shift-reminder-push',
  '* * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://muhxylbcgvwxjzrbkgdc.supabase.co/functions/v1/send-shift-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'),
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'shift_cron_secret')
    ),
    body := '{}'::jsonb
  ) AS http_response;
  $cron$
);
