# AI Notes — Hadir.Kuy (PresensiKU)

> File ini di-update otomatis. Setiap selesai tugas → bilang **"catat progress"** untuk update.

## 🔔 Push Reminder Shift Server-Side (2 Okt 2026) — ✅ LIVE
Reminder shift kini dikirim dari SERVER → muncul saat aplikasi PWA/APK **tertutup** (bukan hanya saat dibuka). Infrastruktur yang sudah ada sebelumnya (device_tokens, token Android+web, firebase-messaging-sw.js, send-push utk pengumuman) tidak diubah.
- **Alur**: pg_cron `shift-reminder-push` (*/5 menit) → POST Edge Function `send-shift-reminder` (header `Authorization: Bearer <service_role dari Vault>` + `x-cron-secret`) → hitung jadwal mulai/berakhir ≤20 menit (WITA, dukung malam lintas tengah malam via jadwal kemarin) → dedupe `shift_notification_log` (unique user+shift+date+kind) → FCM HTTP v1 ke semua token user.
- **Secrets**: `CRON_SECRET` (supabase secrets) = `shift_cron_secret` (Vault); `service_role_key` (Vault) utk header transport cron. `FIREBASE_SERVICE_ACCOUNT` (lama) dipakai ulang.
- **⚠️ GOTCHA Edge Function**: deploy baru WAJIB `Deno.serve(handler)` eksplisit + JANGAN `verify_jwt=false` (keduanya terbukti bikin function menggantung → IDLE_TIMEOUT/WORKER_RESOURCE_LIMIT). Deploy tanpa Docker perlu flag `--use-api`. Function lama (send-push, dibuat sebelum perubahan runtime) masih jalan — kalau **redeploy** send-push, tambahkan `Deno.serve(handler)` juga.
- **Verifikasi**: `SELECT * FROM net._http_response ORDER BY id DESC;` (cron tiap 5 menit, harus 200), `SELECT * FROM shift_notification_log;` (baris muncul saat ada shift ±20 menit), log function di Dashboard.
- Tidak ada perubahan client bundle (webVersionCode tidak dinaikkan).

## 🩹 FIX Approval Cuti/Izin 400 (27 Sep 2026) — ✅ LIVE DI DB + pushed
**Gejala:** klik Setuju di Cuti & Izin → 400 `column "attendance_status" is of type attendance_status but expression is of type leave_type`.
**Akar masalah:** `approve_leave_request_impl` meng-insert `v_request.leave_type` (enum `leave_type`) langsung ke kolom `attendance.attendance_status` (enum `attendance_status`) — dua enum berbeda, Postgres tidak cast implisit.
**Fix:** migration `supabase/migrations/20260927130000_fix_approve_leave_request_enum_cast.sql` — hanya replace `approve_leave_request_impl`; mapping `izin→izin, sakit→sakit, lainnya(tahunan/bersalin/alasan_penting)→cuti`. Wrapper `approve_leave_request` (guard per org) tidak diubah.
- Sudah dieksekusi ke DB live via Management API (token dari keyring CLI, script `.tmp/sb_query.ps1`)
- Uji end-to-end dalam transaksi ROLLBACK: RPC sukses, 2 record attendance `izin` dibuat utk permohonan dani (0f1ea318), data produksi tetap utuh
- ⚠️ Migration history remote tertinggal: 11 migration lokal (20260926000003–20260927120000, payroll dll) tidak tercatat di `schema_migrations` — diterapkan manual via SQL editor. JANGAN asal `supabase db push` (akan re-run 11 migration itu). Kalau mau sinkron: `supabase migration repair --status applied` dulu.
- Nilai enum live: `attendance_status` = hadir/terlambat/izin/sakit/alpha/cuti; `leave_type` = izin/sakit/tahunan/bersalin/alasan_penting

## 🏢 MULTI-TENANT (Fase 1, Sept 2026) — ✅ SUDAH LIVE DI DB + frontend siap deploy
Aplikasi multi-tenant SaaS. **Semua migration SUDAH dieksekusi ke DB live** (`muhxylbcgvwxjzrbkgdc`) + terverifikasi uji isolasi end-to-end (admin instansi uji TIDAK bisa melihat data instansi lain). File migration (urutan eksekusi historis):
1. `supabase/migrations/20260913000001_multi_tenant_organizations.sql`
2. `supabase/migrations/20260913000002_multi_tenant_rls_policies.sql`
3. `supabase/migrations/20260913000003_multi_tenant_rpc_security.sql`
4. `supabase/migrations/20260913000004_create_organization_rpc.sql`
5. `supabase/migrations/20260913000005_shifts_per_org_constraints.sql` (shifts/shift_schedules per instansi, composite key)
- Baseline policy lama: `supabase/migrations/archive/live_policies_baseline_2026-09-13.json`

Yang berubah:
- Tabel `organizations` baru; semua tabel diberi `organization_id` (+trigger auto-fill dari profiles)
- RLS semua tabel ter-scope instansi; `super_admin` = platform admin (lihat semua), `admin_puskesmas` = admin instansi
- Login: `username` (instansi tunggal) atau `username@kode-instansi` (multi) via RPC `resolve_login_identity`
- Pegawai baru dibuat admin: auth email sintetis `<slug>__<username>@users.presensiku.app` (email asli tetap di `profiles.email`)
- RPC security fix: create/delete_employee, device RPC, settings, lokasi — semua ada guard tenant
- Halaman **Kelola Instansi** (`/admin/organizations`, super_admin saja) + RPC `create_organization_with_admin`
- ⚠️ Deploy web HARUS setelah SQL dijalankan; app lama di APK tetap aman (trigger isi org otomatis)

## ⚠️ Kebijakan Update PWA/Web (WAJIB DIBACA SEBELUM DEPLOY UI)
- **`public/version.json` punya 2 channel terpisah:**
  - `versionCode` → khusus update **APK/native**. JANGAN di-bump untuk perubahan web saja.
  - `webVersionCode` → khusus deploy **web/PWA**. **Bump +1 setiap deploy yang mengubah UI/logika web** — semua halaman lama yang terbuka akan auto-reload dalam ±30 detik (mekanisme di `UpdateDialog` + `checkWebUpdate` di `updateService.js`).
- Registrasi SW manual di `main.jsx` (`injectRegister: null`, `updateViaCache: 'none'`).
- Auto-reload SW `controllerchange` ada di `index.html` (guard sessionStorage).

## Izin/Sakit (Cuti & Sakit)
✅ Form permohonan: LeaveRequestPage selesai
✅ Admin approval: LeaveManagementPage selesai
✅ leaveService.js: create, getMy, get, approve, reject — selesai
✅ Migration DB: `20260731000000_create_leave_requests.sql`
✅ Enum migration: `20260731000002_add_izin_to_leave_type_enum.sql`
✅ Code commit & push ke GitHub

✅ **ENUM `leave_type` SUDAH ada `izin`** — live DB: izin/sakit/tahunan/bersalin/alasan_penting
✅ **RPC approve/reject berfungsi** — fix enum cast 27 Sep 2026 (lihat bagian atas)
❌ **Service role key sudah expired** — run SQL via Management API pakai token CLI (lihat `.tmp/sb_query.ps1`)

📝 **SQL untuk dijalankan di Supabase Dashboard → SQL Editor:**
```sql
ALTER TYPE leave_type ADD VALUE IF NOT EXISTS 'izin';
```

## Dashboard
✅ Dark-glass design (Robinhood style) selesai
⏳ Testing APK — belum

## Update Dialog
✅ Fix React error #310 — useEffect cleanup sebelum early return di `UpdateDialog.jsx`
✅ Fix OOM Gradle — `android/gradle.properties` → `org.gradle.jvmargs=-Xmx2048m`
✅ Bump version: `CURRENT_VERSION="1.6.6"`, `CURRENT_VERSION_CODE=18`
✅ Deploy Vercel: https://presensiku.vercel.app

## Remember Me & Biometric
✅ Strategy: localStorage (web) + `@capacitor/preferences` (APK native)
✅ Dynamic import dengan fallback localStorage
✅ UI checkbox "Ingat Saya" + "Gunakan Sidik Jari"

## WebAuthn (Rencana)
⏳ Belum dimulai — butuh Vercel Functions + DB table + kriptografi

---

## ⚠️ TARGET DEPLOYMENT — HARUS DIPAKAI
- **URL live:** `https://presensiku-beige.vercel.app` ← gunakan ini
- **Project Vercel:** `presensiku` (custom domain = `presensiku-beige.vercel.app`)
- **CI deploy otomatis** via GitHub Actions → Vercel `npx vercel --prod`
- ❌ **JANGAN deploy ke `presensiku.vercel.app`** — project lama, sudah tidak dipakai
- ✅ Commit `5b9db92` sudah berhasil deploy ke `presensiku-beige.vercel.app`

## Gradient Header (Standardisasi)
- ✅ Semua halaman employee sudah pakai gradient hero card header yang konsisten
- **Gradient:** `linear-gradient(160deg, #BF40FF 0%, #6600CC 35%, #2B0066 65%, #000000 100%)`
- **Border:** `rounded-b-[40px]`
- File yang diupdate:
  - `src/pages/employee/LeaveRequestPage.jsx` — diganti dari inline flex header → gradient card
  - `src/pages/employee/EmployeeSchedule.jsx` — diganti dari fixed top bar → gradient card
  - `src/pages/employee/EmployeeHistory.jsx` — sudah benar dari awal (tetap tidak diubah)
- Commit: `5b9db92` "feat(ui): standardize gradient hero card header on all employee menu pages"

---

## Cara Pakai
- Chat baru → ZCode baca file ini → langsung paham progress
- Selesai kerja → bilang **"catat progress"** → saya update file ini
- Tidak perlu ngetik manual
