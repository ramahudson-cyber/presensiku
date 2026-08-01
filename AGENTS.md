# Konfigurasi Proyek — Hadir.Kuy

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

## Preview Workflow
- Sebelum commit perubahan UI, buat preview HTML dulu, buka via `Invoke-Item`
- Tunggu approval user sebelum commit & push

### Notes
- `Fingerprint` icon tidak ada di lucide-react v1.18.0
- Ikon sidik jari di dialog biometric berasal dari sistem OS (Android/iOS), bukan dari aplikasi
- Biometric hanya untuk APK native (`isNativePlatform() === true`)
- Pendaftaran sidik jari dilakukan di Settings HP, bukan di aplikasi
- Face ID (tanpa tombol): lihat ke layar
- Touch ID (tombol home): tempel jari ke tombol bundar

## ⚠️ TARGET DEPLOYMENT — HARUS DIPAKAI
- **URL live:** `https://presensiku-beige.vercel.app`
- **Project name di Vercel:** `presensiku-beige`
- **CI secret `VERCEL_PROJECT_ID`** harus mengarah ke project **presensiku-beige**
- ❌ **JANGAN deploy ke `presensiku.vercel.app`** — itu project lama yang sudah tidak dipakai
- ✅ Setelah `git push`, pastikan CI deploying ke `presensiku-beige` (cek via `gh run` / log CI)

## Progress & Catatan
Untuk detail progress terkini dan catatan penting, lihat:
- **AI-NOTES.md** — progress terbaru yang perlu AI tau sebelum mulai kerja
- **PLAN.md** — execution plan lengkap semua task
