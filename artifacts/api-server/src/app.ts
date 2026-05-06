import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import path from "path";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Disabled for SPA — configure per deployment
  crossOriginEmbedderPolicy: false,
}));

// Logging middleware
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// CORS — restrict origins in production
const ALLOWED_ORIGINS = process.env["ALLOWED_ORIGINS"]
  ? process.env["ALLOWED_ORIGINS"].split(",").map((o) => o.trim())
  : undefined; // undefined = allow all in dev

app.use(cors({
  origin: ALLOWED_ORIGINS ?? true,
  credentials: true,
}));

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Serve built React frontend static files
app.use(express.static(path.resolve(__dirname, "../../../artifacts/orderping/dist/public")));

// API routes
app.use("/api", router);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Inject Supabase credentials into client-side (sanitized to prevent XSS)
app.get("/config.js", (req, res) => {
  const sanitize = (val: string | undefined) =>
    JSON.stringify(val ?? ""); // JSON.stringify safely escapes all special chars
  res.type("application/javascript");
  res.send(
    `window.SUPABASE_URL = ${sanitize(process.env.SUPABASE_URL)};\n` +
    `window.SUPABASE_ANON_KEY = ${sanitize(process.env.SUPABASE_ANON_KEY)};\n`
  );
});

// SPA fallback - use app.use to avoid path-to-regexp wildcard issues with Express 5
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    return next();
  }
  res.sendFile(path.resolve(__dirname, "../../../artifacts/orderping/dist/public/index.html"));
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Error handler — never leak internal details in production
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error(err);
  const status = err.status || 500;
  const message =
    process.env.NODE_ENV === "production" && status === 500
      ? "Internal server error"
      : err.message || "Internal server error";
  res.status(status).json({ error: message });
});

export default app;
