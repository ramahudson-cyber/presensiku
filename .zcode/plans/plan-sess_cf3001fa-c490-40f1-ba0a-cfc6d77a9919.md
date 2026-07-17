**Masalah:** Header grid 4 kolom (`60px 40px 40px 55px`) vs tl-item 5 kolom (`8px 60px 40px 40px 55px`). Tanggal header mulai di posisi 0, tanggal data di posisi 16px — tidak sejajar. Juga masih ada space kosong di kanan.

**Fix:**
1. `.tl-item` CSS: `8px 60px 40px 40px 55px` → `8px 60px 40px 40px 1fr` (status isi sisa space)
2. Header inline: `60px 40px 40px 55px` → `8px 60px 40px 40px 1fr` + tambah `<div></div>` untuk kolom dot
3. Semua header label tetap `text-align:center`

Hasil: header & data sejajar sempurna. Kolom STATUS isi space kosong di kanan.