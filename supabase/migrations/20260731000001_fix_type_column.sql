-- ============================================================
-- Fix: rename 'type' column to 'request_type'
-- 'type' is a PostgreSQL reserved keyword causing Supabase schema cache error
-- "Could not find the 'type' column of 'leave_requests' in the schema cache"
-- ============================================================

-- Drop old check constraint before rename
ALTER TABLE leave_requests DROP CONSTRAINT IF EXISTS leave_requests_type_check;

-- Rename column
ALTER TABLE leave_requests RENAME COLUMN type TO request_type;

-- Re-create check constraint with new name
ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_request_type_check CHECK (request_type IN ('izin', 'sakit'));

-- Rename existing data to use lowercase for consistency
UPDATE leave_requests SET request_type = LOWER(request_type);
