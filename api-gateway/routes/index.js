import { Router } from "express";

const router = Router();

/**
 * GET /health
 * Lightweight health-check endpoint for load balancers and uptime monitors.
 */
router.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

/**
 * Catch-all for undefined routes — returns 404.
 */
router.use((req, res) => {
  res.status(404).json({
    status: 404,
    error: "Not Found",
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

export default router;
``