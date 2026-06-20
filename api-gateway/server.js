import "dotenv/config";
import app from "./app.js";
import { migrate } from "./db/migrate.js";
import { closePool } from "./db/connection.js";
import { startQueueWorker } from "./utils/queueWorker.js";
import { startJanitorService } from "./services/janitor.service.js";
import redisClient, { connectRedis } from "./utils/redisClient.js";
import { redisClient as limiterRedisClient } from "./middleware/rateLimiter.js";
import { worker as webhookWorker } from "./services/queue.js";
import "./services/notification.queue.js";

// Fail fast if critical secrets are missing or still set to placeholder values.
const PLACEHOLDER = 'CHANGE_ME';
const requiredSecrets = ['JWT_SECRET', 'PGPASSWORD'];
for (const key of requiredSecrets) {
  const val = process.env[key];
  if (!val || val === PLACEHOLDER || val === 'change_me_to_a_long_random_string') {
    console.error(`[server] FATAL: ${key} is not configured. Set a real value in .env before starting.`);
    process.exit(1);
  }
}

// Warn (not fatal) if Google OAuth vars are missing — server still starts so
// email/password auth and all other features remain available.
const GOOGLE_OAUTH_VARS = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_CALLBACK_URL'];
const missingGoogleVars = GOOGLE_OAUTH_VARS.filter((k) => {
  const v = process.env[k];
  return !v || v === PLACEHOLDER || v === 'change_me';
});
if (missingGoogleVars.length > 0) {
  console.warn(`[server] WARNING: Google OAuth is not configured — the following vars are missing or still set to placeholder values: ${missingGoogleVars.join(', ')}. Google sign-in will be disabled until these are set.`);
}

const PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------
let server;

async function start() {
  try {
    await migrate();
    await connectRedis();
    // startQueueWorker();
    startJanitorService();
    server = app.listen(PORT, HOST, () => {
      console.log(`[server] API Gateway listening on http://${HOST}:${PORT}`);
      console.log(`[server] Environment: ${process.env.NODE_ENV || "development"}`);
    });

    // Keep-alive must outlive the upstream proxy's idle timeout to avoid races
    // where the proxy reuses a socket the server is closing (→ 502s).
    // headersTimeout must be slightly greater than keepAliveTimeout.
    server.keepAliveTimeout = 65_000;
    server.headersTimeout = 66_000;
  } catch (err) {
    console.error("[server] Failed to start:", err.message);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------
let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return; // ignore duplicate signals
  shuttingDown = true;
  console.log(`\n[server] ${signal} received — shutting down gracefully`);

  // Hard cap: if draining + cleanup exceeds 10s, force-exit so the orchestrator
  // doesn't hang waiting on a stuck connection.
  const forceExit = setTimeout(() => {
    console.error("[server] Graceful shutdown timed out — forcing exit");
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  try {
    // 1. Stop accepting new connections and wait for in-flight requests.
    if (server) {
      await new Promise((resolve) => server.close(resolve));
      console.log("[server] HTTP server closed (in-flight requests drained)");
    }

    // 2. Stop the BullMQ worker so no new jobs start mid-shutdown.
    await webhookWorker.close().catch((e) =>
      console.error("[server] Worker close error:", e.message)
    );

    // 3. Close the PostgreSQL pool.
    await closePool();

    // 4. Close both node-redis clients.
    await Promise.all([
      redisClient.isOpen ? redisClient.quit() : Promise.resolve(),
      limiterRedisClient.isOpen ? limiterRedisClient.quit() : Promise.resolve(),
    ]).catch((e) => console.error("[server] Redis close error:", e.message));

    clearTimeout(forceExit);
    console.log("[server] Clean shutdown complete");
    process.exit(0);
  } catch (err) {
    console.error("[server] Error during shutdown:", err.message);
    process.exit(1);
  }
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
