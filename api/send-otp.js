import nodemailer from 'nodemailer';

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

  const { email, otp, name } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp-relay.brevo.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: false,
    auth: {
      user: process.env.SMTP_LOGIN,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  const html = `
    <div style="font-family: Inter, Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #0f0214; border-radius: 16px; overflow: hidden; border: 1px solid rgba(139,92,246,0.2);">
      <div style="padding: 32px 24px; text-align: center; background: linear-gradient(135deg, #0f0214, #1a0533);">
        <h1 style="color: #fff; font-size: 22px; margin: 0 0 4px;">SIAP Puskesmas Ampenan</h1>
        <p style="color: rgba(255,255,255,0.5); font-size: 13px; margin: 0;">Verifikasi Perangkat</p>
      </div>
      <div style="padding: 24px; background: #1a0a35;">
        <p style="color: #fff; font-size: 14px; margin: 0 0 16px;">Yth. <strong>${name || email}</strong>,</p>
        <p style="color: rgba(255,255,255,0.7); font-size: 13px; margin: 0 0 20px; line-height: 1.6;">
          Masukkan kode OTP berikut untuk memverifikasi perangkat Anda:
        </p>
        <div style="background: #2d0a4e; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 20px;">
          <span style="font-size: 36px; font-weight: 700; color: #a78bfa; letter-spacing: 8px;">${otp}</span>
        </div>
        <p style="color: rgba(255,255,255,0.4); font-size: 11px; margin: 0; line-height: 1.5;">
          Kode OTP berlaku selama 5 menit. Jangan bagikan kode ini kepada siapa pun.
        </p>
      </div>
      <div style="padding: 16px 24px; text-align: center; background: #0f0214;">
        <p style="color: rgba(255,255,255,0.2); font-size: 10px; margin: 0;">Puskesmas Ampenan &copy; ${new Date().getFullYear()}</p>
      </div>
    </div>
  `;

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || `"SIAP Puskesmas" <${process.env.SMTP_LOGIN}>`,
      to: email,
      subject: "Kode OTP - Verifikasi Perangkat SIAP",
      html,
    });

    return res.status(200).json({ success: true, id: info.messageId });
  } catch (err) {
    console.error("Send OTP error:", err);
    return res.status(500).json({ error: err.message });
  }
}
