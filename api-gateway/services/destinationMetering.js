/**
 * destinationMetering.js — shared metering-state cache helpers.
 *
 * The dispatcher reads metering state on the hot path, so it is cached in Redis
 * for 120s. Every settings change or credit mutation MUST invalidate the cache
 * via invalidateMeteringCache() so the dispatcher picks up the new state.
 */
import { query } from "../db/connection.js";
import redisClient from "../utils/redisClient.js";
import { planFor } from "../config/plans.js";

const CACHE_TTL_SECONDS = 120;

export const meteringCacheKey = (destinationId) => `dest:metering:${destinationId}`;

const DEFAULT_STATE = { is_metered: false, exhausted_action: "continue", balance: 0 };

/**
 * Returns { is_metered, exhausted_action, balance } for a destination.
 * Redis first, Postgres fallback. Destinations with no balance row return the
 * default (un-metered) state so delivery behaviour is unchanged.
 */
export async function getMeteringState(destinationId) {
  const key = meteringCacheKey(destinationId);

  try {
    const cached = await redisClient.get(key);
    if (cached) return JSON.parse(cached);
  } catch (err) {
    console.error("[metering] Redis read error (falling back to Postgres):", err.message);
  }

  const result = await query(
    "SELECT is_metered, exhausted_action, balance FROM destination_balances WHERE destination_id = $1",
    [destinationId]
  );

  const state = result.rows[0]
    ? {
        is_metered: result.rows[0].is_metered,
        exhausted_action: result.rows[0].exhausted_action,
        balance: result.rows[0].balance,
      }
    : { ...DEFAULT_STATE };

  try {
    await redisClient.setex(key, CACHE_TTL_SECONDS, JSON.stringify(state));
  } catch (err) {
    console.error("[metering] Redis write error:", err.message);
  }

  return state;
}

/**
 * Grant monthly credits to a destination based on the user's tier.
 * Idempotent: skips if a grant has already been issued for the current month
 * (grant_expires_at > NOW()). Safe to call on destination create and tier upgrade.
 *
 * @param {string} destinationId
 * @param {string} userId
 * @param {string} tier  'sandbox' | 'growth' | 'enterprise' (legacy plan_type also accepted)
 */
export async function grantMonthlyCredits(destinationId, userId, tier) {
  const amount = planFor(tier).monthlyCredits;

  // Check if a grant was already issued for the current calendar month
  const existing = await query(
    "SELECT grant_expires_at FROM destination_balances WHERE destination_id = $1",
    [destinationId]
  );
  if (existing.rows[0]?.grant_expires_at && new Date(existing.rows[0].grant_expires_at) > new Date()) {
    return; // already granted this month
  }

  // Upsert balance row: increment balance + set grant metadata
  await query(
    `INSERT INTO destination_balances (destination_id, user_id, balance, monthly_grant, grant_expires_at)
     VALUES ($1, $2, $3, $3, date_trunc('month', NOW()) + INTERVAL '1 month')
     ON CONFLICT (destination_id) DO UPDATE SET
       balance          = destination_balances.balance + $3,
       monthly_grant    = $3,
       grant_expires_at = date_trunc('month', NOW()) + INTERVAL '1 month',
       updated_at       = NOW()`,
    [destinationId, userId, amount]
  );

  await query(
    `INSERT INTO balance_transactions (destination_id, user_id, type, amount, pack_name, note)
     VALUES ($1, $2, 'credit', $3, 'monthly_grant', $4)`,
    [destinationId, userId, amount, `Monthly grant — ${tier} tier`]
  );

  await invalidateMeteringCache(destinationId);
}

/** Delete the cached metering state for a destination. */
export async function invalidateMeteringCache(destinationId) {
  try {
    await redisClient.del(meteringCacheKey(destinationId));
  } catch (err) {
    console.error("[metering] Redis invalidation error:", err.message);
  }
}
