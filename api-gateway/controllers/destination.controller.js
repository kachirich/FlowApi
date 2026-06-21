import { query } from '../db/connection.js';
import { validateWebhookUrl } from '../utils/security.js';
import { grantMonthlyCredits } from '../services/destinationMetering.js';

const sanitizeName = (str) => {
  if (typeof str !== 'string') return '';
  const trimmed = str.trim();
  // Strip HTML/Script tags to prevent stored XSS attacks
  const stripped = trimmed.replace(/<\/?[^>]+(>|$)/g, "");
  return stripped.slice(0, 50);
};

export const createDestination = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { name, target_url, daily_cap, is_active } = req.body;

    if (!name || !target_url) {
      const error = new Error('Name and target_url are required');
      error.name = 'ValidationError';
      error.status = 400;
      return next(error);
    }

    const { isValid } = validateWebhookUrl(target_url);
    if (!isValid) {
      const error = new Error('Invalid or restricted Destination URL.');
      error.name = 'ValidationError';
      error.status = 400;
      return next(error);
    }

    const sanitizedName = sanitizeName(name);
    if (!sanitizedName) {
      const error = new Error('Name is invalid or empty after sanitization');
      error.name = 'ValidationError';
      error.status = 400;
      return next(error);
    }

    // Check user tier and destination limits
    const checkTierResult = await query(`SELECT tier FROM user_billing WHERE user_id = $1`, [userId]);
    const userTier = checkTierResult.rows[0]?.tier || 'sandbox';

    const countResult = await query(`SELECT COUNT(*) FROM destinations WHERE user_id = $1 AND is_active = TRUE`, [userId]);
    const activeCount = parseInt(countResult.rows[0].count, 10);

    if (userTier === 'sandbox' && activeCount >= 1) {
      return res.status(403).json({ error: 'Upgrade tier to add more destinations.' });
    } else if (userTier === 'growth' && activeCount >= 5) {
      return res.status(403).json({ error: 'Upgrade tier to add more destinations.' });
    }

    let cap = 0;
    if (daily_cap !== undefined && daily_cap !== null && daily_cap !== '') {
      const parsed = Number(daily_cap);
      if (!Number.isInteger(parsed) || parsed < 0) {
        const error = new Error('Daily cap must be a non-negative integer');
        error.name = 'ValidationError';
        error.status = 400;
        return next(error);
      }
      cap = parsed;
    }

    const active = is_active !== undefined ? Boolean(is_active) : true;

    const result = await query(
      `INSERT INTO destinations (user_id, name, target_url, daily_cap, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, target_url, daily_cap, is_active, created_at`,
      [userId, sanitizedName, target_url, cap, active]
    );

    // Issue the first monthly credit grant for this destination (fire-and-forget)
    const billingRow = await query("SELECT plan_type FROM user_billing WHERE user_id = $1", [userId]);
    const planType = billingRow.rows[0]?.plan_type || 'free';
    grantMonthlyCredits(result.rows[0].id, userId, planType).catch((err) =>
      console.error("[destination] Monthly grant failed:", err.message)
    );

    return res.status(201).json({
      success: true,
      destination: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating destination:', error);
    next(error);
  }
};

export const listDestinations = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const result = await query(
      `SELECT id, name, target_url, daily_cap, is_active, created_at
       FROM destinations
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    return res.status(200).json({
      success: true,
      destinations: result.rows
    });
  } catch (error) {
    console.error('Error listing destinations:', error);
    next(error);
  }
};

export const updateDestination = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const destinationId = req.params.id;
    const { name, target_url, daily_cap, is_active } = req.body;

    if (!destinationId) {
      const error = new Error('Destination ID is required');
      error.name = 'ValidationError';
      error.status = 400;
      return next(error);
    }

    // Check if the destination exists and belongs to the user
    const checkResult = await query(
      `SELECT id FROM destinations WHERE id = $1 AND user_id = $2`,
      [destinationId, userId]
    );

    if (checkResult.rows.length === 0) {
      const error = new Error('Destination not found');
      error.name = 'NotFoundError';
      error.status = 404;
      return next(error);
    }

    let sanitizedName;
    if (name !== undefined) {
      sanitizedName = sanitizeName(name);
      if (!sanitizedName) {
        const error = new Error('Name is invalid or empty after sanitization');
        error.name = 'ValidationError';
        error.status = 400;
        return next(error);
      }
    }

    if (target_url !== undefined) {
      const { isValid } = validateWebhookUrl(target_url);
      if (!isValid) {
        const error = new Error('Invalid or restricted Destination URL.');
        error.name = 'ValidationError';
        error.status = 400;
        return next(error);
      }
    }

    let cap;
    if (daily_cap !== undefined) {
      if (daily_cap === null || daily_cap === '') {
        cap = 0;
      } else {
        const parsed = Number(daily_cap);
        if (!Number.isInteger(parsed) || parsed < 0) {
          const error = new Error('Daily cap must be a non-negative integer');
          error.name = 'ValidationError';
          error.status = 400;
          return next(error);
        }
        cap = parsed;
      }
    }

    const active = is_active !== undefined ? Boolean(is_active) : undefined;

    const result = await query(
      `UPDATE destinations
       SET name = COALESCE($1, name),
           target_url = COALESCE($2, target_url),
           daily_cap = COALESCE($3, daily_cap),
           is_active = COALESCE($4, is_active)
       WHERE id = $5 AND user_id = $6
       RETURNING id, name, target_url, daily_cap, is_active, created_at`,
      [
        sanitizedName !== undefined ? sanitizedName : null,
        target_url !== undefined ? target_url : null,
        cap !== undefined ? cap : null,
        active !== undefined ? active : null,
        destinationId,
        userId
      ]
    );

    return res.status(200).json({
      success: true,
      destination: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating destination:', error);
    next(error);
  }
};

export const deleteDestination = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const destinationId = req.params.id;

    if (!destinationId) {
      const error = new Error('Destination ID is required');
      error.name = 'ValidationError';
      error.status = 400;
      return next(error);
    }

    const result = await query(
      `DELETE FROM destinations WHERE id = $1 AND user_id = $2 RETURNING id`,
      [destinationId, userId]
    );

    if (result.rowCount === 0) {
      const error = new Error('Destination not found');
      error.name = 'NotFoundError';
      error.status = 404;
      return next(error);
    }

    return res.status(200).json({
      success: true,
      message: 'Destination deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting destination:', error);
    next(error);
  }
};
