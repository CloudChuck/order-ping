import { Server as SocketIOServer } from "socket.io";
import type { Server as HttpServer } from "http";

let io: SocketIOServer | null = null;

export function initSocketIO(server: HttpServer): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    path: "/api/socket",
  });

  io.on("connection", (socket) => {
    socket.on("join:stall", (slug: string) => {
      socket.join(`stall:${slug}`);
    });

    socket.on("join:order", (data: { slug: string; receiptNumber: string }) => {
      socket.join(`order:${data.slug}:${data.receiptNumber}`);
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
