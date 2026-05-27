import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { createClient } from "redis";
import { query } from "../db/connection.js";

// Create a Redis client. Uses REDIS_URL from the environment.
export const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://redis:6379",
});

// Connect to Redis. In production, you would handle connection errors robustly.
try {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
} catch (err) {
  console.error("Redis connection error:", err);
}

// Developer Bypass condition
const skipRateLimit = (req) => {
  const ip = req.ip || req.socket?.remoteAddress || "";
  return (
    process.env.NODE_ENV === 'development' ||
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip === "::ffff:127.0.0.1" ||
    req.hostname === "localhost"
  );
};

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
  skip: skipRateLimit,
  // Trust proxy is set at the app level; suppress the library's own check
  validate: { trustProxy: false, xForwardedForHeader: false },
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

export const authRateLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
  }),
  windowMs: 60 * 60 * 1000,
  max: 5,
  skip: skipRateLimit,
  validate: { trustProxy: false, xForwardedForHeader: false },
  message: { error: 'Too many login attempts. Your IP has been temporarily locked out for 1 hour for security purposes.' },
});

export const stepUpLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  skip: skipRateLimit,
  validate: { trustProxy: false, xForwardedForHeader: false },
  keyGenerator: (req) => {
    // Rate limit by User ID if authenticated, else use the library's safe IP helper
    return req.user?.id ? `step_up_${req.user.id}` : `step_up_${ipKeyGenerator(req)}`;
  },
  message: { error: 'Too many failed verification attempts. Please try again in 15 minutes.' },
  handler: (req, res, next, options) => {
    console.warn(`[rate-limiter] 🚨 THREAT: Brute-force blocked on Step-Up 2FA. User/IP: ${req.user?.id || req.ip}`);
    res.status(options.statusCode).json(options.message);
  }
});

export const webhookIngressLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
  }),
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: skipRateLimit,
  validate: { trustProxy: false, xForwardedForHeader: false },
  keyGenerator: (req) => {
    // Rate limit per IP address for DDoS protection, using the library's safe IPv6 helper
    return `webhook_ingress_ip_${ipKeyGenerator(req)}`;
  },
  message: { error: 'Too Many Requests' },
  handler: (req, res, next, options) => {
    console.warn(`[rate-limiter] 🚨 THREAT: Queue flooding blocked from IP ${req.ip || req.socket?.remoteAddress}`);
    res.status(429).json(options.message);
  }
});

export default rateLimiter;
