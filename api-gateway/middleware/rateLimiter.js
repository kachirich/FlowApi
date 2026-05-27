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

// Unified Key Generator: Prioritize User ID, fallback to Client IP
export const globalKeyGenerator = (req) => {
  if (req.user && req.user.id) return String(req.user.id);
  if (req.userId) return String(req.userId);
  return getClientIp(req);
};

// Developer Bypass condition
const skipRateLimit = (req) => {
  const identifier = globalKeyGenerator(req);
  return (
    process.env.NODE_ENV === 'development' ||
    identifier === "127.0.0.1" ||
    identifier === "::1" ||
    identifier === "::ffff:127.0.0.1" ||
    req.hostname === "localhost"
  );
};

export const otpVerificationLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
    prefix: 'rl_otp_verify_',
  }),
  windowMs: 10 * 60 * 1000,
  max: 5,
  skip: skipRateLimit,
  keyGenerator: globalKeyGenerator,
  validate: { trustProxy: false, xForwardedForHeader: false, default: false },
  message: { error: 'Too many verification attempts. Please try again in 10 minutes.' },
});

export const otpGenerationLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
    prefix: 'rl_otp_gen_',
  }),
  windowMs: 10 * 60 * 1000,
  max: 15,
  skip: skipRateLimit,
  keyGenerator: globalKeyGenerator,
  validate: { trustProxy: false, xForwardedForHeader: false, default: false },
  message: { error: 'Too many OTP requests. Please wait before generating another.' },
});

export const authRateLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
    prefix: 'rl_auth_',
  }),
  windowMs: 60 * 60 * 1000,
  max: 50, // Temporarily increased to 50 for frontend testing
  skip: skipRateLimit,
  keyGenerator: globalKeyGenerator,
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
  keyGenerator: globalKeyGenerator,
  message: { error: 'Too many failed verification attempts. Please try again in 15 minutes.' },
  handler: (req, res, next, options) => {
    console.warn(`[rate-limiter] 🚨 THREAT: Brute-force blocked on Step-Up 2FA. User/IP: ${globalKeyGenerator(req)}`);
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
  keyGenerator: globalKeyGenerator,
  message: { error: 'Too Many Requests' },
  handler: (req, res, next, options) => {
    // Spam Shield: Record bot breaches on webhook endpoints
    query(
      `UPDATE gateway_counters
          SET value = value + 1, updated_at = NOW()
        WHERE key = 'bots_blocked'`,
    ).catch((err) => {
      console.error("[rate-limiter] Failed to increment bots_blocked:", err.message);
    });

    const identifier = globalKeyGenerator(req);
    console.log("[rate-limiter] ⛔ 429 BLOCKED — Spam Shield Triggered");
    console.warn(`[rate-limiter] 🚨 THREAT: Queue flooding blocked from User/IP ${identifier}`);
    res.status(429).json(options.message);
  }
});
