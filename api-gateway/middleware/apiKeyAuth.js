import crypto from 'crypto';
import { query } from '../db/connection.js';
import redisClient from '../utils/redisClient.js';

/**
 * Middleware for authenticating requests using API Keys.
 * Intended for inbound webhook traffic or programmatic access.
 */
export const apiKeyAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const error = new Error('Authentication required — no API key provided');
      error.name = 'Unauthorized';
      error.status = 401;
      return next(error);
    }

    const token = authHeader.split(' ')[1];

    // Hash the provided token
    const keyHash = crypto.createHash('sha256').update(token).digest('hex');
    const cacheKey = `apikey:${keyHash}`;

    // 1. Try fetching from Redis (Edge Authentication)
    try {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        req.user = parsed;

        // Background update of last_used_at to Postgres (fire and forget)
        query(
          `UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`,
          [parsed.key_id]
        ).catch(err => console.error('Failed to update last_used_at (cache hit):', err));

        return next();
      }
    } catch (redisErr) {
      console.error('Redis cache error during API key auth:', redisErr);
      // Fallback to Postgres if Redis fails
    }

    // 2. Cache miss -> Query the database for the hash
    const result = await query(
      `SELECT api_keys.id AS key_id, users.id AS user_id, users.email, users.tier 
       FROM api_keys
       JOIN users ON api_keys.user_id = users.id
       WHERE api_keys.key_hash = $1`,
      [keyHash]
    );

    if (result.rows.length === 0) {
      const error = new Error('Invalid API Key');
      error.name = 'Unauthorized';
      error.status = 401;
      return next(error);
    }

    const { key_id, user_id, email, tier } = result.rows[0];

    const userPayload = {
      key_id,
      id: user_id,
      email,
      tier
    };

    // 3. Save to Redis for subsequent requests (1 hour expiration)
    try {
      await redisClient.setEx(cacheKey, 3600, JSON.stringify(userPayload));
    } catch (redisErr) {
      console.error('Failed to cache API key payload to Redis:', redisErr);
    }

    // Update last_used_at in the background (no need to await)
    query(
      `UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`,
      [key_id]
    ).catch(err => console.error('Failed to update last_used_at:', err));

    // Attach user information to req.user for downstream middleware/controllers
    req.user = userPayload;

    next();
  } catch (error) {
    console.error('API Key Auth error:', error);
    const err = new Error('Internal Server Error during authentication');
    err.name = 'Internal Server Error';
    err.status = 500;
    next(err);
  }
};
