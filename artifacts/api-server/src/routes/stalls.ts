import { Router } from "express";
import QRCode from "qrcode";
import {
  createStall,
  getStallBySlug,
  getAllStalls,
  verifyPassword,
} from "../lib/store";

const router = Router();

router.get("/stalls", async (_req, res): Promise<void> => {
  const stalls = getAllStalls();
  res.json(
    stalls.map((s) => ({
      id: s.id,
      name: s.name,
      mallName: s.mallName,
      slug: s.slug,
      email: s.email,
      createdAt: s.createdAt.toISOString(),
      currentlyServing: s.currentlyServing,
    })),
  );
});

router.post("/stalls", async (req, res): Promise<void> => {
  const { name, mallName, email, password, slug } = req.body;

  if (!name || !mallName || !email || !password) {
    res
      .status(400)
      .json({ error: "Bad Request", message: "Missing required fields" });
    return;
  }

  const result = createStall({ name, mallName, email, password, slug });

  if ("error" in result) {
    res.status(409).json({ error: "Conflict", message: result.error });
    return;
  }

  res.status(201).json({
    id: result.id,
    name: result.name,
    mallName: result.mallName,
    slug: result.slug,
    email: result.email,
    createdAt: result.createdAt.toISOString(),
    currentlyServing: result.currentlyServing,
  });
});

router.get("/stalls/:slug", async (req, res): Promise<void> => {
  const { slug } = req.params as { slug: string };
  const stall = getStallBySlug(slug);

  if (!stall) {
    res.status(404).json({ error: "Not Found", message: "Stall not found" });
    return;
  }

  res.json({
    id: stall.id,
    name: stall.name,
    mallName: stall.mallName,
    slug: stall.slug,
    email: stall.email,
    createdAt: stall.createdAt.toISOString(),
    currentlyServing: stall.currentlyServing,
  });
});

router.post("/stalls/:slug/verify-password", async (req, res): Promise<void> => {
  const { slug } = req.params as { slug: string };
  const { password } = req.body;

  const stall = getStallBySlug(slug);
  if (!stall) {
    res.status(404).json({ error: "Not Found", message: "Stall not found" });
    return;
  }

  if (!verifyPassword(slug, password)) {
    res
      .status(401)
      .json({ error: "Unauthorized", message: "Invalid password" });
    return;
  }

  res.json({
    success: true,
    stallId: stall.id,
    stallName: stall.name,
  });
});

router.get("/stalls/:slug/qr-code", async (req, res): Promise<void> => {
  const { slug } = req.params as { slug: string };
  const stall = getStallBySlug(slug);

  if (!stall) {
    res.status(404).json({ error: "Not Found", message: "Stall not found" });
    return;
  }

  const domains = process.env.REPLIT_DOMAINS?.split(",") ?? [];
  const domain = domains[0] ?? "localhost";
  const trackUrl = `https://${domain}/track/${slug}`;

  const format = (req.query["format"] as string) ?? "png";

  if (format === "svg") {
    const svg = await QRCode.toString(trackUrl, { type: "svg", margin: 2 });
    res.setHeader("Content-Type", "image/svg+xml");
    res.send(svg);
    return;
  }

  const buffer = await QRCode.toBuffer(trackUrl, {
    width: 400,
    margin: 2,
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
  });

  res.setHeader("Content-Type", "image/png");
  res.send(buffer);
});

export default router;
