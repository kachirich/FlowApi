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

// Helper to extract the true client IP from Nginx headers, bypassing Docker Gateway masking
export const getClientIp = (req) => {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return realIp.trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
};

// Developer Bypass condition
const skipRateLimit = (req) => {
  const ip = getClientIp(req);
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
 */
const rateLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
    prefix: 'rl_global_',
  }),
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: skipRateLimit,
  keyGenerator: (req) => getClientIp(req),
  validate: { trustProxy: false, xForwardedForHeader: false, default: false },
  message: {
    status: 429,
    error: "Too Many Requests",
    message: "You have exceeded the allowed number of requests. Please try again later.",
  },
  handler: (_req, res, _next, options) => {
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
    prefix: 'rl_auth_',
  }),
  windowMs: 60 * 60 * 1000,
  max: 50, // Temporarily increased to 50 for frontend testing
  skip: skipRateLimit,
  keyGenerator: (req) => getClientIp(req),
  validate: { trustProxy: false, xForwardedForHeader: false, default: false },
  message: { error: 'Too many login attempts. Your IP has been temporarily locked out for 1 hour for security purposes.' },
});

export const stepUpLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
    prefix: 'rl_stepup_',
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Temporarily increased to 50 for frontend testing
  skip: skipRateLimit,
  validate: { trustProxy: false, xForwardedForHeader: false, default: false },
  keyGenerator: (req) => {
    return req.user?.id ? `step_up_${req.user.id}` : `step_up_${getClientIp(req)}`;
  },
  message: { error: 'Too many failed verification attempts. Please try again in 15 minutes.' },
  handler: (req, res, next, options) => {
    console.warn(`[rate-limiter] 🚨 THREAT: Brute-force blocked on Step-Up 2FA. User/IP: ${req.user?.id || getClientIp(req)}`);
    res.status(options.statusCode).json(options.message);
  }
});

export const webhookIngressLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
    prefix: 'rl_webhook_ingress_',
  }),
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipRateLimit,
  validate: { trustProxy: false, xForwardedForHeader: false, default: false },
  keyGenerator: (req) => {
    return `webhook_ingress_ip_${getClientIp(req)}`;
  },
  message: { error: 'Too Many Requests' },
  handler: (req, res, next, options) => {
    console.warn(`[rate-limiter] 🚨 THREAT: Queue flooding blocked from IP ${getClientIp(req)}`);
    res.status(429).json(options.message);
  }
});

export default rateLimiter;
