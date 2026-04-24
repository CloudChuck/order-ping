import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

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

// CORS - allow all origins for now (restrict in production)
app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (customer tracking page, vendor dashboard, TV display)
app.use(express.static(path.join(__dirname, "../public")));

// API routes
app.use("/api", router);

// Serve customer tracking page
app.get("/track/:tokenId?", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/customer-tracking.html"));
});

// Serve vendor dashboard
app.get("/vendor/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/vendor-dashboard.html"));
});

// Serve TV display board
app.get("/vendor/tv-display", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/tv-display.html"));
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Inject Supabase URL into client-side code (for security)
app.get("/config.js", (req, res) => {
  res.type("application/javascript");
  res.send(`
    window.SUPABASE_URL = "${process.env.SUPABASE_URL}";
    window.SUPABASE_ANON_KEY = "${process.env.SUPABASE_ANON_KEY}";
  `);
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error(err);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  });
});

export default app;
