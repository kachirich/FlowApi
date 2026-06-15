/**
 * destinationMetering.js — shared metering-state cache helpers.
 *
 * The dispatcher reads metering state on the hot path, so it is cached in Redis
 * for 120s. Every settings change or credit mutation MUST invalidate the cache
 * via invalidateMeteringCache() so the dispatcher picks up the new state.
 */
import { query } from "../db/connection.js";
import redisClient from "../utils/redisClient.js";

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
    await redisClient.setEx(key, CACHE_TTL_SECONDS, JSON.stringify(state));
  } catch (err) {
    console.error("[metering] Redis write error:", err.message);
  }

  return state;
}

/** Delete the cached metering state for a destination. */
export async function invalidateMeteringCache(destinationId) {
  try {
    await redisClient.del(meteringCacheKey(destinationId));
  } catch (err) {
    console.error("[metering] Redis invalidation error:", err.message);
  }
}
