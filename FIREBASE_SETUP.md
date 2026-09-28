# Setup Firebase Cloud Messaging (FCM) — Push Notification Gratis

Panduan ini membuat notifikasi **masuk ke HP pegawai bahkan saat aplikasi ditutup total**.
Biaya: **gratis** (FCM unlimited untuk notifikasi).

---

## Langkah 1 — Buat Project Firebase (±5 menit)

1. Buka https://console.firebase.google.com dan login dengan akun Google
2. Klik **"Add project" / "Tambahkan project"**
3. Nama project: bebas (contoh: `presensiku`)
4. Google Analytics: **boleh dimatikan** (tidak diperlukan)
5. Klik **Create project**

## Langkah 2 — Daftarkan Aplikasi Android

1. Di dashboard project Firebase, klik ikon **Android** (robot hijau) untuk menambah aplikasi
2. Isi **Android package name** (HARUS persis sama):
   ```
   com.presensiku.app
   ```
3. Nama aplikasi: `Presensiku` (bebas)
4. Klik **Register app**
5. Klik **Download google-services.json**
6. Salin file tersebut ke:
   ```
   android/app/google-services.json
   ```
7. Klik **Next → Next → Continue to console** (langkah gradle sudah otomatis di proyek ini)

## Langkah 3 — Ambil Service Account (untuk server mengirim push)

1. Di Firebase Console, klik ikon **⚙️ gear** → **Project settings**
2. Tab **Service accounts**
3. Klik **Generate new private key** → **Generate key**
4. File JSON akan terunduh (contoh: `presensiku-xxxxx-firebase-adminsdk.json`)

## Langkah 4 — Pasang Secret di Supabase

Jalankan di terminal (di folder proyek), ganti nama file sesuai milik Anda:

```bash
supabase secrets set FIREBASE_SERVICE_ACCOUNT="$(cat presensiku-xxxxx-firebase-adminsdk.json)"
```

> Kalau perintah di atas gagal di Windows Git Bash, alternatif: buka
> https://supabase.com/dashboard/project/muhxylbcgvwxjzrbkgdc/settings/functions
> → **Add new secret** → Name: `FIREBASE_SERVICE_ACCOUNT`, Value: **seluruh isi** file JSON service account.

## Langkah 5 — Deploy Edge Function

```bash
supabase functions deploy send-push --project-ref muhxylbcgvwxjzrbkgdc
```

## Langkah 6 — Terapkan Migration Database

```bash
supabase db push --linked
```

Migration `20260928010000_device_tokens.sql` membuat tabel `device_tokens` dan mengaktifkan realtime untuk pengumuman.

## Langkah 7 — Build APK

```bash
npm run build
npx cap sync android
```

Lalu build APK seperti biasa. Saat pegawai pertama kali membuka aplikasi:
- Muncul dialog izin notifikasi Android → **Izinkan**
- Token perangkat otomatis tersimpan ke tabel `device_tokens`

> ⚠️ **Catatan penting:** Package name APK sudah diubah dari `com.puskesmas.ampenan.siap` menjadi
> `com.presensiku.app`. APK lama yang masih terpasang **tidak bisa di-update langsung** — pegawai
> harus **uninstall aplikasi lama** terlebih dahulu, lalu install APK baru, dan login ulang.
> Ini berlaku sekali saja.

---

## Cara Kerja

| Kondisi | Mekanisme |
|---------|-----------|
| Admin publish pengumuman | Admin page → Edge Function `send-push` → FCM → notifikasi muncul di HP semua pegawai instansi (app ditutup sekalipun) |
| 15 menit sebelum shift mulai | Notifikasi lokal Android (AlarmManager) — tetap bunyi walau app ditutup |
| 15 menit sebelum shift selesai | Notifikasi lokal Android — sama seperti di atas |
| App terbuka | Supabase Realtime — pengumuman baru tampil detik itu juga di dashboard |

## Troubleshooting

- **Tidak ada notifikasi sama sekali** → pastikan `android/app/google-services.json` ada, lalu build ulang APK
- **Notifikasi masuk tapi cuma saat app terbuka** → cek izin notifikasi di Settings HP → Presensiku → Notifications → Allow
- **Edge function error 503** → secret `FIREBASE_SERVICE_ACCOUNT` belum diset (Langkah 4)
- **Edge function error 401/403** → pastikan yang memicu push adalah akun admin/super_admin yang sedang login
- **Token lama menumpuk** → otomatis dibersihkan: FCM menandai token invalid, Edge Function menghapusnya dari `device_tokens`
