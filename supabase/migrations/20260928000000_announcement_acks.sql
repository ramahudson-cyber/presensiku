-- Track pengumuman yang sudah dibaca oleh setiap pegawai.
-- Unread count = jumlah pengumuman aktif org-scoped yang belum di-ack user.

CREATE TABLE IF NOT EXISTS announcement_acks (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, announcement_id)
);

ALTER TABLE announcement_acks ENABLE ROW LEVEL SECURITY;

-- Pegawai: hanya bisa baca/tulis ack milik sendiri.
CREATE POLICY ack_self_select ON announcement_acks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY ack_self_insert ON announcement_acks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Platform: lihat semua (admin dashboard/statistik).
CREATE POLICY ack_platform_select ON announcement_acks FOR SELECT
  USING (is_platform_admin());

-- Supaya tidak ada kebocoran data: hapus row milik platform yang tidak punya
-- user (tidak berlaku — is_platform_admin cuma untuk baca).

GRANT SELECT, INSERT ON announcement_acks TO authenticated;
