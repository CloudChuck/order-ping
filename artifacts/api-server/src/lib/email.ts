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
    from: "OrderPing <noreply@cloudchuck.in>",
    to: email,
    subject: "Your OrderPing Login Code",
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
        <tr>
          <td style="background:#0f1117;padding:28px 32px;">
            <p style="margin:0;font-size:22px;font-weight:700;color:#3ddc84;letter-spacing:-0.5px;">OrderPing</p>
            <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">Smart food court notifications</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#111827;">Verify your email</h1>
            <p style="margin:0 0 28px;font-size:14px;color:#6b7280;line-height:1.6;">
              Use the code below to complete your stall registration on OrderPing.
              This code is valid for <strong style="color:#374151;">10 minutes</strong>.
            </p>
            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:28px;text-align:center;margin-bottom:28px;">
              <p style="margin:0 0 8px;font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;">Your verification code</p>
              <p style="margin:0;font-size:44px;font-weight:900;letter-spacing:14px;color:#111827;font-family:'Courier New',monospace;">${otp}</p>
            </div>
            <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
              If you did not request this code, you can safely ignore this email.
              Someone may have entered your email address by mistake.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #f3f4f6;">
            <p style="margin:0;font-size:12px;color:#d1d5db;text-align:center;">
              &copy; OrderPing &mdash; Built for Indian food courts
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}
