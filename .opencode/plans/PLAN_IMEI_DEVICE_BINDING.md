# Rencana: Implementasi IMEI + Fallback Android ID untuk Device Binding

## Tujuan
Ganti identifikasi device dari **Android ID** (berubah saat reinstall) menjadi **IMEI** (permanen per hardware) dengan fallback jika IMEI tidak tersedia.

---

## Tahap 1 — Custom Capacitor Plugin `ImeiPlugin`

**File baru:**
- `android/app/src/main/java/com/siappuskesmas/app/ImeiPlugin.java`
- Daftarkan di `MainActivity.java` (atau auto-register via annotation)

**Logika plugin:**
- Cek izin `READ_PRECISE_PHONE_STATE` (Android 10+)
- Jika sudah diizinkan → `telephonyManager.getImei()`
- Jika belum → minta izin runtime
- Jika ditolak / Android 14+ → return null (fallback)

**Output:**
```json
{ "imei": "356938...", "serial": "abc123", "model": "Samsung..." }
```

---

## Tahap 2 — Update `deviceService.js`

**File diubah:** `src/services/deviceService.js`

**Perubahan fungsi `getDeviceInfo()`:**

```
native path:
  coba ImeiPlugin.getImeiInfo()
  ↓
  jika success (IMEI ada) → visitorId = imei
  ↓
  jika tidak (IMEI null / error / izin ditolak) → fallback ke Device.getId() (ANDROID_ID seperti sekarang)
```

**Tambahan field output:** `imei` dan `serial` untuk logging/admin.

---

## Tahap 3 — Update LoginPage (opsional)

**File diubah:** `src/pages/auth/LoginPage.jsx`

Jika perlu izin IMEI runtime, tambah screen/step minta izin sebelum login.

---

## Tahap 4 — Update PengaturanPage

**File diubah:** `src/pages/admin/PengaturanPage.jsx`

Tampilkan IMEI di daftar device per user (kolom baru atau tooltip).

---

## Tahap 5 — Sync Android + Build

```bash
npx cap sync android
```

Build release APK untuk testing.

---

## Tahap 6 — Testing

| Skenario | Hasil |
|----------|-------|
| Izin IMEI diberikan | Device binding pakai IMEI — tahan reinstall |
| Izin IMEI ditolak | Fallback Android ID — tetap binding |
| Uninstall APK, install ulang | Kalau bind pakai IMEI → langsung trusted tanpa OTP |
| Login dari HP berbeda | Terdeteksi device baru → OTP + approval admin |

---

## Risiko

- **Google Play policy:** IMEI termasuk _personal data_, perlu kebijakan privasi
- **Android 15+:** IMEI mungkin makin dibatasi; fallback wajib ada
- **Device tanpa IMEI** (tablet WiFi-only) → auto fallback ke Android ID

---

## Prioritas Pengerjaan

1. **Tahap 1** (custom plugin) → paling kritis, paling lama
2. **Tahap 2** (deviceService.js) → integrasi
3. **Tahap 5** (build & test) → verifikasi
4. Tahap 3, 4, 6 → penyempurnaan
