import nodemailer from 'nodemailer';
import { guardRequest, isValidEmail, safeText } from './_security.js';

export default async function handler(req, res) {
  // CORS headers — dibutuhkan oleh Capacitor APK (origin http://localhost)
  const origin = req.headers.origin || req.headers.host || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const blocked = guardRequest(req);
  if (blocked) {
    return res.status(429).json({ error: blocked });
  }

  const { to, username, full_name, password, org_name } = req.body;
  if (!isValidEmail(to) || !username || !full_name) {
    return res.status(400).json({ error: "Penerima tidak valid atau field wajib kosong" });
  }
  const safeFullName = safeText(full_name, 80);
  const safeUsername = safeText(username, 60);
  const safePassword = safeText(password, 64);

  // Branding multi-tenant: nama instansi dari pemanggil (fallback nama app)
  const ORG_LABEL = safeText(org_name, 60) || "Presensiku";

  // Link login: HANYA origin vercel.app resmi / dev lokal — cegah tautan
  // phishing dari origin asing. Fallback ke produksi resmi.
  const rawOrigin = req.headers.origin || "";
  const SAFE_APP_ORIGIN = /^https:\/\/([a-z0-9-]+\.)*vercel\.app$|^https?:\/\/localhost(:\d+)?$/i;
  const APP_URL = SAFE_APP_ORIGIN.test(rawOrigin)
    ? rawOrigin
    : "https://presensiku-beige.vercel.app";

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp-relay.brevo.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: false,
    auth: {
      user: process.env.SMTP_LOGIN,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  // Dark-mode-proof email HTML: meta color-scheme mencegah "smart invert"
  // aplikasi email membalik teks putih jadi gelap; background-color solid
  // (bukan hanya gradient) menjamin banner & tombol tetap berlatar di client
  // yang tidak mendukung gradient; semua warna teks hex solid tanpa alpha.
  const html = `<!DOCTYPE html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"></head>
<body style="margin:0; padding:0; background-color:#0f0214;">
    <div style="font-family: Inter, Arial, sans-serif; max-width: 480px; margin: 0 auto; background-color: #0f0214; border-radius: 16px; overflow: hidden; border: 1px solid #2a1747;">
      <div bgcolor="#0f0214" style="padding: 32px 24px; text-align: center; background-color: #0f0214; background-image: linear-gradient(135deg, #0f0214, #1a0533);">
        <h1 style="color: #ffffff; font-size: 22px; margin: 0 0 4px;">${ORG_LABEL}</h1>
        <p style="color: #b9b3c7; font-size: 13px; margin: 0;">Sistem Informasi Administrasi & Presensi</p>
      </div>
      <div bgcolor="#1a0a35" style="padding: 24px; background-color: #1a0a35;">
        <p style="color: #ffffff; font-size: 14px; margin: 0 0 16px;">Yth. <strong>${safeFullName}</strong>,</p>
        <p style="color: #cfc9dd; font-size: 13px; margin: 0 0 20px; line-height: 1.6;">
          Akun Presensiku Anda telah dibuat. Silakan login dengan kredensial berikut:
        </p>
        <div bgcolor="#2d0a4e" style="background-color: #2d0a4e; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="color: #a49db8; font-size: 12px; padding: 6px 0;">Username</td>
              <td style="color: #ffffff; font-size: 14px; padding: 6px 0; text-align: right; font-weight: 600;">${safeUsername}</td>
            </tr>
            <tr>
              <td style="color: #a49db8; font-size: 12px; padding: 6px 0;">Password</td>
              <td style="color: #a78bfa; font-size: 14px; padding: 6px 0; text-align: right; font-weight: 600;">${safePassword || 'Puskesmas@123'}</td>
            </tr>
          </table>
        </div>
        <a href="${APP_URL}" bgcolor="#8b5cf6" style="display: block; text-align: center; background-color: #8b5cf6; color: #ffffff; text-decoration: none; padding: 12px; border-radius: 12px; font-size: 14px; font-weight: 600; margin-bottom: 16px;">
          Buka ${ORG_LABEL}
        </a>
        <p style="color: #a49db8; font-size: 11px; margin: 0; line-height: 1.5;">
          Setelah login, Anda akan diminta mengganti password untuk keamanan akun Anda.
        </p>
      </div>
    </div>
</body>
</html>`;

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || `"Presensiku" <RAMAHUDSON@GMAIL.COM>`,
      to,
      subject: `Akun ${ORG_LABEL}`,
      html,
    });

    return res.status(200).json({ success: true, id: info.messageId });
  } catch (err) {
    console.error("Send email error:", err);
    return res.status(500).json({ error: err.message });
  }
}
