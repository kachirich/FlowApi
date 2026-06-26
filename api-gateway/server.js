import "dotenv/config";
import app from "./app.js";
import logger from "./utils/logger.js";
import { migrate } from "./db/migrate.js";
import { closePool } from "./db/connection.js";
import { startJanitorService } from "./services/janitor.service.js";
import redisClient, { connectRedis } from "./utils/redisClient.js";
import { worker as webhookWorker } from "./services/queue.js";
import "./services/notification.queue.js";

// Fail fast if critical secrets are missing or still set to placeholder values.
const PLACEHOLDER = 'CHANGE_ME';
const requiredSecrets = ['JWT_SECRET', 'PGPASSWORD', 'ENCRYPTION_KEY'];
for (const key of requiredSecrets) {
  const val = process.env[key];
  if (!val || val === PLACEHOLDER || val === 'change_me_to_a_long_random_string') {
    logger.fatal(`${key} is not configured. Set a real value in .env before starting.`);
    process.exit(1);
  }
}

// ENCRYPTION_KEY has a strict format (AES-256-GCM key): exactly 64 hex chars
// (32 bytes). Validate at boot so destination-token encryption can never fail
// per-request — mirrors getKey() in utils/encryption.js. Generate with:
//   openssl rand -hex 32
if (!/^[0-9a-fA-F]{64}$/.test(process.env.ENCRYPTION_KEY)) {
  logger.fatal(
    'ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). ' +
    'Generate one with `openssl rand -hex 32` and set it in .env. ' +
    'Do NOT change it once destination tokens have been stored — rotating it ' +
    'makes existing encrypted tokens undecryptable.'
  );
  process.exit(1);
}

// Warn (not fatal) if Google OAuth vars are missing — server still starts so
// email/password auth and all other features remain available.
const GOOGLE_OAUTH_VARS = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_CALLBACK_URL'];
const missingGoogleVars = GOOGLE_OAUTH_VARS.filter((k) => {
  const v = process.env[k];
  return !v || v === PLACEHOLDER || v === 'change_me';
});
if (missingGoogleVars.length > 0) {
  logger.warn(`Google OAuth is not configured — the following vars are missing or still set to placeholder values: ${missingGoogleVars.join(', ')}. Google sign-in will be disabled until these are set.`);
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
    startJanitorService();
    server = app.listen(PORT, HOST, () => {
      logger.info(`API Gateway listening on http://${HOST}:${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || "development"}`);
    });

    // Keep-alive must outlive the upstream proxy's idle timeout to avoid races
    // where the proxy reuses a socket the server is closing (→ 502s).
    // headersTimeout must be slightly greater than keepAliveTimeout.
    server.keepAliveTimeout = 65_000;
    server.headersTimeout = 66_000;
  } catch (err) {
    logger.error({ err }, "Failed to start");
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
  logger.info(`${signal} received — shutting down gracefully`);

  // Hard cap: if draining + cleanup exceeds 10s, force-exit so the orchestrator
  // doesn't hang waiting on a stuck connection.
  const forceExit = setTimeout(() => {
    logger.error("Graceful shutdown timed out — forcing exit");
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  try {
    // 1. Stop accepting new connections and wait for in-flight requests.
    if (server) {
      await new Promise((resolve) => server.close(resolve));
      logger.info("HTTP server closed (in-flight requests drained)");
    }

    // 2. Stop the BullMQ worker so no new jobs start mid-shutdown.
    await webhookWorker.close().catch((e) =>
      logger.error({ err: e }, "Worker close error")
    );

    // 3. Close the PostgreSQL pool.
    await closePool();

    // 4. Close the ioredis client.
    if (redisClient.status !== "closed") {
      await redisClient.quit().catch((e) => logger.error({ err: e }, "Redis close error"));
    }

    clearTimeout(forceExit);
    logger.info("Clean shutdown complete");
    process.exit(0);
  } catch (err) {
    logger.error({ err }, "Error during shutdown");
    process.exit(1);
  }
}

process.on("unhandledRejection", (reason, promise) => {
  logger.error({ reason, promise }, "Unhandled Rejection");
});

process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught Exception");
});

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

start();
