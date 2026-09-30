import nodemailer from 'nodemailer';
import { guardRequest, isValidEmail, isValidOtp, safeText } from './_security.js';

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

  const { email, otp, name } = req.body;
  if (!isValidEmail(email) || !isValidOtp(otp)) {
    return res.status(400).json({ error: "Email atau format kode tidak valid" });
  }
  const safeName = safeText(name, 80);

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
  // (bukan hanya gradient) menjamin banner tetap berlatar gelap di client
  // yang tidak mendukung gradient; semua warna teks hex solid tanpa alpha.
  const html = `<!DOCTYPE html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"></head>
<body style="margin:0; padding:0; background-color:#0f0214;">
    <div style="font-family: Inter, Arial, sans-serif; max-width: 480px; margin: 0 auto; background-color: #0f0214; border-radius: 16px; overflow: hidden; border: 1px solid #2a1747;">
      <div bgcolor="#0f0214" style="padding: 32px 24px; text-align: center; background-color: #0f0214; background-image: linear-gradient(135deg, #0f0214, #1a0533);">
        <h1 style="color: #ffffff; font-size: 22px; margin: 0 0 4px;">Presensiku</h1>
        <p style="color: #b9b3c7; font-size: 13px; margin: 0;">Verifikasi Perangkat</p>
      </div>
      <div bgcolor="#1a0a35" style="padding: 24px; background-color: #1a0a35;">
          <p style="color: #ffffff; font-size: 14px; margin: 0 0 16px;">Yth. <strong>${safeName || email}</strong>,</p>
        <p style="color: #cfc9dd; font-size: 13px; margin: 0 0 20px; line-height: 1.6;">
          Masukkan kode OTP berikut untuk memverifikasi perangkat Anda:
        </p>
        <div bgcolor="#2d0a4e" style="background-color: #2d0a4e; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 20px;">
          <span style="font-size: 36px; font-weight: 700; color: #a78bfa; letter-spacing: 8px;">${otp}</span>
        </div>
        <p style="color: #a49db8; font-size: 11px; margin: 0; line-height: 1.5;">
          Kode OTP berlaku selama 5 menit. Jangan bagikan kode ini kepada siapa pun.
        </p>
      </div>
      <div bgcolor="#0f0214" style="padding: 16px 24px; text-align: center; background-color: #0f0214;">
        <p style="color: #6b6480; font-size: 10px; margin: 0;">Presensiku &copy; ${new Date().getFullYear()}</p>
      </div>
    </div>
</body>
</html>`;

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || `"Presensiku" <RAMAHUDSON@GMAIL.COM>`,
      to: email,
      subject: "Kode OTP - Verifikasi Perangkat Presensiku",
      html,
    });

    return res.status(200).json({ success: true, id: info.messageId });
  } catch (err) {
    console.error("Send OTP error:", err);
    return res.status(500).json({ error: err.message });
  }
}
