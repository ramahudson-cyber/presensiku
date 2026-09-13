# AI Notes — Hadir.Kuy (PresensiKU)

> File ini di-update otomatis. Setiap selesai tugas → bilang **"catat progress"** untuk update.

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

❌ **ENUM `leave_type` belum ditambah `'izin'`** — table hanya punya `'sakit'`
❌ **Service role key sudah expired** — butuh key baru untuk run SQL otomatis

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
