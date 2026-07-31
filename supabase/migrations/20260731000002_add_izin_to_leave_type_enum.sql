-- ============================================================
-- Add 'izin' to leave_type enum
-- Enum saat ini cuma punya 'sakit', perlu ditambah 'izin'
-- ============================================================

ALTER TYPE leave_type ADD VALUE IF NOT EXISTS 'izin';
