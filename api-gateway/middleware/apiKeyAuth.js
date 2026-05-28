import crypto from 'crypto';
import { query } from '../db/connection.js';

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

    // Query the database for the hash
    const result = await query(
      `SELECT api_keys.id AS key_id, users.id AS user_id, users.email, users.plan_type 
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

    const { key_id, user_id, email, plan_type } = result.rows[0];

    // Update last_used_at in the background (no need to await)
    query(
      `UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`,
      [key_id]
    ).catch(err => console.error('Failed to update last_used_at:', err));

    // Attach user information to req.user for downstream middleware/controllers
    req.user = {
      id: user_id,
      email: email,
      plan_type: plan_type
    };

    next();
  } catch (error) {
    console.error('API Key Auth error:', error);
    const err = new Error('Internal Server Error during authentication');
    err.name = 'Internal Server Error';
    err.status = 500;
    next(err);
  }
};
