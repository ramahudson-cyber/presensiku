-- Tambah kolom password_changed untuk fitur force ganti password first login
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password_changed boolean DEFAULT false;

-- Set true untuk semua user yang sudah ada (agar tidak kena forced change)
UPDATE profiles SET password_changed = true;
