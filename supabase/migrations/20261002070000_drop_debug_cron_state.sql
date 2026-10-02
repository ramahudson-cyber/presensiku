-- =====================================================================
-- Cleanup diagnosis: hapus function debug_cron_state yang sementara
-- dibuat untuk memeriksa kondisi pengingat shift (lihat
-- 20261002060000_debug_cron_state.sql). Edge function debug-cron dan
-- secret DEBUG_SECRET sudah dihapus via CLI.
-- =====================================================================

DROP FUNCTION IF EXISTS public.debug_cron_state();
