// src/lib/shiftName.js
// Satu sumber label nama shift untuk seluruh UI.
//
// Latar belakang: kode shift bisa berbeda antar instansi. Instansi di
// produksi memakai kode "SNG" untuk shift Siang (bukan "SI"), sehingga
// peta hardcoded lama (PG/SR/SI/ML) gagal dan UI menampilkan kode mentah
// "SNG" — padahal nama di tabel `shifts` sudah "siang".
//
// Aturan prioritas:
//   1. Nama dari master DB (tabel shifts) — selalu menang, mendukung kode kustom
//   2. Alias kode umum (termasuk SNG) sebagai cadangan
//   3. Kode asli sebagai upaya terakhir
export const SHIFT_ALIASES = {
  PG: "Pagi",
  SR: "Sore",
  SG: "Siang",
  SNG: "Siang",
  SI: "Siang",
  ML: "Malam",
  MLM: "Malam",
  LB: "Libur",
};

const capitalize = (s) => {
  const t = String(s || "").trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "";
};

/**
 * Label shift yang aman ditampilkan.
 * @param {string} code  kode shift, mis. "SNG"
 * @param {string} [dbName] nama dari tabel shifts (opsional, diprioritaskan)
 */
export function shiftLabel(code, dbName) {
  if (!code) return "";
  const fromDb = capitalize(dbName);
  if (fromDb) return fromDb;
  return SHIFT_ALIASES[code] || code;
}

/** Label dengan awalan "Shift " (dipakai badge & notifikasi). */
export function shiftLabelPrefixed(code, dbName) {
  const label = shiftLabel(code, dbName);
  if (!label) return "";
  return /^shift\b/i.test(label) ? label : `Shift ${label}`;
}

export default shiftLabel;
