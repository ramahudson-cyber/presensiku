### Rencana Implementasi Dashboard Premium

1.  **Analisis Data Binding**:
    *   Saya telah mengidentifikasi bahwa `EmployeeDashboard.jsx` mengambil data real dari `supabase` (attendance, stats, history, announcements) dan `AuthContext` (user profile).
    *   Saya akan memastikan semua variabel (seperti `fullName`, `role`, `greeting`, `stats`, `history`) dipetakan dengan benar ke struktur *glassmorphism* baru yang telah disetujui di `preview_dashboard_final_v2.html`.

2.  **Langkah Implementasi**:
    *   **Edit Impor**: Menambahkan ikon yang diperlukan dari `lucide-react` (seperti `ScanFace`, `LogOut`, dll. jika diperlukan).
    *   **Struktur UI**: Mengganti markup statis di `EmployeeDashboard.jsx` dengan komponen *glassmorphism* yang sudah dirancang.
    *   **Data Binding**: Memastikan data dinamis (`todayAttendance`, `stats`, `history`, `announcements`) masuk ke tempat yang tepat dalam struktur UI baru.
    *   **Pembersihan**: Menghapus sisa kode yang sudah tidak terpakai (seperti data dummy jika masih ada) agar kode bersih.

3.  **Verifikasi & Push**:
    *   Mengecek kembali `EmployeeDashboard.jsx` setelah diedit untuk memastikan tidak ada *blank screen* (memastikan `useEffect` cleanup).
    *   Commit perubahan ke *branch* utama (`main`) dan lakukan *push* ke repository live.

4.  **Finalisasi**: Meminta konfirmasi akhir setelah perubahan diterapkan sebelum *push* akhir.