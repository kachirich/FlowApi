import "dotenv/config";
import app from "./app.js";
import { initializeDatabase, closePool } from "./db/connection.js";
import { startQueueWorker } from "./utils/queueWorker.js";
import { startJanitorService } from "./services/janitor.service.js";
import { connectRedis } from "./utils/redisClient.js";
import "./services/queue.js";
import "./services/notification.queue.js";

const PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------
async function start() {
  try {
    await initializeDatabase();
    await connectRedis();
    // startQueueWorker();
    startJanitorService();
    app.listen(PORT, HOST, () => {
      console.log(`[server] API Gateway listening on http://${HOST}:${PORT}`);
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
