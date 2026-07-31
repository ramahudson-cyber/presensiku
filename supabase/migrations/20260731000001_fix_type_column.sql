-- ============================================================
-- Fix: rename 'type' column to 'leave_type'
-- 'type' is a PostgreSQL reserved keyword causing Supabase schema cache error
-- "Could not find the 'type' column of 'leave_requests' in the schema cache"
-- Tabel asli sudah punya kolom 'leave_type' (enum) + 'total_days' (NOT NULL)
-- ============================================================

-- Drop old constraint if exists
ALTER TABLE leave_requests DROP CONSTRAINT IF EXISTS leave_requests_type_check;

-- Rename column
ALTER TABLE leave_requests RENAME COLUMN type TO leave_type;

-- Re-create check constraint with new name
ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_leave_type_check CHECK (leave_type IN ('izin', 'sakit'));

-- Convert existing data to lowercase
UPDATE leave_requests SET leave_type = LOWER(leave_type);
