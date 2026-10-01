-- ============================================================
-- Push reminder shift dari server (muncul saat aplikasi tertutup)
--
-- Cron pg_cron tiap 5 menit memanggil Edge Function
-- `send-shift-reminder` (otentikasi header x-cron-secret) yang:
--   1. menghitung jadwal shift yang mulai/berakhir dalam ±20 menit
--      (zona WITA, mendukung shift malam lintas tengah malam),
--   2. mengirim FCM push ke semua token di device_tokens
--      (platform android + web),
--   3. dedupe via tabel shift_notification_log agar tidak dobel kirim.
-- Idempotent: aman dijalankan berulang.
-- ============================================================

-- Ekstensi penjadwal + HTTP keluar (belum pernah dipakai sebelumnya)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Log pengiriman = kunci dedupe (sekali kirim per user/shift/tanggal/jenis)
CREATE TABLE IF NOT EXISTS shift_notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  shift_code TEXT NOT NULL,
  notif_date DATE NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('start', 'end')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, shift_code, notif_date, kind)
);

ALTER TABLE shift_notification_log ENABLE ROW LEVEL SECURITY;

-- Tidak ada policy: hanya service role (Edge Function) yang mengakses;
-- pegawai tidak perlu membaca log pengiriman.

-- Jadwal cron tiap 5 menit → POST ke Edge Function.
-- Header Authorization = service_role JWT (transport, dari Vault) karena
-- function memakai verify_jwt default; otentikasi aktual = x-cron-secret
-- yang dicek di dalam function terhadap secret CRON_SECRET.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'shift-reminder-push') THEN
    PERFORM cron.schedule(
      'shift-reminder-push',
      '*/5 * * * *',
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
  END IF;
END $$;
