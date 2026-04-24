// TASK 8 — Cleanup job added: deletes expired push/whatsapp rows every 30 min
import { createServer } from "http";
import app from "./app";
import { logger } from "./lib/logger";
import { initSocketIO } from "./lib/socket";
import { deleteExpiredRows } from "./lib/store-supabase";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = createServer(app);
initSocketIO(server);

server.listen(port, () => {
  logger.info({ port }, "Server listening");
});

server.on("error", (err) => {
  logger.error({ err }, "Error starting server");
  process.exit(1);
});

// TASK 8 — Subscription cleanup every 30 minutes
const CLEANUP_INTERVAL_MS = 30 * 60 * 1000; // 30 min

setInterval(async () => {
  try {
    const { subs, whatsapp } = await deleteExpiredRows();
    console.log(`[cleanup] Deleted ${subs} expired push subscriptions, ${whatsapp} WhatsApp subscribers`);
  } catch (err: any) {
    console.error("[cleanup] Error during cleanup:", err?.message ?? err);
  }
}, CLEANUP_INTERVAL_MS);
