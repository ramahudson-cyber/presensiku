-- Add is_late and late_minutes columns to attendance table
-- These are used by EmployeeDashboard to show "Tepat Waktu" / "Terlambat Xm"
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS is_late BOOLEAN DEFAULT FALSE;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS late_minutes INTEGER DEFAULT 0;
