import { redisClient } from "./rateLimiter.js";
import { query } from "../db/connection.js";
import { normalizeTier } from "../config/plans.js";

/**
 * Redis cache key for a user's plan tier.
 * Centralised here so every invalidation site uses the same format.
 *
 * @param {string|number} userId
 * @returns {string} e.g. "user:42:plan"
 */
export const planCacheKey = (userId) => `user:${userId}:plan`;

/**
 * Retrieves the user's billing tier (sandbox/growth/enterprise) from Redis
 * (fast path) or Postgres (fallback). On a cache miss the value is back-filled
 * with a 15-minute TTL. normalizeTier() coerces any legacy plan_type value, so
 * Redis entries cached before the tier cutover resolve safely.
 *
 * @param {string|number} userId
 * @returns {Promise<string|null>} The user's tier, or null if the user is unknown.
 */
export async function getUserTier(userId) {
  const cacheKey = planCacheKey(userId);
  let tier;

  // ── Step 1: Redis look-up (fast path) ────────────────────────────
  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      tier = normalizeTier(cached);
    }
  } catch (redisErr) {
    // Redis down → fall through to Postgres; never block the request
    console.error("[getUserTier] Redis read error (falling back to Postgres):", redisErr.message);
  }

  // ── Step 2: Postgres look-up (cache miss) ────────────────────────
  if (!tier) {
    const result = await query(
      "SELECT tier FROM user_billing WHERE user_id = $1",
      [userId],
    );

    if (result.rows.length === 0) {
      return null;
    }

    tier = normalizeTier(result.rows[0].tier);

    // Back-fill cache with 15-minute TTL (non-blocking)
    redisClient
      .set(cacheKey, tier, { EX: 900 })
      .catch((err) =>
        console.error("[getUserTier] Redis write error:", err.message),
      );
  }

  return tier;
}

/**
 * requirePlan(...allowedPlans)
 *
 * Express middleware factory that authorises a request only when the
 * authenticated user's billing tier is in `allowedPlans`.
 *
 * Resolution order (Redis → Postgres) via getUserTier(). The resolved tier is
 * attached to `req.user.tier` for downstream use, keeping ALL per-request state
 * on the `req` object — never in module scope. Allowed values may be passed as
 * tiers or legacy plan_type names; both are normalised before comparison.
 *
 * @param  {...string} allowedPlans  e.g. "growth", "enterprise"
 * @returns {Function} Express middleware
 *
 * @example
 *   router.get("/premium", authenticate, requirePlan("growth", "enterprise"), handler);
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

      const tier = await getUserTier(userId);

      if (!tier) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized: User not found",
        });
      }

      // ── Step 3: Attach to request and authorise ──────────────────────
      req.user.tier = tier;

      // Compare on canonical tiers so callers can pass either tiers or legacy
      // plan_type names and still match (e.g. "pro" and "growth" are equal).
      const allowedTiers = allowedPlans.map(normalizeTier);
      if (!allowedTiers.includes(tier)) {
        return res.status(403).json({
          success: false,
          error: "Upgrade required",
          message: `This feature requires one of the following tiers: ${[...new Set(allowedTiers)].join(", ")}`,
          currentPlan: tier,
        });
      }

      next();
    } catch (err) {
      console.error("[requirePlan] Unexpected error:", err.message);
      next(err);
    }
  };
}
