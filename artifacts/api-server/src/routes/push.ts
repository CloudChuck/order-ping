// TASK 4 — Push / WhatsApp registration routes
import { Router } from "express";
import { getStallBySlug, saveWhatsAppSubscriber, sendWhatsAppNotification } from "../lib/store-supabase";

const router = Router();

/**
 * POST /api/push/whatsapp-register
 * Body: { phone, tokenId, stallId }
 * Saves an optional WhatsApp subscriber for iOS users who opt-in.
 */
router.post("/push/whatsapp-register", async (req, res): Promise<void> => {
  const { phone, tokenId, stallId } = req.body as {
    phone?: string;
    tokenId?: string;
    stallId?: string;
  };

  if (!phone || !tokenId || !stallId) {
    res.status(400).json({ error: "Bad Request", message: "phone, tokenId, and stallId are required" });
    return;
  }

  // Basic phone validation (allows +91... or 10-digit)
  if (!/^[\d+\s-]{8,15}$/.test(phone.trim())) {
    res.status(400).json({ error: "Bad Request", message: "Invalid phone number format" });
    return;
  }

  try {
    await saveWhatsAppSubscriber(phone.trim(), tokenId, stallId);
    // TASK 4 — stub notification (console.log only for now)
    sendWhatsAppNotification(phone.trim(), tokenId, `Stall ${stallId}`);
    res.json({ registered: true });
  } catch (err: any) {
    console.error("[push] WhatsApp register error:", err?.message ?? err);
    res.status(500).json({ error: "Internal Server Error", message: "Failed to register" });
  }
});

export default router;
