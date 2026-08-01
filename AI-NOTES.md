# AI Notes — Hadir.Kuy (PresensiKU)

> File ini di-update otomatis. Setiap selesai tugas → bilang **"catat progress"** untuk update.

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
