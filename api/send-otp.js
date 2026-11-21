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

  // Email tema terang sesuai DESIGN.md (biru brand #2F8BF8, kartu putih).
  // meta color-scheme "light" mencegah aplikasi email menginversi warna;
  // semua warna hex solid + bgcolor attribute agar konsisten di semua client.
  const html = `<!DOCTYPE html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"></head>
<body style="margin:0; padding:0; background-color:#F4F2FB;">
    <div style="font-family: Inter, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px 16px;">
      <div style="background-color: #FFFFFF; border-radius: 24px; overflow: hidden; border: 1px solid #E9EDF4;">
        <div bgcolor="#2F8BF8" style="padding: 32px 24px; text-align: center; background-color: #2F8BF8; background-image: linear-gradient(160deg, #39C0DF 0%, #32ACFB 30%, #3F93FD 62%, #4A7CFB 100%);">
          <h1 style="color: #ffffff; font-size: 22px; margin: 0 0 4px;">Presensiku</h1>
          <p style="color: #dbeafe; font-size: 13px; margin: 0;">Verifikasi Perangkat</p>
        </div>
        <div style="padding: 24px; background-color: #FFFFFF;">
          <p style="color: #0F172A; font-size: 14px; margin: 0 0 6px;">Yth. <strong>${safeName || email}</strong>,</p>
          <p style="color: #475569; font-size: 13px; margin: 0 0 20px; line-height: 1.6;">
            Masukkan kode OTP berikut untuk memverifikasi perangkat Anda:
          </p>
          <div bgcolor="#EEF6FF" style="background-color: #EEF6FF; border: 1px solid #C9E3FC; border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 20px;">
            <span style="font-size: 36px; font-weight: 800; color: #1F74E0; letter-spacing: 8px;">${otp}</span>
          </div>
          <p style="color: #94A3B8; font-size: 11px; margin: 0; line-height: 1.5;">
            Kode OTP berlaku selama 5 menit. Jangan bagikan kode ini kepada siapa pun.
          </p>
        </div>
        <div bgcolor="#F4F2FB" style="padding: 16px 24px; text-align: center; background-color: #F4F2FB; border-top: 1px solid #E9EDF4;">
          <p style="color: #94A3B8; font-size: 10px; margin: 0;">Presensiku &copy; ${new Date().getFullYear()}</p>
        </div>
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
