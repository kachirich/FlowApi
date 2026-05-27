import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import redisClient from "../utils/redisClient.js";

if (!redisClient.isOpen) {
  await redisClient.connect().catch((err) => console.error("[redis] Error connecting:", err));
}

const webhookCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // Limit each user to 50 webhook creations per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Trust proxy is set at the app level; suppress the library's own check
  validate: { trustProxy: false, xForwardedForHeader: false },
  
  // Use the Redis store
  store: new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
    prefix: "rl:webhook_create:",
  }),

  // Group by req.user.id instead of IP address to prevent shared IP lockouts
  keyGenerator: (req) => {
    if (!req.user || !req.user.id) {
      return ipKeyGenerator(req); // Safe fallback using the library's IPv6-aware helper
    }
    return req.user.id;
  },

  handler: (req, res) => {
    console.warn(`[rate-limit] Webhook creation limit exceeded for user ${req.user?.id || req.ip}`);
    res.status(429).json({
      success: false,
      message: "Too many webhooks generated recently. Please try again later.",
      error: "Rate limit exceeded"
    });
  }
});

export default webhookCreationLimiter;
