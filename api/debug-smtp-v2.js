import nodemailer from 'nodemailer';

export const runtime = 'edge';

export default async function handler(req) {
  const origin = req.headers.get("origin") || "*";
  const corsHeaders = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const smtpHost = process.env.SMTP_HOST || "smtp-relay.brevo.com";
  const smtpPort = parseInt(process.env.SMTP_PORT || "587");
  const smtpLogin = process.env.SMTP_LOGIN || "";
  const smtpPass = process.env.SMTP_PASSWORD || "";
  const smtpFrom = process.env.SMTP_FROM || "";

  const results = {
    config: {
      host: smtpHost,
      port: smtpPort,
      login_first3: smtpLogin ? smtpLogin.substring(0, 3) + '***' : 'MISSING',
      has_login: !!smtpLogin,
      has_pass: !!smtpPass,
      has_from: !!smtpFrom,
    },
    verify: null,
    send: null,
  };

  // Test 1: Verify connection
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: false,
    auth: { user: smtpLogin, pass: smtpPass },
  });

  try {
    await transporter.verify();
    results.verify = { success: true, message: "Connection verified" };
  } catch (e) {
    results.verify = { success: false, error: e.message };
  }

  // Test 2: Try sending
  const fromEmail = smtpFrom || `"Test" <${smtpLogin || 'test@test.com'}>`;
  try {
    const info = await transporter.sendMail({
      from: fromEmail,
      to: "RAMAHUDSON@GMAIL.COM",
      subject: "SMTP Debug Test - MCP",
      text: `SMTP debug test\nHost: ${smtpHost}:${smtpPort}\nFrom: ${fromEmail}`,
    });
    results.send = { success: true, messageId: info.messageId, from: fromEmail };
  } catch (e) {
    results.send = { success: false, error: e.message };
  }

  return new Response(JSON.stringify(results), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}
