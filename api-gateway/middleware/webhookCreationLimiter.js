import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import redisClient from "../utils/redisClient.js";
import logger from "../utils/logger.js";

import { globalKeyGenerator } from "./rateLimiter.js";

const webhookCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // Limit each user to 50 webhook creations per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Trust proxy is set at the app level; suppress the library's own check
  validate: { trustProxy: false, xForwardedForHeader: false, default: false },
  
  // Use the Redis store
  store: new RedisStore({
    sendCommand: (...args) => redisClient.call(...args),
    prefix: "rl:webhook_create:",
  }),

  // Group by req.user.id or IP address globally to prevent shared IP lockouts
  keyGenerator: globalKeyGenerator,

  handler: (req, res) => {
    logger.warn(`Webhook creation limit exceeded for user/IP ${globalKeyGenerator(req)}`);
    res.status(429).json({
      success: false,
      message: "Too many webhooks generated recently. Please try again later.",
      error: "Rate limit exceeded"
    });
  }
});

export default webhookCreationLimiter;
