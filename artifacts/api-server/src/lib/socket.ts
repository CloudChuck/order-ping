import { Server as SocketIOServer } from "socket.io";
import type { Server as HttpServer } from "http";

let io: SocketIOServer | null = null;

export function initSocketIO(server: HttpServer): SocketIOServer {
  const allowedOrigins = process.env["ALLOWED_ORIGINS"]
    ? process.env["ALLOWED_ORIGINS"].split(",").map((o) => o.trim())
    : "*"; // Allow all in dev; set ALLOWED_ORIGINS in production

  io = new SocketIOServer(server, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true,
    },
    path: "/api/socket",
  });

  io.on("connection", (socket) => {
    socket.on("join:stall", (slug: unknown) => {
      if (typeof slug !== "string" || slug.length > 100 || !/^[a-z0-9-]+$/.test(slug)) return;
      socket.join(`stall:${slug}`);
    });

    socket.on("join:order", (data: unknown) => {
      if (!data || typeof data !== "object") return;
      const { slug, receiptNumber } = data as { slug?: string; receiptNumber?: string };
      if (typeof slug !== "string" || typeof receiptNumber !== "string") return;
      if (slug.length > 100 || receiptNumber.length > 50) return;
      if (!/^[a-z0-9-]+$/.test(slug)) return;
      socket.join(`order:${slug}:${receiptNumber}`);
    });

    socket.on("disconnect", () => {
    });
  });

  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}

export function emitOrderReady(slug: string, receiptNumber: string): void {
  if (!io) return;
  io.to(`order:${slug}:${receiptNumber}`).emit("order:ready", { receiptNumber });
  io.to(`stall:${slug}`).emit("stall:order:ready", { receiptNumber });
}

export function emitOrderNudge(slug: string, receiptNumber: string): void {
  if (!io) return;
  io.to(`order:${slug}:${receiptNumber}`).emit("order:nudge", { receiptNumber });
}

export function emitOrderUpdated(slug: string, receiptNumber: string): void {
  if (!io) return;
  io.to(`stall:${slug}`).emit("stall:order:updated", { receiptNumber });
  io.to(`order:${slug}:${receiptNumber}`).emit("order:updated", { receiptNumber });
}
