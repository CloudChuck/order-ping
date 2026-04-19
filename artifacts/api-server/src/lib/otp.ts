interface OtpEntry {
  code: string;
  expiresAt: Date;
  attempts: number;
}

const store = new Map<string, OtpEntry>();

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export function generateOtp(email: string): string {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  store.set(email.toLowerCase(), {
    code,
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
    attempts: 0,
  });
  return code;
}

export function verifyOtp(email: string, code: string): "valid" | "invalid" | "expired" | "locked" {
  const key = email.toLowerCase();
  const entry = store.get(key);
  if (!entry) return "invalid";
  if (entry.attempts >= MAX_ATTEMPTS) return "locked";
  if (new Date() > entry.expiresAt) {
    store.delete(key);
    return "expired";
  }
  if (entry.code !== code.trim()) {
    entry.attempts += 1;
    return "invalid";
  }
  store.delete(key);
  return "valid";
}

setInterval(() => {
  const now = new Date();
  for (const [key, entry] of store.entries()) {
    if (now > entry.expiresAt) store.delete(key);
  }
}, 5 * 60 * 1000);
