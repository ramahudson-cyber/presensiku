-- ============================================================
-- Push pengumuman dari server (muncul saat aplikasi tertutup)
--
-- BEFORE: push dikirim dari browser admin (fire-and-forget) — hilang
--         bila tab ditutup sebelum invoke selesai, dan aktivasi draft
--         via toggle tidak pernah push.
-- AFTER : trigger DB memanggil Edge Function send-push via pg_net pada
--         INSERT aktif dan aktivasi (false→true). Dedupe atomik di
--         function (push_sent_at) menjamin sekali kirim walau trigger
--         dan invoke browser datang bersamaan.
-- Idempotent: aman dijalankan berulang.
-- ============================================================

ALTER TABLE announcements ADD COLUMN IF NOT EXISTS push_sent_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION queue_announcement_push() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  -- Hanya pengumuman aktif; edit konten pengumuman yang sudah aktif
  -- tidak mengirim ulang (dedupe final ada di send-push via push_sent_at).
  IF NOT NEW.is_active THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.is_active IS TRUE THEN RETURN NEW; END IF;

  PERFORM net.http_post(
    url := 'https://muhxylbcgvwxjzrbkgdc.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'),
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'shift_cron_secret')
    ),
    body := jsonb_build_object('announcement_id', NEW.id)
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_announcement_push ON announcements;
CREATE TRIGGER trg_announcement_push
AFTER INSERT OR UPDATE OF is_active ON announcements
FOR EACH ROW
EXECUTE FUNCTION queue_announcement_push();
