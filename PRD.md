# Product Requirement Document (PRD): SIAP Ampenan

## 1. Pendahuluan
SIAP Ampenan (Sistem Informasi Absensi Pegawai) adalah aplikasi berbasis web dan mobile yang dirancang untuk mendigitalkan dan mengelola proses absensi pegawai di Puskesmas Ampenan. Aplikasi ini bertujuan untuk menggantikan sistem manual, meningkatkan akurasi data, dan mempermudah pemantauan kehadiran.

## 2. Tujuan & Latar Belakang
- **Tujuan Utama**: Menyediakan platform yang efisien, akurat, dan real-time untuk absensi pegawai.
- **Masalah yang Diselesaikan**:
    - Kesulitan dalam merekap data absensi manual.
    - Kurangnya pemantauan kehadiran pegawai secara langsung.
    - Keterbatasan absensi yang harus dilakukan di satu lokasi fisik.
- **Target Pengguna**:
    - **Admin**: Staf Tata Usaha atau Kepegawaian yang mengelola data.
    - **Pegawai**: Seluruh staf Puskesmas Ampenan.

## 3. Ruang Lingkup & Fitur Utama

### 3.1. Fitur untuk Pegawai (PWA — Android & iOS)

#### 3.1.1. Navigasi Utama
Empat menu utama di bottom navigation bar:
- **Home**: Dashboard ringkasan kehadiran.
- **Profil**: Informasi akun pegawai.
- **Presensi**: Tombol floating utama untuk absen masuk/pulang.
- **Riwayat**: Halaman riwayat absensi lengkap (terpisah dari dashboard).

#### 3.1.2. Autentikasi
- Login menggunakan NIP/Username dan Password.
- Fitur "Lupa Password" dengan verifikasi OTP (via Email/WhatsApp).
- Remember Me & Biometric (Sidik Jari/Face ID) untuk perangkat native.

#### 3.1.3. Dashboard (Menu Home)
- **Hero Section**: Jam real-time (waktu server WITA), tanggal, shift hari ini.
- **Status Hari Ini**: Card Masuk & Pulang, status terlambat + menit keterlambatan.
- **Statistik Bulan Ini**: Progress bar kehadiran (Hadir/Izin/Sakit/Alpha).
- **Riwayat Absensi**: 5 riwayat terakhir (pratinjau).
- **Pengumuman**: Notifikasi dari admin.

#### 3.1.4. Halaman Profil
- Foto profil, nama lengkap, email, role.
- Informasi akun (username, NIP).
- Tombol logout.

#### 3.1.5. Proses Absensi
- Validasi lokasi menggunakan GPS (radius puskesmas).
- Verifikasi perangkat (IMEI/Device ID) untuk mencegah pemalsuan.
- Anti Fake GPS detection (akurasi & altitude heuristik).

#### 3.1.6. Halaman Riwayat
- Tabel riwayat absensi: Tanggal, Jam Masuk, Jam Pulang, Status.
- Filter berdasarkan bulan/tahun.
- Status: Hadir, Terlambat (dengan menit), Izin, Sakit, Alpha.

#### 3.1.7. Jadwal Shift
- Lihat jadwal kerja bulanan (kalender).
- Shift: Pagi, Sore, Siang, Malam.

#### 3.1.8. Notifikasi & Update
- Pemberitahuan update aplikasi jika versi baru tersedia.
- Update otomatis via service worker (PWA).

### 3.2. Fitur untuk Admin (Aplikasi Web)
- **Dashboard Admin**:
    - Menampilkan ringkasan statistik kehadiran secara real-time.
- **Manajemen Pegawai**:
    - Tambah, Edit, dan Hapus data pegawai.
- **Manajemen Jadwal & Shift**:
    - Membuat, mengatur, dan menetapkan jadwal kerja dan shift untuk pegawai.
- **Manajemen Lokasi Absensi**:
    - Menentukan titik koordinat lokasi di mana absensi dapat dilakukan.
- **Pengumuman**:
    - Membuat, mengedit, dan menghapus pengumuman yang tampil di dashboard pegawai.
- **Laporan Absensi**:
    - Melihat dan mengekspor laporan kehadiran pegawai dalam rentang waktu tertentu (harian, mingguan, bulanan).

## 4. Requirements Non-Fungsional
- **Platform**:
    - **Admin**: Aplikasi Web yang responsif.
    - **Pegawai**: PWA (Progressive Web App) — kompatibel Android & iOS.
    - iOS特定: Meta tag `apple-mobile-web-app-capable`, `apple-touch-icon`, `viewport-fit=cover` untuk full-screen PWA.
- **Keamanan**:
    - Binding perangkat (Device Binding) untuk memastikan satu pegawai hanya bisa login dari satu perangkat terdaftar.
    - Enkripsi data sensitif dan penggunaan Supabase RLS (Row Level Security).
- **Performa**:
    - Aplikasi harus dapat merespon dengan cepat, terutama saat proses absensi.

## 5. Asumsi
- Pegawai menggunakan smartphone Android atau iOS dengan browser modern yang mendukung PWA.
- Koneksi internet tersedia di lokasi absensi.
- iOS PWA memerlukan Safari dan pengguna menambahkan ke layar utama ("Add to Home Screen") untuk pengalaman full-screen.

---
*Dokumen ini adalah versi awal dan dapat diperbarui seiring dengan perkembangan proyek.*
