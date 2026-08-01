# Rencana Eksekusi — SIAP Puskesmas Ampenan

> Dibuat: 2 Juli 2026
> Status: **Sedang dikerjakan**

---

## Task 1: ~~Face Recognition (Pencocokan Wajah di Absensi)~~ — **DIHAPUS**

Tidak jadi pakai face recognition. Cukup device binding + Android ID.

---

## Task 2: Android APK (Capacitor + Android ID Device Binding) — **SELESAI**

**Tujuan:** Pegawai Android pakai APK, device binding pake Android ID (bukan fingerprint browser)

### Files to Create/Modify

| File | Action | Keterangan |
|------|--------|------------|
| `capacitor.config.ts` | **Baru** | Konfigurasi Capacitor |
| `src/services/deviceService.js` | **Ubah** | Platform-aware getDeviceInfo: Android → Device.getId(), iOS → WebAuthn, Web → fingerprint fallback |
| `src/lib/devicePlatform.js` | **Baru** | Helper: `isAndroidCapacitor()`, `isiOS()` |
| `supabase/migrations/xxx_device_type.sql` | **Baru** | Tambah kolom `device_type` (`android`/`ios`/`web`) di `device_requests` & `user_devices` |
| `src/pages/admin/PengaturanPage.jsx` | **Ubah** | Tampilkan device_type badge di device list & approval |
| `src/pages/auth/LoginPage.jsx` | **Ubah** | Hapus FingerprintJS preload, panggil deviceService baru |

### Command Sequence
```bash
# Install dependencies (sudah ada di package.json)
npm install @capacitor/device

# Init Capacitor
npx cap init SIAP Puskesmas com.puskesmas.siap

# Add Android platform
npx cap add android

# Build web app
npm run build

# Sync ke Android
npx cap sync android

# Build APK (via Android Studio)
npx cap open android
# → Android Studio → Build → Build Bundle(s) / APK(s) → Build APK

# Atau command line:
cd android
./gradlew assembleDebug
# Hasil: android/app/build/outputs/apk/debug/app-debug.apk
```

### Distribusi APK
1. Upload `app-debug.apk` atau `app-release.apk` ke Google Drive
2. Set "Anyone with link can view"
3. Share link ke pegawai via WhatsApp/Telegram
4. Atau taruh di folder `public/apk/` dan buat halaman `/download-apk`

### Device Binding Logic
```js
// Output: { deviceId, deviceName, deviceOs, deviceBrowser, deviceType }
if (Capacitor.isNativePlatform()) {
  // Android: Device.getId().uuid
  // deviceType = "android"
} else if (isiOS()) {
  // WebAuthn + device UUID
  // deviceType = "ios"
} else {
  // FingerprintJS (existing)
  // deviceType = "web"
}
```

---

## Task 3: iOS PWA + WebAuthn (Face ID Device Binding)

**Tujuan:** Pegawai iPhone pakai PWA, device binding pake Face ID / Touch ID via WebAuthn

### Files to Create/Modify

| File | Action | Keterangan |
|------|--------|------------|
| `src/services/deviceService.js` | **Ubah** | Tambah `registerWebAuthn()`, `authenticateWebAuthn()` |
| `src/pages/auth/LoginPage.jsx` | **Ubah** | Tambah step webauthn + prompt Face ID |
| `api/webauthn-register.js` | **Baru** | Serverless function: generate WebAuthn registration options + verify |
| `api/webauthn-login.js` | **Baru** | Serverless function: generate WebAuthn authentication options + verify |
| `supabase/migrations/xxx_passkeys.sql` | **Baru** | Tabel `passkeys` (user_id, public_key, credential_id, device_name) |
| `package.json` | **Ubah** | Tambah `@simplewebauthn/browser`, `@simplewebauthn/server` |

### Logic
1. Login pertama dari iPhone → setelah OTP berhasil → registrasi WebAuthn → prompt Face ID → simpan public key
2. Login berikutnya → prompt Face ID → verify signature → cocok → langsung masuk
3. Coba dari iPhone lain → gak punya private key → gagal → harus OTP lagi

---

## Task 4: Update Admin Panel

| File | Perubahan |
|------|-----------|
| `src/pages/admin/PengaturanPage.jsx` | Tambah kolom `device_type` di device list + approval tab |
| `src/pages/admin/EmployeesPage.jsx` | Tambah status "Sudah Registrasi Wajah" / "Belum" |

---

## Urutan Pengerjaan

```
~~1. Task 1: Face Recognition — DIHAPUS~~

1. Task 2: Android APK + Device Binding — ✓ SELESAI

2. Task 3: iOS WebAuthn
   - Buat migration SQL (passkeys)
   - Buat serverless functions (webauthn-register, webauthn-login)
   - Update deviceService.js + LoginPage.jsx

3. Task 4: Admin panel updates
   - Update PengaturanPage.jsx
   - Update EmployeesPage.jsx

4. Testing + Deploy
   - Build APK + upload
   - Push ke GitHub
   - Vercel auto-deploy
```

---

## ⚠️ CATATAN PENGEMBANGAN (STATUS PROTEKSI)
- [x] Proteksi Rute `/employee` (ProtectedRoute & PlatformGuard) saat ini **DIMATIKAN** untuk testing.
- [ ] **HARUS DI-AKTIFKAN KEMBALI** sebelum aplikasi siap untuk produksi.

---

## Cara Lanjut Besok

Buka folder project lalu bilang ke AI:

> **"Lanjut rencana, mulai dari task 3"**

---

## Task Baru: Izin/Sakit (Cuti & Sakit) — **SELESAI**

**Tujuan:** Pegawai bisa buat permohonan izin/sakit, admin bisa approve/reject

### Files Created/Modified
| File | Action | Keterangan |
|------|--------|------------|
| `src/pages/employee/LeaveRequestPage.jsx` | **Baru** | Form permohonan izin/sakit (start_date, end_date, leave_type, notes) |
| `src/pages/admin/LeaveManagementPage.jsx` | **Baru** | Admin approval list + approve/reject action |
| `src/services/leaveService.js` | **Baru** | CRUD leave requests: create, getMy, get, approve, reject |
| `src/components/BottomNav.jsx` | **Ubah** | Tambah menu "Izin/Sakit" (ClipboardList icon) |
| `supabase/migrations/20260731000000_create_leave_requests.sql` | **Baru** | Tabel leave_requests + RPC approve/reject + function auto-insert attendance |
| `supabase/migrations/20260731000002_add_izin_to_leave_type_enum.sql` | **Baru** | ALTER TYPE leave_type ADD VALUE 'izin' |

### Status
- ✅ UI selesai (form + admin page)
- ✅ Service layer selesai
- ✅ Migration selesai
- ⏳ Tinggal run SQL di Supabase Dashboard: `ALTER TYPE leave_type ADD VALUE IF NOT EXISTS 'izin';`
