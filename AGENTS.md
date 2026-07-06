# Konfigurasi Proyek — SIAP Puskesmas Ampenan

## Shift Kerja
4 shift dengan jadwal per hari:

### Shift Pagi
| Hari | Jam |
|------|-----|
| Senin-Kamis | 07:30 - 14:00 WITA |
| Jumat | 07:30 - 11:00 WITA |
| Sabtu | 07:30 - 12:30 WITA |

### Shift Poli Sore
| Hari | Jam |
|------|-----|
| Senin-Kamis | 14:00 - 16:30 WITA |
| Jumat | Libur |
| Sabtu | Libur |

### Shift Siang
| Hari | Jam |
|------|-----|
| Senin-Kamis | 14:00 - 20:00 WITA |
| Jumat | 11:00 - 20:00 WITA |
| Sabtu | 12:30 - 20:00 WITA |

### Shift Malam (2 kali absen)
| Hari | Jam |
|------|-----|
| Senin-Kamis | 20:00 - 07:00 WITA |
| Jumat | 20:00 - 07:00 WITA |
| Sabtu | 20:00 - 07:00 WITA |
- Check-in 20:00 (record 1), check-out 07:00 besok (record 2)
- 2 record terpisah

## Aturan Absensi
- Toleransi terlambat: 5 menit (latest_check_in = start_time + 5m)
- Terlambat > 1 jam: tidak bisa absen (blokir), hubungi admin
- Pegawai absen tanpa pilih shift (jadwal otomatis terbaca)
- Admin input jadwal per bulan (manual atau upload Excel)
- Perubahan shift: admin edit manual di aplikasi

## Role
- super_admin: akses penuh + pengaturan sistem
- admin_puskesmas: kelola pegawai & jadwal
- kepala_unit: melihat data unit
- pegawai: absen & dashboard sendiri

## Database
- Gunakan WITA (UTC+8) sebagai zona waktu
- Tabel shifts: PG (Pagi), SR/Sore (Poli Sore), SI (Siang), ML (Malam)
- Tabel shift_schedules: jadwal per hari (day_of_week 0=Senin..6=Minggu)
  - latest_check_in = start_time + 5 menit (toleransi)
  - crosses_midnight = true untuk shift ML (malam)
- Tabel employee_schedules: (user_id, date, shift_code) — UNIQUE(user_id, date)
- Tabel attendance: shift_code (existing), schedule_match (boolean)

## Halaman & Route
- /admin/schedules → SchedulingPage (kalender bulanan + upload Excel)
- /admin/settings → PengaturanPage (tab "Kelola Shift" untuk edit shift_schedules)
- AttendancePage → otomatis baca shift dari employee_schedules & hitung terlambat

## Progress & Rencana — Session Juli 2026

### Done
- Fix React error #310 (blank screen): `UpdateDialog.jsx` — useEffect cleanup ditempatkan setelah early return. Hook count mismatch (11 vs 12 hooks).
- Fix OOM Gradle: `android/gradle.properties` — `org.gradle.jvmargs=-Xmx2048m`
- Bump version: `updateService.js` → `CURRENT_VERSION="1.6.6"`, `CURRENT_VERSION_CODE=18`
- Deploy Vercel: https://siap-ampenan.vercel.app
- Remember Me & Biometric UI: checkbox "Ingat Saya" + "Gunakan Sidik Jari" (APK only)

### Blankscreen Cause (sept 7 juli)
- Bukan dari dynamic import storageService (seperti yang diduga sebelumnya)
- Penyebab: `UpdateDialog.jsx` — `useEffect` cleanup `fallbackTimerRef` di line 98 (original), setelah early return `if (!update) return null` di line 40. Render pertama 11 hooks, render kedua 12 hooks → React error #310.

### Storage Service Strategy
- Web: localStorage (fallback)
- Native APK: `@capacitor/preferences` (Keychain/Keystore) + `@aparajita/capacitor-biometric-auth`
- Dynamic import dengan try/catch, jika gagal → fallback localStorage + mock
- `authenticateBiometric()` di native: panggil BiometricAuth.authenticate()
- `authenticateBiometric()` di web: return true (skip, tidak ada biometric di web)

### Next (setelah APK build)
1. Testing APK — remember me & biometric benar-benar berfungsi
2. Jika icon fingerprint diinginkan: ganti `ShieldCheck` dengan `ScanFace` atau custom SVG

### Notes
- `Fingerprint` icon tidak ada di lucide-react v1.18.0
- Ikon sidik jari di dialog biometric berasal dari sistem OS (Android/iOS), bukan dari aplikasi
- Biometric hanya untuk APK native (`isNativePlatform() === true`)
- Pendaftaran sidik jari dilakukan di Settings HP, bukan di aplikasi
- Face ID (tanpa tombol): lihat ke layar
- Touch ID (tombol home): tempel jari ke tombol bundar
