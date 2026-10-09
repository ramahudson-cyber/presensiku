# Laporan Audit Keamanan — Anti Fake-GPS "Presensiku" (Hadir.Kuy)

Tanggal: 2026-10-09
Ruang lingkup: mekanisme deteksi & penanganan lokasi palsu (fake GPS) pada absensi.
Metode: audit kode statis (frontend React, backend Supabase/Postgres, APK Android/Capacitor) + verifikasi build & simulasi logika.

---

## 1. Ringkasan Eksekutif

Aplikasi **sudah** memblokir absen di luar radius kantor lewat trigger server
(`guard_attendance_self_write` → `assert_within_radius` → `match_attendance_location`).
Namun **keaslian koordinat dipercaya begitu saja** dari perangkat, sehingga fake GPS
yang menaruh titik *di dalam* radius tetap lolos. Kerentanan utama adalah deteksi mock
yang **100% di sisi klien** dan **fail-open** (gagal = dianggap aman), plus **Android web/PWA
tanpa deteksi sama sekali**.

Setelah perbaikan (berlapis), absen dengan fake GPS ditolak baik di klien **maupun**
di server, dan percobaannya tercatat untuk audit admin.

---

## 2. Temuan (dengan tingkat risiko)

| # | Temuan | Tingkat | Bukti |
|---|--------|---------|-------|
| F1 | Deteksi mock hanya di klien & **fail-open**: plugin error/tak ada → `isMock:false` (lolos). RPC/insert langsung & APK modif tembus total. | **Kritis** | `src/services/mockLocationService.js:27-30` (sebelum), `AttendancePage.jsx` hanya blokir UI |
| F2 | Server mempercayai `latitude/longitude` apa adanya; hanya cek radius + `accuracy < 5`. Fake GPS di dalam radius akurasi ≥5 m lolos. | **Kritis** | `supabase/migrations/20260926000005_location_tolerance_50m.sql:69`; tak ada kolom sinyal mock |
| F3 | Android web/PWA **tanpa deteksi**; `isPegawaiWebBlocked` hanya memblokir desktop — absen via Chrome/PWA Android bebas fake GPS. | **Tinggi** | `src/lib/devicePlatform.js:38-40` (sebelum) |
| F4 | Tidak ada attestation perangkat (Play Integrity/SafetyNet) dan tidak ada deteksi emulator/root. | **Tinggi** | `android/app/build.gradle` (tidak ada Play Integrity) |
| F5 | Tidak ada pencatatan percobaan fake GPS (penolakan me-rollback audit biasa). | **Sedang** | Alur `RAISE EXCEPTION` + `log_audit` dalam transaksi sama |
| F6 | Device binding tidak ditegakkan di server saat absen (hanya saat login). | **Sedang** | Tidak ada gate di guard absensi |

Catatan: heuristik `accuracy < 3 AND (altitude null/0)` di klien mudah dilewati (fake GPS
umum meniru altitude & akurasi) — dihitung bagian dari F1/F2, bukan temuan tersendiri.

---

## 3. Perbaikan yang Diterapkan

### Fase 1 — Hardening Server (aditif, non-destruktif)
File: `supabase/migrations/20261009000000_anti_fake_gps_hardening.sql`
- Kolom baru di `attendance`: `client_integrity JSONB`, `integrity_verdict TEXT`, `mock_flag BOOLEAN`.
- Tabel `attendance_security_events` + RPC `log_attendance_security_event` untuk mencatat
  percobaan yang **ditolak** (tahan-rollback), dibaca admin via RLS.
- `parse_client_integrity()` + `safe_bool/safe_int` (payload cacat → dianggap bukan sinyal, bukan error).
- `assert_client_integrity()`: **mock & emulator DITOLAK** (default), plus gate kebijakan
  opsional: Android wajib native, versi APK minimal, Play Integrity, device binding.
- `assert_within_radius()` diperkuat: radius lama tetap, lalu enforcement integritas.
- `check_attendance_velocity()`: deteksi "teleport" (kecepatan antar-absen > ambang, default 150 km/jam).
- Trigger `attendance_populate_integrity` mengisi kolom sinyal (memilih lokasi yang **baru berubah**).
- Setting per-instansi di `system_settings` (semua kebijakan keras **default OFF** kecuali mock action).

### Fase 2 — Client Web
- `src/lib/devicePlatform.js`: **Android web/PWA DIBLOKIR**; iOS PWA tetap boleh; desktop tetap blokir.
- `src/services/mockLocationService.js`: **hapus fail-open** — APK native tanpa plugin → `needsUpdate:true` + sinyal ke server; tambah emulator/root/versi.
- `src/services/integrityService.js` (baru): `buildIntegritySignal`, `attachIntegrity`, `logSecurityEvent`, `fetchIntegrityVerdict`.
- `src/pages/attendance/AttendancePage.jsx`: sinyal integritas disisipkan ke `location_in/out`;
  mock → blokir + catat event; ambil verdict Play Integrity sebelum absen.

### Fase 3 — APK Android
- `MockLocationPlugin.java`: tambah deteksi **emulator** (FINGERPRINT/QEMU/generic), **root**
  (su/Magisk/test-keys/debuggable), **konsistensi fix**; kirim semua sinyal ke JS.
- `PlayIntegrityPlugin.java` (baru): minta integrity token (nonce anti-replay) — diverifikasi server.
- `MainActivity.java`: registrasi plugin Play Integrity.
- `android/app/build.gradle`: dependency `com.google.android.play:integrity:1.4.0`.
- `supabase/functions/verify-integrity/index.ts` (baru): verifikasi token ke Google Play API,
  kembalikan verdict; butuh env `GOOGLE_SERVICE_ACCOUNT` + `PLAY_INTEGRITY_PACKAGE`.
- Versi dinaikkan: `1.7.1 (26)` → **`1.8.0 (27)`**, `webVersionCode` 23 → 24.

---

## 4. Hasil Verifikasi

| Verifikasi | Hasil |
|-----------|-------|
| Build web (`npm run build`) | ✅ Sukses |
| Lint file baru & berubah | ✅ Tidak menambah error (setara baseline) |
| Kompilasi Android (`:app:compileDebugJavaWithJavac`) | ✅ Sukses; `MockLocationPlugin.class` & `PlayIntegrityPlugin.class` terbentuk |
| Type-check Edge Function (`deno check`) | ✅ Sukses |
| Simulasi enforcement integritas (11 skenario) | ✅ 11/11 lulus (mock, emulator, native, versi, integrity, binding) |
| Simulasi platform blocking (8 skenario) | ✅ 8/8 lulus (Android-web diblokir, iOS lolos, admin tidak diblokir) |
| Simulasi velocity/teleport (4 skenario) | ✅ 4/4 lulus (teleport Jakarta→Mataram ditolak) |
| UI web (Playwright): `/block` device=android | ✅ Render "Akses Terbatas" |
| Regresi UI: halaman login | ✅ Render normal |
| Migrasi SQL: parse & struktur | ✅ Lolos (parser + cek manual RLS/policy) |
| **Migrasi diterapkan ke produksi** (`supabase db push --linked`) | ✅ Berhasil (project `muhxylbcgvwxjzrbkgdc`) |
| **Verifikasi DB via REST API** | ✅ `attendance_security_events` HTTP 200; kolom `mock_flag`/`client_integrity`/`integrity_verdict` HTTP 200; RPC baru ada & anon ditolak (42501) |
| **Edge Function deploy** (`verify-integrity`) | ✅ ACTIVE, merespons cepat (0.27s), JWT invalid ditolak gateway 401 |

**Catatan verifikasi:** Migrasi **sudah diterapkan** ke database produksi dan Edge Function
`verify-integrity` **sudah di-deploy** (status ACTIVE) pada 2026-10-09. Diverifikasi melalui
REST API: tabel & kolom baru ada, dan RPC baru menolak akses anonim (permission denied).

---

## 5. Yang Perlu Anda Lakukan (agar proteksi penuh aktif)

1. ~~Jalankan migrasi~~ ✅ **SUDAH** (diterapkan ke produksi 2026-10-09).
2. **Isi secret Edge Function**: `GOOGLE_SERVICE_ACCOUNT` (service account berakses Play Console),
   `PLAY_INTEGRITY_PACKAGE=com.presensiku.app`, opsional `PLAY_INTEGRITY_CERT_SHA256`.
   (Belum diisi → fungsi mengembalikan verdict `UNVERIFIED`; aman, tidak error.)
3. **Build & rilis APK v1.8.0** ke GitHub Releases (agar link `apkUrl` valid).
   CI `.github/workflows/build.yml` sudah otomatis build APK + deploy web saat push ke `main`.
4. Setelah APK baru tersebar, nyalakan kebijakan keras lewat Pengaturan (system_settings):
   `attendance_require_android_native=true`, `attendance_min_app_version_code=27`,
   lalu `attendance_require_integrity=true`, dan `attendance_require_device_binding=true`.
   (Default OFF agar pegawai tidak terkunci di tengah migrasi.)
5. Pastikan alur **approval device** admin berjalan (device baru → pending → approve).

---

## 6. Batasan / Sisa Risiko

- **Root/emulator tidak sempurna** dideteksi (bisa disamarkan), tapi memperbesar biaya serangan
  & dikombinasikan dengan Play Integrity + validasi server.
- **iOS**: tidak ada API mock-detection; mengandalkan radius + velocity + sinyal server.
- **Replay/kolusi**: Play Integrity nonce membantu anti-replay, tetapi absensi tetap bisa
  "dititipkan" ke orang lain di perangkat yang sama — mitigated oleh device binding + selfie (jika diaktifkan).
- Kebijakan server hanya sekuat **setting** yang dinyalakan; default OFF = proteksi sebagian.

---

## 7. File yang Berubah/Ditambah

**Ditambah:** `supabase/migrations/20261009000000_anti_fake_gps_hardening.sql`,
`supabase/functions/verify-integrity/index.ts`,
`android/app/src/main/java/com/presensiku/app/PlayIntegrityPlugin.java`,
`src/services/integrityService.js`.

**Diubah:** `src/lib/devicePlatform.js`, `src/services/mockLocationService.js`,
`src/pages/attendance/AttendancePage.jsx`,
`android/.../MockLocationPlugin.java`, `android/.../MainActivity.java`,
`android/app/build.gradle`, `capacitor.config.json`, `public/version.json`,
`src/services/updateService.js`, `supabase/config.toml`.

Semua perubahan bersifat **reversible** (`git revert`); migrasi tidak menghapus kolom/tabel.