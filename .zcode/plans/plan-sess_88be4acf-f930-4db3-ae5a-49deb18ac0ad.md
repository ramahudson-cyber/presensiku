## Perbaikan Dokumentasi untuk AI Coding Maksimal

### Masalah Saat Ini
1. **AGENTS.md** — tercampur antara "aturan tetap" (shift, role, database) dan "progress session" (bisa kadaluwarsa)
2. **CONTEXT_THIS_SESSION.md** — terlalu tipis, cuma catatan sesi lama
3. **PLAN.md** — masih ada yang belum di-update (Izin/Sakit sudah selesai, tapi PLAN.md belum)

### Perubahan

#### 1. Rapikan AGENTS.md
- Pisahkan section "Progress" ke file terpisah
- Bagian atas tetap: aturan shift, role, database, route, preview workflow
- Progress & rencana pindah ke `AI-NOTES.md`

#### 2. Buat `AI-NOTES.md`
Berisi progress terkini yang selalu perlu AI tau:
- ✅ Izin/Sakit selesai, tinggal run SQL
- ❌ Enum belum ditambah 'izin', service key expired
- ✅ Dashboard dark-glass selesai, testing APK belum
- ✅ Update Dialog fix, OOM fix, version bump, deploy Vercel
- ✅ Remember Me & Biometric UI
- ⏳ WebAuthn (rencana)

Setiap selesai tugas → bilang "catat progress" → saya update file ini.

#### 3. Update `CONTEXT_THIS_SESSION.md`
- Tambahkan info Izin/Sakit
- Tambahkan status terbaru
- Tambahkan cara pakai AI-NOTES.md

#### 4. Update `PLAN.md`
- Tandai Izin/Sakit sebagai DONE (sebelumnya tidak ada di PLAN.md)

### Hasil Akhir
| File | Isi | Kapan diubah |
|------|-----|--------------|
| `AGENTS.md` | Aturan project (shift, role, database, route) | Jarang |
| `AI-NOTES.md` | Progress terkini, catatan penting | Setiap selesai tugas |
| `PLAN.md` | Execution plan lengkap | Setiap task baru |
| `CONTEXT_THIS_SESSION.md` | Ringkasan sesi | Otomatis saat update |
| `PRD.md` | Specs fitur (tidak berubah) | Sangat jarang |
| `DESIGN.md` | Design system (tidak berubah) | Sangat jarang |