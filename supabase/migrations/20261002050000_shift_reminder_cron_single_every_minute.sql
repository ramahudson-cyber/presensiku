-- =====================================================================
-- Pastikan TEPAT SATU job cron pengingat shift dengan jadwal tiap 1 menit.
--
-- Masalah: setelah jendela reminder dipersempit jadi 2 menit
-- (WINDOW_MIN = 2 di send-shift-reminder), jika job cron masih tiap
-- 5 menit maka tick cron (sisa 5 menit / 0 menit) tidak pernah menyentuh
-- jendela (sisa 1-2 menit) → pengingat tidak pernah terkirim saat
-- aplikasi tertutup. Migration ini unschedule semua job bernama
-- 'shift-reminder-push' (juga duplikat bila ada) lalu menjadwalkan ulang
-- tepat satu job tiap menit.
-- =====================================================================

DO $$
DECLARE
  j RECORD;
BEGIN
  FOR j IN SELECT jobid FROM cron.job WHERE jobname = 'shift-reminder-push' LOOP
    PERFORM cron.unschedule(j.jobid);
  END LOOP;

  PERFORM cron.schedule(
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
END $$;
