import { Resend } from "resend";

let _client: Resend | null = null;

function getClient(): Resend {
  if (!_client) {
    const raw = process.env["RESEND_API_KEY"] ?? "";
    const key = raw.replace(/[^\x20-\x7E]/g, "").trim();
    if (!key) throw new Error("RESEND_API_KEY is not configured");
    _client = new Resend(key);
  }
  return _client;
}

export async function sendOtpEmail(email: string, otp: string): Promise<void> {
  const resend = getClient();
  await resend.emails.send({
    from: "OrderPing <onboarding@resend.dev>",
    to: email,
    subject: `${otp} is your OrderPing verification code`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0f1117;color:#f8f8f8;border-radius:12px;">
        <div style="margin-bottom:24px;">
          <span style="font-size:24px;font-weight:bold;color:#3ddc84;">OrderPing</span>
        </div>
        <h2 style="font-size:20px;font-weight:700;margin:0 0 8px;">Your verification code</h2>
        <p style="color:#888;margin:0 0 24px;font-size:14px;">
          Enter this code to complete your stall registration. It expires in 10 minutes.
        </p>
        <div style="background:#1a1f2e;border:1px solid #2a2f3e;border-radius:8px;padding:24px;text-align:center;margin-bottom:24px;">
          <span style="font-size:40px;font-weight:900;letter-spacing:12px;color:#3ddc84;font-family:monospace;">${otp}</span>
        </div>
        <p style="color:#555;font-size:12px;margin:0;">
          If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `,
  });
}
