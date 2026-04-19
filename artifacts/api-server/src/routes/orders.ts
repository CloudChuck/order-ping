import { Router } from "express";
import {
  createOrder,
  getOrder,
  markOrderReady,
  markOrderCompleted,
  nudgeOrder,
  getOrdersByStall,
  getQueueStatus,
  getStallBySlug,
} from "../lib/store";
import { emitOrderReady, emitOrderNudge, emitOrderUpdated } from "../lib/socket";

const router = Router();

function serializeOrder(order: ReturnType<typeof getOrder>) {
  if (!order) return null;
  return {
    id: order.id,
    stallId: order.stallId,
    stallSlug: order.stallSlug,
    receiptNumber: order.receiptNumber,
    status: order.status,
    createdAt: order.createdAt.toISOString(),
    readyAt: order.readyAt?.toISOString() ?? null,
    completedAt: order.completedAt?.toISOString() ?? null,
    nudgeCount: order.nudgeCount,
    lastNudgeAt: order.lastNudgeAt?.toISOString() ?? null,
  };
}

router.get("/stalls/:slug/orders", async (req, res): Promise<void> => {
  const { slug } = req.params as { slug: string };
  const status = req.query["status"] as string | undefined;

  const stall = getStallBySlug(slug);
  if (!stall) {
    res.status(404).json({ error: "Not Found", message: "Stall not found" });
    return;
  }

  const orders = getOrdersByStall(slug, status);
  res.json(orders.map(serializeOrder));
});

router.post("/stalls/:slug/orders", async (req, res): Promise<void> => {
  const { slug } = req.params as { slug: string };
  const { receiptNumber } = req.body;

  if (!receiptNumber) {
    res
      .status(400)
      .json({ error: "Bad Request", message: "receiptNumber is required" });
    return;
  }

  const result = createOrder(slug, String(receiptNumber));
  if ("error" in result) {
    res.status(400).json({ error: "Bad Request", message: result.error });
    return;
  }

  emitOrderUpdated(slug, String(receiptNumber));
  res.status(201).json(serializeOrder(result));
});

router.get("/stalls/:slug/orders/:receiptNumber", async (req, res): Promise<void> => {
  const { slug, receiptNumber } = req.params as { slug: string; receiptNumber: string };

  const order = getOrder(slug, receiptNumber);
  if (!order) {
    res.status(404).json({ error: "Not Found", message: "Order not found" });
    return;
  }

  res.json(serializeOrder(order));
});

router.post("/stalls/:slug/orders/:receiptNumber/ready", async (req, res): Promise<void> => {
  const { slug, receiptNumber } = req.params as { slug: string; receiptNumber: string };

  const order = markOrderReady(slug, receiptNumber);
  if (!order) {
    res.status(404).json({ error: "Not Found", message: "Order not found" });
    return;
  }

  emitOrderReady(slug, receiptNumber);
  res.json(serializeOrder(order));
});

router.post("/stalls/:slug/orders/:receiptNumber/complete", async (req, res): Promise<void> => {
  const { slug, receiptNumber } = req.params as { slug: string; receiptNumber: string };

  const order = markOrderCompleted(slug, receiptNumber);
  if (!order) {
    res.status(404).json({ error: "Not Found", message: "Order not found" });
    return;
  }

  emitOrderUpdated(slug, receiptNumber);
  res.json(serializeOrder(order));
});

router.post("/stalls/:slug/orders/:receiptNumber/nudge", async (req, res): Promise<void> => {
  const { slug, receiptNumber } = req.params as { slug: string; receiptNumber: string };

  const order = nudgeOrder(slug, receiptNumber);
  if (!order) {
    res.status(404).json({ error: "Not Found", message: "Order not found" });
    return;
  }

  emitOrderNudge(slug, receiptNumber);
  res.json(serializeOrder(order));
});

router.get("/stalls/:slug/queue-status", async (req, res): Promise<void> => {
  const { slug } = req.params as { slug: string };

  const status = getQueueStatus(slug);
  if (!status) {
    res.status(404).json({ error: "Not Found", message: "Stall not found" });
    return;
  }

  res.json(status);
});

export default router;
