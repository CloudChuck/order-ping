// TASK 1 — Updated to use async Supabase store
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { getStallBySlug, getStallAnalytics, getAdminAnalytics } from "../lib/store-supabase";

const router = Router();

const ADMIN_PASSWORD = process.env["ADMIN_PASSWORD"];
if (!ADMIN_PASSWORD) {
  console.warn("[SECURITY] ADMIN_PASSWORD env var is not set. Admin analytics endpoint will reject all requests.");
}

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // max 10 attempts per window
  message: { error: "Too many attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get("/stalls/:slug/analytics", async (req, res): Promise<void> => {
  const { slug } = req.params as { slug: string };

  const stall = await getStallBySlug(slug);
  if (!stall) {
    res.status(404).json({ error: "Not Found", message: "Stall not found" });
    return;
  }

  const analytics = await getStallAnalytics(slug);
  if (!analytics) {
    res.status(404).json({ error: "Not Found", message: "Analytics not found" });
    return;
  }

  res.json({
    ordersToday:        analytics.ordersToday,
    avgWaitTimeMinutes: analytics.avgWaitTimeMinutes,
    recentOrders: analytics.recentOrders.map((o) => ({
      id:            o.id,
      stallId:       o.stallId,
      stallSlug:     o.stallSlug,
      receiptNumber: o.receiptNumber,
      status:        o.status,
      createdAt:     o.createdAt.toISOString(),
      readyAt:       o.readyAt?.toISOString()     ?? null,
      completedAt:   o.completedAt?.toISOString() ?? null,
      nudgeCount:    o.nudgeCount,
      lastNudgeAt:   o.lastNudgeAt?.toISOString() ?? null,
    })),
    hourlyBreakdown: analytics.hourlyBreakdown,
  });
});

router.post("/admin/analytics", adminLimiter, async (req, res): Promise<void> => {
  const { password } = req.body as { password?: string };

  if (!ADMIN_PASSWORD || password !== ADMIN_PASSWORD) {
    res.status(401).json({ error: "Unauthorized", message: "Invalid admin password" });
    return;
  }

  const analytics = await getAdminAnalytics();
  res.json(analytics);
});

// Keep GET for backward compat (deprecated — will be removed)
router.get("/admin/analytics", adminLimiter, async (req, res): Promise<void> => {
  const { password } = req.query as { password?: string };

  if (!ADMIN_PASSWORD || password !== ADMIN_PASSWORD) {
    res.status(401).json({ error: "Unauthorized", message: "Invalid admin password" });
    return;
  }

  const analytics = await getAdminAnalytics();
  res.json(analytics);
});

export default router;
