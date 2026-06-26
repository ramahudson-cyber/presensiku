# Sistem Shift & Penjadwalan

## Ringkasan
Sistem shift untuk Puskesmas Ampenan dengan 4 jenis shift, penjadwalan bulanan oleh admin via Excel, dan absensi otomatis tanpa pilih shift.

## Database Design

### Tabel: shifts
| Column | Type | Keterangan |
|--------|------|------------|
| id | UUID PK | |
| code | TEXT UNIQUE | pagi, poli_sore, siang, malam |
| name | TEXT | Shift Pagi, Shift Poli Sore, dll |
| sort_order | INTEGER | Urutan tampilan |
| created_at | TIMESTAMPTZ | |

### Tabel: shift_schedules
Menyimpan jadwal tetap per shift berdasarkan hari dalam seminggu.

| Column | Type | Keterangan |
|--------|------|------------|
| id | UUID PK | |
| shift_id | UUID FK → shifts | |
| day_of_week | INTEGER | 0=Senin, 1=Selasa, ..., 6=Minggu |
| start_time | TIME | Jam mulai shift (WITA) |
| end_time | TIME | Jam selesai shift (WITA) |
| is_off | BOOLEAN | True jika libur |
| created_at | TIMESTAMPTZ | |

### Tabel: employee_schedules
Menyimpan jadwal bulanan pegawai.

| Column | Type | Keterangan |
|--------|------|------------|
| id | UUID PK | |
| user_id | UUID FK → profiles | |
| date | DATE | Tanggal (WITA) |
| shift_id | UUID FK → shifts | |
| is_manual_override | BOOLEAN | True jika diubah manual oleh admin |
| override_reason | TEXT | Alasan perubahan |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**Unique constraint:** (user_id, date)

### Tabel: attendance (perubahan)
Tambahkan kolom:
| Column | Type | Keterangan |
|--------|------|------------|
| shift_id | UUID FK → shifts | Shift yang digunakan saat absen |
| schedule_match | BOOLEAN | Apakah sesuai jadwal (true) atau manual override (false) |

## Fitur Aplikasi

### 1. Manajemen Shift (Super Admin/Admin Puskesmas)
- CRUD shift (Pengaturan → Kelola Shift)
- Lihat jadwal per shift dalam format tabel

### 2. Penjadwalan Bulanan
- Halaman: /admin/scheduling
- Input manual via kalender (drag/click)
- Upload Excel dengan format template
- Copy jadwal minggu ke minggu

### 3. Absensi
- Saat pegawai absen, sistem otomatis:
  1. Ambil jadwal dari employee_schedules untuk user_id + hari ini
  2. Tentukan jam mulai dari shift_schedules (berdasarkan hari)
  3. Hitung keterlambatan (toleransi 5 menit)
  4. Untuk shift malam: record 1 (masuk 20:00) dan record 2 (keluar 07:00)
- Jika tidak ada jadwal, tampilkan warning ke pegawai

### 4. Upload Excel
Format kolom:
| NIP | Tanggal | Shift |
|-----|---------|-------|
| 198804122015031002 | 01/06/2026 | pagi |
| 198804122015031002 | 02/06/2026 | siang |
