/**
 * Kompres gambar di sisi klien sebelum diunggah ke Supabase Storage.
 *
 * Alasan: setiap file yang disimpan di Supabase ikut dihitung pada kuota
 * storage, dan setiap kali ditampilkan ia diunduh ulang (egress). Foto asli
 * dari kamera HP bisa 1–2 MB padahal yang ditampilkan di aplikasi kecil.
 *
 * Fungsi ini mengembalikan File asli bila:
 *  - file bukan gambar,
 *  - browser tidak bisa membaca gambar (mis. format tak didukung),
 *  - hasil kompresi justru lebih besar dari aslinya.
 * Dengan begitu pemanggil tidak perlu menangani kegagalan khusus.
 *
 * @param {File} file
 * @param {{ maxSize?: number, quality?: number }} [opts]
 *   maxSize: sisi terpanjang dalam piksel (default 1024)
 *   quality: kualitas JPEG 0–1 (default 0.75)
 * @returns {Promise<File>}
 */
export async function compressImage(file, { maxSize = 1024, quality = 0.75 } = {}) {
  if (!file || !file.type?.startsWith("image/")) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
    if (bitmap.close) bitmap.close();

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    // Browser lama / format tidak terbaca: unggah apa adanya (perilaku lama).
    return file;
  }
}