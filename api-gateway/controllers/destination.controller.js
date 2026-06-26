import { query } from '../db/connection.js';
import { validateWebhookUrl } from '../utils/security.js';
import { grantMonthlyCredits } from '../services/destinationMetering.js';
import { encrypt } from '../utils/encryption.js';
import { getAdapter } from '../services/providers/registry.js';

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
    const { name, target_url, daily_cap, is_active, destination_type, provider, api_token } = req.body;

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
    const destType = destination_type || 'webhook';
    const prov = provider || 'generic';
    const encryptedToken = api_token ? encrypt(api_token) : null;

    const result = await query(
      `INSERT INTO destinations (user_id, name, target_url, daily_cap, is_active, destination_type, provider, api_token_encrypted)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, name, target_url, daily_cap, is_active, destination_type, provider, created_at,
                 (api_token_encrypted IS NOT NULL) AS has_token`,
      [userId, sanitizedName, target_url, cap, active, destType, prov, encryptedToken]
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
      `SELECT id, name, target_url, daily_cap, is_active, destination_type, provider, created_at,
              (api_token_encrypted IS NOT NULL) AS has_token
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
    const { name, target_url, daily_cap, is_active, destination_type, provider, api_token } = req.body;

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

    // Token update logic — three cases:
    // 1. api_token provided → re-encrypt (rotation)
    // 2. destination_type explicitly set to 'webhook' → clear token
    // 3. Neither → leave existing token unchanged
    let shouldUpdateToken = false;
    let newEncryptedToken = null;
    if (api_token) {
      shouldUpdateToken = true;
      newEncryptedToken = encrypt(api_token);
    } else if (destination_type === 'webhook') {
      shouldUpdateToken = true;
      newEncryptedToken = null;
    }

    const result = await query(
      `UPDATE destinations
       SET name = COALESCE($1, name),
           target_url = COALESCE($2, target_url),
           daily_cap = COALESCE($3, daily_cap),
           is_active = COALESCE($4, is_active),
           destination_type = COALESCE($5, destination_type),
           provider = COALESCE($6, provider),
           api_token_encrypted = CASE WHEN $7 THEN $8 ELSE api_token_encrypted END
       WHERE id = $9 AND user_id = $10
       RETURNING id, name, target_url, daily_cap, is_active, destination_type, provider, created_at,
                 (api_token_encrypted IS NOT NULL) AS has_token`,
      [
        sanitizedName !== undefined ? sanitizedName : null,
        target_url !== undefined ? target_url : null,
        cap !== undefined ? cap : null,
        active !== undefined ? active : null,
        destination_type !== undefined ? destination_type : null,
        provider !== undefined ? provider : null,
        shouldUpdateToken,
        newEncryptedToken,
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

/**
 * POST /api/destinations/browse
 * Lazy resource picker for browsable providers (e.g. NocoDB base → table).
 * The token is used only to query the provider's meta API; only resource
 * names/ids/resolved-URLs are returned — never the token or raw upstream bodies.
 */
export const browseDestination = async (req, res, next) => {
  try {
    const { provider, api_token, path } = req.body;
    const adapter = getAdapter(provider);
    if (!adapter.browse) {
      return res.status(400).json({ success: false, message: `Provider '${provider}' does not support browsing` });
    }

    const items = await adapter.browse.list(api_token, path || []);
    return res.status(200).json({
      success: true,
      levels: adapter.browse.levels,
      level: (path || []).length,
      items,
    });
  } catch (error) {
    const status = error.response?.status;
    if (status === 401 || status === 403) {
      // 422, NOT 401 — this is the *provider's* token being rejected, not the
      // user's FlowAPI session. A 401 here trips the dashboard's global Axios
      // interceptor, which logs the user out ("Session expired").
      return res.status(422).json({ success: false, message: `${req.body?.provider} rejected the token. Check the API token and try again.` });
    }
    // Never surface the raw upstream body — it can leak internal detail.
    console.error('Error browsing provider:', error.message);
    return res.status(502).json({ success: false, message: 'Could not reach the provider. Please try again.' });
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
