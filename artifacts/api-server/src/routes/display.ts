// TASK 5 — TV Token Display Board backend route (no auth required)
import { Router } from "express";
import { supabase } from "../lib/supabase";

const router = Router();

/**
 * GET /api/display/:stallId
 * Returns ready + preparing orders for the stall — used by the TV display board.
 * Public route, no auth required.
 */
router.get("/display/:stallId", async (req, res): Promise<void> => {
  const { stallId } = req.params as { stallId: string };

  const { data, error } = await supabase
    .from("orders")
    .select("token_id, status")
    .eq("stall_id", stallId)
    .in("status", ["ready", "waiting"])
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    res.status(500).json({ error: "Internal Server Error", message: error.message });
    return;
  }

  const ready     = (data ?? []).filter((o) => o.status === "ready")   .map((o) => o.token_id);
  const preparing = (data ?? []).filter((o) => o.status === "waiting") .map((o) => o.token_id);

  res.json({ stallId, ready, preparing });
});

export default router;
