**Masalah:** Background gradien baru di body tidak terlihat karena komponen `EmployeeDashboard.jsx` punya `bg-[#060311]` pada div utama yang menutupi seluruh layar.

**Perbaikan:**
1. Ganti `bg-[#060311]` jadi `bg-transparent` di 2 tempat di `EmployeeDashboard.jsx`:
   - Loading state (line 40): `fixed inset-0 bg-[#060311]` → `bg-transparent`
   - Main wrapper (line 70): `min-h-screen w-full bg-[#060311]` → `bg-transparent`
2. Juga cek apakah ada komponen `AdminLayout.jsx` atau layout lain yang punya bg hitam serupa.
3. Commit, push, deploy ke Vercel.