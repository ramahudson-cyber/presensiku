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

  // Email tema terang sesuai DESIGN.md (biru brand #2F8BF8, kartu putih).
  // meta color-scheme "light" mencegah aplikasi email menginversi warna;
  // semua warna hex solid + bgcolor attribute agar konsisten di semua client.
  const html = `<!DOCTYPE html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"></head>
<body style="margin:0; padding:0; background-color:#F4F2FB;">
    <div style="font-family: Inter, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px 16px;">
      <div style="background-color: #FFFFFF; border-radius: 24px; overflow: hidden; border: 1px solid #E9EDF4;">
        <div bgcolor="#2F8BF8" style="padding: 32px 24px; text-align: center; background-color: #2F8BF8; background-image: linear-gradient(160deg, #39C0DF 0%, #32ACFB 30%, #3F93FD 62%, #4A7CFB 100%);">
          <h1 style="color: #ffffff; font-size: 22px; margin: 0 0 4px;">${ORG_LABEL}</h1>
          <p style="color: #dbeafe; font-size: 13px; margin: 0;">Sistem Informasi Administrasi & Presensi</p>
        </div>
        <div style="padding: 24px; background-color: #FFFFFF;">
          <p style="color: #0F172A; font-size: 14px; margin: 0 0 6px;">Yth. <strong>${safeFullName}</strong>,</p>
          <p style="color: #475569; font-size: 13px; margin: 0 0 20px; line-height: 1.6;">
            Akun Presensiku Anda telah dibuat. Silakan login dengan kredensial berikut:
          </p>
          <div bgcolor="#F8FAFD" style="background-color: #F8FAFD; border: 1px solid #E9EDF4; border-radius: 16px; padding: 16px; margin-bottom: 20px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="color: #94A3B8; font-size: 12px; padding: 6px 0;">Username</td>
                <td style="color: #0F172A; font-size: 14px; padding: 6px 0; text-align: right; font-weight: 700;">${safeUsername}</td>
              </tr>
              <tr>
                <td style="color: #94A3B8; font-size: 12px; padding: 6px 0; border-top: 1px solid #E9EDF4;">Password</td>
                <td style="color: #1F74E0; font-size: 14px; padding: 6px 0; text-align: right; font-weight: 700; border-top: 1px solid #E9EDF4;">${safePassword || 'Puskesmas@123'}</td>
              </tr>
            </table>
          </div>
          <a href="${APP_URL}" bgcolor="#2F8BF8" style="display: block; text-align: center; background-color: #2F8BF8; background-image: linear-gradient(135deg, #2F8BF8 0%, #1F74E0 100%); color: #ffffff; text-decoration: none; padding: 14px; border-radius: 16px; font-size: 14px; font-weight: 700; margin-bottom: 16px;">
            Buka ${ORG_LABEL}
          </a>
          <div bgcolor="#FFFBEB" style="background-color: #FFFBEB; border: 1px solid #FEF3C7; border-radius: 14px; padding: 12px 14px;">
            <p style="color: #92400E; font-size: 11.5px; margin: 0; line-height: 1.55;">
              <strong style="color: #0F172A;">Penting:</strong> setelah login pertama, Anda akan diminta mengganti password untuk keamanan akun Anda.
            </p>
          </div>
        </div>
        <div bgcolor="#F4F2FB" style="padding: 16px 24px; text-align: center; background-color: #F4F2FB; border-top: 1px solid #E9EDF4;">
          <p style="color: #94A3B8; font-size: 10px; margin: 0;">${ORG_LABEL} &copy; ${new Date().getFullYear()}</p>
        </div>
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
