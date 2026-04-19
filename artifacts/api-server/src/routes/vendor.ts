import { Router } from "express";
import { generateOtp, verifyOtp } from "../lib/otp";
import { sendOtpEmail } from "../lib/email";

const router = Router();

router.post("/vendor/send-otp", async (req, res): Promise<void> => {
  const { email } = req.body as { email?: string };

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: "Bad Request", message: "Valid email is required" });
    return;
  }

  const otp = generateOtp(email);

  try {
    await sendOtpEmail(email, otp);
    res.json({ sent: true });
  } catch (err) {
    console.error("Failed to send OTP email:", err);
    res.status(500).json({ error: "Internal Server Error", message: "Failed to send verification email" });
  }
});

router.post("/vendor/verify-otp", (req, res): void => {
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
