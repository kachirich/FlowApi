import "dotenv/config";
import express from "express";
import cors from "cors";
import { helmetMiddleware, rateLimiter, requestLogger, authenticate } from "./middleware/index.js";
import { initializeDatabase, closePool } from "./db/connection.js";
import { startQueueWorker } from "./utils/queueWorker.js";
import routes from "./routes/index.js";
import adminRoutes from "./routes/admin.js";
import webhookRoutes from "./routes/webhooks.js";
import authRoutes from "./routes/auth.js";
import leadsRoutes from "./routes/leads.js";
import workflowRoutes from "./routes/workflow.js";

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;

// ---------------------------------------------------------------------------
// Trust proxy — required when running behind Nginx / a cloud load balancer
// so that req.ip reflects the real client address.
// ---------------------------------------------------------------------------
app.set("trust proxy", 1);

// ---------------------------------------------------------------------------
// Global middleware
// ---------------------------------------------------------------------------
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-api-key"]
}));
app.use(helmetMiddleware);         // Security headers
app.use(rateLimiter);              // DDoS / brute-force protection
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(requestLogger);           // Log every request to PostgreSQL

// ---------------------------------------------------------------------------
// Protected routes — JWT required
// ---------------------------------------------------------------------------
app.get("/api/secure-data", authenticate, (_req, res) => {
  res.json({
    status: 200,
    message: "You have accessed a protected resource",
    user: _req.user,
  });
});

// Admin dashboard API — authenticate is applied inside admin.js per-route
app.use("/api/admin", adminRoutes);

// Webhook receivers — JWT-protected endpoints for external lead data
app.use("/api/webhooks", webhookRoutes);

// Lead simulation — JWT-protected, triggers simulation pipeline
app.use("/api/leads", leadsRoutes);

// Workflow overrides — circuit breaker bypass when AI provider is unavailable
app.use("/api/workflow", workflowRoutes);

// ---------------------------------------------------------------------------
// Auth routes — login / registration (public, no JWT required)
// ---------------------------------------------------------------------------
app.use("/api/auth", authRoutes);

// ---------------------------------------------------------------------------
// Public routes — the catch-all 404 in routes/index.js MUST come last
// ---------------------------------------------------------------------------
app.use(routes);

// ---------------------------------------------------------------------------
// Centralised error handler
// ---------------------------------------------------------------------------
app.use((err, _req, res, _next) => {
  console.error("[error]", err.stack || err.message);

  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    status,
    error: err.name || "Internal Server Error",
    message:
      process.env.NODE_ENV === "production"
        ? "An unexpected error occurred"
        : err.message,
  });
});

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------
async function start() {
  try {
    await initializeDatabase();
    startQueueWorker();
    app.listen(PORT, () => {
      console.log(`[server] API Gateway listening on http://localhost:${PORT}`);
      console.log(`[server] Environment: ${process.env.NODE_ENV || "development"}`);
    });
  } catch (err) {
    console.error("[server] Failed to start:", err.message);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------
async function shutdown(signal) {
  console.log(`\n[server] ${signal} received — shutting down gracefully`);
  await closePool();
  process.exit(0);
}

process.on("unhandledRejection", (reason, promise) => {
  console.error("[server] Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[server] Uncaught Exception:", err);
});

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

start();
