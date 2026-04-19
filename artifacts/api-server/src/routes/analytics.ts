import { Router } from "express";
import { getStallBySlug, getStallAnalytics, getAdminAnalytics } from "../lib/store";

const router = Router();

const ADMIN_PASSWORD = "admin123";

router.get("/stalls/:slug/analytics", async (req, res): Promise<void> => {
  const { slug } = req.params as { slug: string };

  const stall = getStallBySlug(slug);
  if (!stall) {
    res.status(404).json({ error: "Not Found", message: "Stall not found" });
    return;
  }

  const analytics = getStallAnalytics(slug);
  if (!analytics) {
    res.status(404).json({ error: "Not Found", message: "Analytics not found" });
    return;
  }

  res.json({
    ordersToday: analytics.ordersToday,
    avgWaitTimeMinutes: analytics.avgWaitTimeMinutes,
    recentOrders: analytics.recentOrders.map((o) => ({
      id: o.id,
      stallId: o.stallId,
      stallSlug: o.stallSlug,
      receiptNumber: o.receiptNumber,
      status: o.status,
      createdAt: o.createdAt.toISOString(),
      readyAt: o.readyAt?.toISOString() ?? null,
      completedAt: o.completedAt?.toISOString() ?? null,
      nudgeCount: o.nudgeCount,
      lastNudgeAt: o.lastNudgeAt?.toISOString() ?? null,
    })),
    hourlyBreakdown: analytics.hourlyBreakdown,
  });
});

router.get("/admin/analytics", async (req, res): Promise<void> => {
  const { password } = req.query as { password?: string };

  if (password !== ADMIN_PASSWORD) {
    res.status(401).json({ error: "Unauthorized", message: "Invalid admin password" });
    return;
  }

  const analytics = getAdminAnalytics();
  res.json(analytics);
});

export default router;
