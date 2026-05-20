import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { createClient } from "redis";
import { query } from "../db/connection.js";

// Create a Redis client. Uses REDIS_URL from the environment.
const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

// Connect to Redis. In production, you would handle connection errors robustly.
redisClient.connect().catch((err) => {
  console.error("Redis connection error:", err);
});

/**
 * Rate-limiting middleware — throttles clients that exceed the configured
 * request threshold within a sliding window.
 *
 * Defaults:
 *   • Window : 15 minutes  (override via RATE_LIMIT_WINDOW_MS)
 *   • Max    : 100 requests (override via RATE_LIMIT_MAX_REQUESTS)
 *
 * When a client exceeds the limit the server responds with 429 Too Many
 * Requests, increments the bots_blocked counter in PostgreSQL, and sends
 * a Retry-After header.
 *
 * Local development traffic (127.0.0.1, ::1) is whitelisted to allow
 * the Test Sandbox to fire payloads without triggering the spam shield.
 */
const rateLimiter = rateLimit({
  // Use RedisStore instead of the default memory store
  store: new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
  }),
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  standardHeaders: "draft-7",   // RateLimit-* headers (IETF draft-7)
  legacyHeaders: false,         // Disable X-RateLimit-* headers
  // Skip rate limiting for local development / Test Sandbox traffic
  skip: (req) => {
    const ip = req.ip || req.socket?.remoteAddress || "";
    return (
      ip === "127.0.0.1" ||
      ip === "::1" ||
      ip === "::ffff:127.0.0.1" ||
      req.hostname === "localhost"
    );
  },
  message: {
    status: 429,
    error: "Too Many Requests",
    message: "You have exceeded the allowed number of requests. Please try again later.",
  },
  handler: (_req, res, _next, options) => {
    // Increment the bots_blocked counter (fire-and-forget)
    query(
      `UPDATE gateway_counters
          SET value = value + 1, updated_at = NOW()
        WHERE key = 'bots_blocked'`,
    ).catch((err) => {
      console.error("[rate-limiter] Failed to increment bots_blocked:", err.message);
    });

    console.log("[rate-limiter] ⛔ 429 BLOCKED — Spam Shield Triggered");

    res.status(options.statusCode).json(options.message);
  },
});

export default rateLimiter;
