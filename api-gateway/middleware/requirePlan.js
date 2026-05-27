import { redisClient } from "./rateLimiter.js";
import { query } from "../db/connection.js";

/**
 * Redis cache key for a user's plan tier.
 * Centralised here so every invalidation site uses the same format.
 *
 * @param {string|number} userId
 * @returns {string} e.g. "user:42:plan"
 */
export const planCacheKey = (userId) => `user:${userId}:plan`;

/**
 * Retrieves the user's plan type from Redis (fast path) or Postgres (fallback).
 * If fetched from Postgres, the cache is populated with a 15-minute TTL.
 *
 * @param {string|number} userId
 * @returns {Promise<string>} The user's plan type (e.g. 'free', 'pro')
 */
export async function getPlanType(userId) {
  const cacheKey = planCacheKey(userId);
  let planType;

  // ── Step 1: Redis look-up (fast path) ────────────────────────────
  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      planType = cached;
    }
  } catch (redisErr) {
    // Redis down → fall through to Postgres; never block the request
    console.error("[getPlanType] Redis read error (falling back to Postgres):", redisErr.message);
  }

  // ── Step 2: Postgres look-up (cache miss) ────────────────────────
  if (!planType) {
    const result = await query(
      "SELECT plan_type FROM users WHERE id = $1",
      [userId],
    );

    if (result.rows.length === 0) {
      return null;
    }

    planType = result.rows[0].plan_type || "free";

    // Back-fill cache with 15-minute TTL (non-blocking)
    redisClient
      .set(cacheKey, planType, { EX: 900 })
      .catch((err) =>
        console.error("[getPlanType] Redis write error:", err.message),
      );
  }

  return planType;
}

/**
 * requirePlan(...allowedPlans)
 *
 * Express middleware factory that authorises a request only when the
 * authenticated user's billing tier is in `allowedPlans`.
 *
 * Resolution order (Redis → Postgres):
 *   1. Check Redis  →  `user:<id>:plan`
 *   2. Cache miss   →  SELECT plan_type FROM users, then SET with 15-min TTL
 *
 * The user's plan is attached to `req.user.plan_type` for downstream use,
 * keeping ALL per-request state on the `req` object — never in module scope.
 *
 * @param  {...string} allowedPlans  e.g. "basic", "pro", "plus"
 * @returns {Function} Express middleware
 *
 * @example
 *   router.get("/premium", authenticate, requirePlan("pro", "plus"), handler);
 */
export default function requirePlan(...allowedPlans) {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized: User identity missing",
        });
      }

      const planType = await getPlanType(userId);

      if (!planType) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized: User not found",
        });
      }

      // ── Step 3: Attach to request and authorise ──────────────────────
      req.user.plan_type = planType;

      if (!allowedPlans.includes(planType)) {
        return res.status(403).json({
          success: false,
          error: "Upgrade required",
          message: `This feature requires one of the following plans: ${allowedPlans.join(", ")}`,
          currentPlan: planType,
        });
      }

      next();
    } catch (err) {
      console.error("[requirePlan] Unexpected error:", err.message);
      next(err);
    }
  };
}
