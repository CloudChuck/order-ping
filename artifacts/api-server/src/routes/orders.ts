// TASK 1 — Updated to use async Supabase store (await added to all store calls)
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
  type Order,
} from "../lib/store-supabase";
import { emitOrderReady, emitOrderNudge, emitOrderUpdated } from "../lib/socket";

const router = Router();

function serializeOrder(order: Order | null) {
  if (!order) return null;
  return {
    id:            order.id,
    stallId:       order.stallId,
    stallSlug:     order.stallSlug,
    receiptNumber: order.receiptNumber,
    status:        order.status,
    createdAt:     order.createdAt.toISOString(),
    readyAt:       order.readyAt?.toISOString()     ?? null,
    completedAt:   order.completedAt?.toISOString() ?? null,
    nudgeCount:    order.nudgeCount,
    lastNudgeAt:   order.lastNudgeAt?.toISOString() ?? null,
  };
}

router.get("/stalls/:slug/orders", async (req, res): Promise<void> => {
  const { slug }  = req.params as { slug: string };
  const status    = req.query["status"] as string | undefined;

  const stall = await getStallBySlug(slug);
  if (!stall) {
    res.status(404).json({ error: "Not Found", message: "Stall not found" });
    return;
  }

  const orders = await getOrdersByStall(slug, status);
  res.json(orders.map(serializeOrder));
});

router.post("/stalls/:slug/orders", async (req, res): Promise<void> => {
  const { slug }  = req.params as { slug: string };
  const { receiptNumber } = req.body;

  if (!receiptNumber) {
    res.status(400).json({ error: "Bad Request", message: "receiptNumber is required" });
    return;
  }

  // TASK 1: await async createOrder
  const result = await createOrder(slug, String(receiptNumber));
  if ("error" in result) {
    res.status(400).json({ error: "Bad Request", message: result.error });
    return;
  }

  emitOrderUpdated(slug, String(receiptNumber));
  res.status(201).json(serializeOrder(result));
});

router.get("/stalls/:slug/orders/:receiptNumber", async (req, res): Promise<void> => {
  const { slug, receiptNumber } = req.params as { slug: string; receiptNumber: string };

  const order = await getOrder(slug, receiptNumber);
  if (!order) {
    res.status(404).json({ error: "Not Found", message: "Order not found" });
    return;
  }

  res.json(serializeOrder(order));
});

router.post("/stalls/:slug/orders/:receiptNumber/ready", async (req, res): Promise<void> => {
  const { slug, receiptNumber } = req.params as { slug: string; receiptNumber: string };

  // TASK 1+7: await markOrderReady (also logs analytics event internally)
  const order = await markOrderReady(slug, receiptNumber);
  if (!order) {
    res.status(404).json({ error: "Not Found", message: "Order not found" });
    return;
  }

  emitOrderReady(slug, receiptNumber);
  res.json(serializeOrder(order));
});

router.post("/stalls/:slug/orders/:receiptNumber/complete", async (req, res): Promise<void> => {
  const { slug, receiptNumber } = req.params as { slug: string; receiptNumber: string };

  // TASK 1+7: await markOrderCompleted (also logs analytics event internally)
  const order = await markOrderCompleted(slug, receiptNumber);
  if (!order) {
    res.status(404).json({ error: "Not Found", message: "Order not found" });
    return;
  }

  emitOrderUpdated(slug, receiptNumber);
  res.json(serializeOrder(order));
});

router.post("/stalls/:slug/orders/:receiptNumber/nudge", async (req, res): Promise<void> => {
  const { slug, receiptNumber } = req.params as { slug: string; receiptNumber: string };

  const order = await nudgeOrder(slug, receiptNumber);
  if (!order) {
    res.status(404).json({ error: "Not Found", message: "Order not found" });
    return;
  }

  emitOrderNudge(slug, receiptNumber);
  res.json(serializeOrder(order));
});

router.get("/stalls/:slug/queue-status", async (req, res): Promise<void> => {
  const { slug } = req.params as { slug: string };

  const status = await getQueueStatus(slug);
  if (!status) {
    res.status(404).json({ error: "Not Found", message: "Stall not found" });
    return;
  }

  res.json(status);
});

export default router;
