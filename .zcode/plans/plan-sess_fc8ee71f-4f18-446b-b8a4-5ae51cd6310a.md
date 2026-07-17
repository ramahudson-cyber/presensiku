## Plan: Hapus gradient strip + perjelas teks card

### 1. Hapus gradient strip
File: `src/pages/employee/EmployeeDashboard.jsx` baris 104
Hapus:
```jsx
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#BF00FF] to-transparent"></div>
```

### 2. Naikkan opacity teks di card (light & dark)
File: `src/pages/employee/EmployeeDashboard.jsx`
Semua perubahan di dalam card wrapper (`bg-white/5 backdrop-blur-md ... rounded-3xl`):

| Baris | Teks | Sekarang | Jadi |
|-------|------|----------|------|
| 105 | "Status Hari Ini" | `opacity-40` | `opacity-70` |
| 109 | "Masuk" | `opacity-60` | `opacity-80` |
| 115 | "--:--" | `opacity-40` | `opacity-60` |
| 118 | "Pulang" | `opacity-60` | `opacity-80` |
| 124 | "Belum Absen" | `opacity-40` | `opacity-60` |
| 130 | "Statistik Bulan Ini" | `opacity-40` | `opacity-70` |
| 135 | labels (Hadir, Izin…) | `opacity-50` | `opacity-70` |
| 142 | "Riwayat Absensi" | `opacity-40` | `opacity-70` |
| 143 | header kolom (Tanggal…) | `opacity-40` | `opacity-70` |
| 156 | "Shift" | `opacity-40` | `opacity-60` |
| 168 | "Belum ada riwayat." | `opacity-60` | `opacity-80` |
| 173 | "Pengumuman" | `opacity-40` | `opacity-70` |
| 178 | konten pengumuman | `opacity-60` | `opacity-80` |
| 180 | "Tidak ada pengumuman." | `opacity-60` | `opacity-80` |

Total: 14 perubahan opacity + 1 hapus baris
