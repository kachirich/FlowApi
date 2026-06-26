import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import redisClient from "../utils/redisClient.js";
import logger from "../utils/logger.js";
import { query } from "../db/connection.js";
import { planFor } from "../config/plans.js";

// Re-export the shared ioredis singleton so existing importers that pull
// `redisClient` from this module (routes, controllers, requirePlan) keep
// working after the node-redis → ioredis consolidation.
export { redisClient };

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
    sendCommand: (...args) => redisClient.call(...args),
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
    sendCommand: (...args) => redisClient.call(...args),
    prefix: 'rl_otp_gen_',
  }),
  windowMs: 10 * 60 * 1000,
  max: 15,
  skip: skipRateLimit,
  keyGenerator: globalKeyGenerator,
  validate: { trustProxy: false, xForwardedForHeader: false, default: false },
  message: { error: 'Too many OTP requests. Please wait before generating another.' },
});

/**
 * Aggressive Sandbox Rate Limiter
 * Strict max of 10 test execution requests per minute per user/IP
 * Prevents abuse: DDoS proxies, webhook flooding, SSRF scanning
 */
export const sandboxEgressLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args) => redisClient.call(...args),
    prefix: 'rl_sandbox_egress_',
  }),
  windowMs: 60 * 1000, // 1 minute window
  max: 10, // 10 requests per minute
  skip: skipRateLimit,
  keyGenerator: globalKeyGenerator,
  validate: { trustProxy: false, xForwardedForHeader: false, default: false },
  standardHeaders: false, // Disable default headers
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Sandbox test execution rate limit exceeded. Maximum 10 requests per minute.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
    });
  },
});

export const authRateLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args) => redisClient.call(...args),
    prefix: 'rl_auth_',
  }),
  windowMs: 60 * 60 * 1000,
  max: 10,
  skip: skipRateLimit,
  keyGenerator: globalKeyGenerator,
  validate: { trustProxy: false, xForwardedForHeader: false, default: false },
  message: { error: 'Too many login attempts. Your IP has been temporarily locked out for 1 hour for security purposes.' },
});

export const stepUpLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args) => redisClient.call(...args),
    prefix: 'rl_stepup_',
  }),
  windowMs: 15 * 60 * 1000,
  max: 10,
  skip: skipRateLimit,
  validate: { trustProxy: false, xForwardedForHeader: false, default: false },
  keyGenerator: globalKeyGenerator,
  message: { error: 'Too many failed verification attempts. Please try again in 15 minutes.' },
  handler: (req, res, next, options) => {
    logger.warn(`Brute-force blocked on Step-Up 2FA. User/IP: ${globalKeyGenerator(req)}`);
    res.status(options.statusCode).json(options.message);
  }
});

/**
 * Per-API-key burst limiter.
 *
 * Short-window throughput guard for the ingestion endpoints: 100 requests per
 * minute keyed on the API key (x-api-key header) or, on the dynamic dispatcher,
 * the :webhook_id URL param. Complements webhookIngressLimiter (a 24h daily
 * cap) by stopping a single key from flooding the gateway in bursts.
 * Responds 429 with a Retry-After header.
 */
const perKeyKeyGenerator = (req) => {
  const apiKey = req.headers["x-api-key"];
  if (apiKey) return `key:${apiKey}`;
  if (req.params && req.params.webhook_id) return `wh:${req.params.webhook_id}`;
  return getClientIp(req);
};

export const perKeyBurstLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args) => redisClient.call(...args),
    prefix: 'rl_perkey_burst_',
  }),
  windowMs: 60 * 1000, // 1 minute
  max: 100,            // 100 requests per minute per key
  skip: skipRateLimit,
  keyGenerator: perKeyKeyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false, xForwardedForHeader: false, default: false },
  handler: (req, res) => {
    const retryAfterSec = Math.max(1, Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000));
    res.set("Retry-After", String(retryAfterSec));
    res.status(429).json({
      success: false,
      error: "Too Many Requests",
      message: "Per-key rate limit exceeded (100 requests/minute). Slow down and retry.",
      retryAfter: retryAfterSec,
    });
  },
});

export const webhookIngressLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args) => redisClient.call(...args),
    prefix: 'rl_webhook_ingress_',
  }),
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: async (req, res) => planFor(req.user?.tier).dailyLeadCap,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipRateLimit,
  validate: { trustProxy: false, xForwardedForHeader: false, default: false },
  keyGenerator: globalKeyGenerator,
  message: { error: 'Daily lead cap reached. Please upgrade your tier or wait until tomorrow.' },
  handler: (req, res, next, options) => {
    // Spam Shield: Record bot breaches on webhook endpoints
    query(
      `UPDATE gateway_counters
          SET value = value + 1, updated_at = NOW()
        WHERE key = 'bots_blocked'`,
    ).catch((err) => {
      logger.error({ err }, "Failed to increment bots_blocked");
    });

    const identifier = globalKeyGenerator(req);
    logger.info("Daily cap reached (429 response)");
    logger.warn(`Cap reached for: ${identifier}`);
    res.status(429).json(options.message);
  }
});
