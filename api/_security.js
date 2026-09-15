// api/_security.js — guard bersama untuk endpoint email/OTP.
// Serverless = penyimpanan per-instance, jadi rate limit bersifat best-effort:
// cukup memperlambat abuse massal, bukan pengganti WAF.
// Origin yang sah: production/preview Vercel + dev lokal + Capacitor WebView.

const ALLOWED_ORIGIN_RE =
  /^(https:\/\/([a-z0-9-]+\.)*vercel\.app|https?:\/\/localhost(:\d+)?|https?:\/\/127\.0\.0\.1(:\d+)?|capacitor:\/\/localhost)$/i;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Gelas pencacah lintas-permintaan dalam satu instance: { ip, ts }
let buckets = [];

/** @returns {string|null} pesan error, atau null bila request boleh lanjut */
export function guardRequest(req) {
  // 1. Origin browser wajib dikenal; request non-browser (tanpa header Origin)
  //    tetap boleh lewat tetapi ikut dibatasi rate limit di bawah.
  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGIN_RE.test(origin)) {
    return "Origin tidak diizinkan";
  }

  // 2. Rate limit per IP (best-effort antar-instance): 8 request / menit.
  const ip =
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.headers["x-real-ip"] ||
    "unknown";
  const now = Date.now();
  const WINDOW_MS = 60_000;
  const LIMIT = 8;

  buckets = buckets.filter((b) => now - b.ts < WINDOW_MS);
  const hits = buckets.filter((b) => b.ip === ip).length;
  if (hits >= LIMIT) {
    return "Terlalu banyak permintaan, coba lagi sebentar";
  }
  buckets.push({ ip, ts: now });
  if (buckets.length > 5000) buckets.splice(0, buckets.length - 5000);

  return null;
}

export function isValidEmail(value) {
  return typeof value === "string" && value.length <= 254 && EMAIL_RE.test(value);
}

export function isValidOtp(value) {
  return typeof value === "string" && /^\d{6}$/.test(value);
}

/** Potong & buang markup — input masuk ke template HTML email. */
export function safeText(value, maxLen = 120) {
  if (typeof value !== "string") return "";
  return value
    .replace(/[<>&"]/g, "")
    .slice(0, maxLen)
    .trim();
}
