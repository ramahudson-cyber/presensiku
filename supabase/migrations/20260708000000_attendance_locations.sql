-- ============================================================
-- MIGRATION: Tabel attendance_locations + RPC
-- ============================================================

-- 1. Buat tabel lokasi puskesmas
CREATE TABLE IF NOT EXISTS attendance_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  radius_meter INT DEFAULT 200,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. RPC ambil lokasi aktif
CREATE OR REPLACE FUNCTION get_active_location()
RETURNS SETOF attendance_locations
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM attendance_locations WHERE is_active = true LIMIT 1;
$$;
