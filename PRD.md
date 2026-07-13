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

### 3.1. Fitur untuk Pegawai (Aplikasi Mobile - Android)
- **Autentikasi**:
    - Login menggunakan NIP dan Password.
    - Fitur "Lupa Password" dengan verifikasi OTP (via Email/WhatsApp).
- **Dashboard Pegawai**:
    - Menampilkan jadwal kerja hari ini.
    - Tombol untuk melakukan Absensi Masuk dan Pulang.
- **Proses Absensi**:
    - Validasi lokasi menggunakan GPS (hanya bisa absensi di lokasi yang telah ditentukan).
    - Verifikasi perangkat menggunakan IMEI untuk mencegah absensi melalui perangkat lain.
- **Riwayat Absensi**:
    - Melihat rekap histori absensi pribadi.
- **Notifikasi & Update**:
    - Pemberitahuan untuk melakukan update aplikasi jika versi baru tersedia.

### 3.2. Fitur untuk Admin (Aplikasi Web)
- **Dashboard Admin**:
    - Menampilkan ringkasan statistik kehadiran secara real-time.
- **Manajemen Pegawai**:
    - Tambah, Edit, dan Hapus data pegawai.
- **Manajemen Jadwal & Shift**:
    - Membuat, mengatur, dan menetapkan jadwal kerja dan shift untuk pegawai.
- **Manajemen Lokasi Absensi**:
    - Menentukan titik koordinat lokasi di mana absensi dapat dilakukan.
- **Laporan Absensi**:
    - Melihat dan mengekspor laporan kehadiran pegawai dalam rentang waktu tertentu (harian, mingguan, bulanan).

## 4. Requirements Non-Fungsional
- **Platform**:
    - **Admin**: Aplikasi Web yang responsif.
    - **Pegawai**: Aplikasi Mobile khusus Android.
- **Keamanan**:
    - Binding perangkat (Device Binding) untuk memastikan satu pegawai hanya bisa login dari satu perangkat terdaftar.
    - Enkripsi data sensitif dan penggunaan Supabase RLS (Row Level Security).
- **Performa**:
    - Aplikasi harus dapat merespon dengan cepat, terutama saat proses absensi.

## 5. Asumsi
- Semua pegawai memiliki smartphone Android.
- Koneksi internet tersedia di lokasi absensi.

---
*Dokumen ini adalah versi awal dan dapat diperbarui seiring dengan perkembangan proyek.*
