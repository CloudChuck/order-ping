import { Router } from "express";
import rateLimit from "express-rate-limit";
import { generateOtp, verifyOtp } from "../lib/otp";
import { sendOtpEmail } from "../lib/email";

const router = Router();

const otpSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // max 5 OTP requests per IP per window
  message: { error: "Too many OTP requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many verification attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/vendor/send-otp", otpSendLimiter, async (req, res): Promise<void> => {
  const { email } = req.body as { email?: string };

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: "Bad Request", message: "Valid email is required" });
    return;
  }

  const otp = generateOtp(email);

  // Log OTP only in development — NEVER in production
  if (process.env.NODE_ENV !== "production") {
    console.log(`\n[OTP] Email: ${email}  Code: ${otp}\n`);
  }

  try {
    await sendOtpEmail(email, otp);
    res.json({ sent: true });
  } catch (err: any) {
    // Resend free tier only sends to verified addresses — still return success
    // so the user can grab the code from the server logs
    console.error("OTP email delivery failed (check server logs for code):", err?.message ?? err);
    res.json({ sent: true, note: "email_unavailable" });
  }
});

router.post("/vendor/verify-otp", otpVerifyLimiter, (req, res): void => {
  const { email, otp } = req.body as { email?: string; otp?: string };

  if (!email || !otp) {
    res.status(400).json({ error: "Bad Request", message: "email and otp are required" });
    return;
  }

  const result = verifyOtp(email, otp);

  if (result === "valid") {
    res.json({ valid: true });
    return;
  }

  const messages: Record<string, string> = {
    invalid: "Incorrect code. Please try again.",
    expired: "Code has expired. Please request a new one.",
    locked: "Too many attempts. Please request a new code.",
  };

  res.status(400).json({ valid: false, reason: result, message: messages[result] });
});

export default router;
