export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { to, username, full_name, password } = req.body;
  if (!to || !username || !full_name) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const html = `
    <div style="font-family: Inter, Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #0f0214; border-radius: 16px; overflow: hidden; border: 1px solid rgba(139,92,246,0.2);">
      <div style="padding: 32px 24px; text-align: center; background: linear-gradient(135deg, #0f0214, #1a0533);">
        <h1 style="color: #fff; font-size: 22px; margin: 0 0 4px;">SIAP Puskesmas Ampenan</h1>
        <p style="color: rgba(255,255,255,0.5); font-size: 13px; margin: 0;">Sistem Informasi Administrasi & Presensi</p>
      </div>
      <div style="padding: 24px; background: #1a0a35;">
        <p style="color: #fff; font-size: 14px; margin: 0 0 16px;">Yth. <strong>${full_name}</strong>,</p>
        <p style="color: rgba(255,255,255,0.7); font-size: 13px; margin: 0 0 20px; line-height: 1.6;">
          Akun SIAP Anda telah dibuat. Silakan login dengan kredensial berikut:
        </p>
        <div style="background: #2d0a4e; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="color: rgba(255,255,255,0.4); font-size: 12px; padding: 6px 0;">Username</td>
              <td style="color: #fff; font-size: 14px; padding: 6px 0; text-align: right; font-weight: 600;">${username}</td>
            </tr>
            <tr>
              <td style="color: rgba(255,255,255,0.4); font-size: 12px; padding: 6px 0;">Password</td>
              <td style="color: #a78bfa; font-size: 14px; padding: 6px 0; text-align: right; font-weight: 600;">${password || 'Puskesmas@123'}</td>
            </tr>
          </table>
        </div>
        <a href="https://siap-ampenan.vercel.app" style="display: block; text-align: center; background: linear-gradient(135deg, #8b5cf6, #6d28d9); color: #fff; text-decoration: none; padding: 12px; border-radius: 12px; font-size: 14px; font-weight: 600; margin-bottom: 16px;">
          Buka SIAP
        </a>
        <p style="color: rgba(255,255,255,0.4); font-size: 11px; margin: 0; line-height: 1.5;">
          Setelah login, Anda akan diminta mengganti password untuk keamanan akun Anda.
        </p>
      </div>
      <div style="padding: 16px 24px; text-align: center; background: #0f0214;">
        <p style="color: rgba(255,255,255,0.2); font-size: 10px; margin: 0;">Puskesmas Ampenan &copy; ${new Date().getFullYear()}</p>
      </div>
    </div>
  `;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "SIAP Puskesmas <noreply@puskesmasampenan.com>",
        to: [to],
        subject: "Akun SIAP Puskesmas Ampenan",
        html,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Resend error:", data);
      return res.status(500).json({ error: data });
    }

    return res.status(200).json({ success: true, id: data.id });
  } catch (err) {
    console.error("Send email error:", err);
    return res.status(500).json({ error: err.message });
  }
}
