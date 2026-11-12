-- =====================================================================
-- Retensi foto bukti sanggahan: jadwalkan pembersihan harian.
--
-- Foto bukti yang lebih tua dari masa simpan dihapus oleh edge function
-- cleanup-evidence. Tanpa ini, kuota storage 1 GB dan egress terus tumbuh
-- seiring bertambahnya pengguna dan tahun pemakaian.
--
-- Jadwal: 19:00 UTC = 03:00 WITA (jam paling sepi).
-- Otentikasi: Bearer service role (Vault) + x-cron-secret, pola yang sama
-- dengan cron pengingat shift.
-- =====================================================================

DO $$
DECLARE
  j RECORD;
BEGIN
  FOR j IN SELECT jobid FROM cron.job WHERE jobname = 'cleanup-evidence' LOOP
    PERFORM cron.unschedule(j.jobid);
  END LOOP;

  PERFORM cron.schedule(
    'cleanup-evidence',
    '0 19 * * *',
    $cron$
    SELECT net.http_post(
      url := 'https://muhxylbcgvwxjzrbkgdc.supabase.co/functions/v1/cleanup-evidence',
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