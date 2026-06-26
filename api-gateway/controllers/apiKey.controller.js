import crypto from 'crypto';
import { query } from '../db/connection.js';
import { invalidateApiKeyCache } from '../middleware/apiKeyAuth.js';

export const generateKey = async (req, res) => {
  try {
    const userId = req.user.id; // From authenticate middleware
    // Validated by generateKeySchema: ISO string in the future (≤5y), or null.
    const expiresAt = req.body.expires_at || null;

    // Generate random raw key
    const rawKey = `flow_live_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const prefix = 'flow_live_';
    const lastFour = rawKey.slice(-4);

    // Insert into DB
    const insertResult = await query(
      `INSERT INTO api_keys (user_id, key_hash, prefix, last_four, expires_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at, expires_at`,
      [userId, keyHash, prefix, lastFour, expiresAt]
    );

    const { id, created_at, expires_at } = insertResult.rows[0];

    // Return the raw key EXACTLY ONCE. trustedDeviceToken (minted by stepUpAuth)
    // lets the client skip the OTP prompt for the next 72h.
    return res.status(201).json({
      success: true,
      message: 'API Key generated successfully. Please save this key now as you will not be able to see it again.',
      trustedDeviceToken: res.locals.trustedDeviceToken,
      key: {
        id,
        raw_key: rawKey,
        prefix,
        last_four: lastFour,
        created_at,
        expires_at
      }
    });
  } catch (error) {
    console.error('Error generating API key:', error);
    return res.status(500).json({ error: 'Failed to generate API key' });
  }
};

export const listKeys = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await query(
      `SELECT id, prefix, last_four, flow_id, created_at, last_used_at, expires_at
       FROM api_keys
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    return res.status(200).json({
      success: true,
      keys: result.rows
    });
  } catch (error) {
    console.error('Error listing API keys:', error);
    return res.status(500).json({ error: 'Failed to list API keys' });
  }
};

export const revokeKey = async (req, res) => {
  try {
    const userId = req.user.id;
    const keyId = req.params.id;

    if (!keyId) {
      return res.status(400).json({ error: 'Key ID is required' });
    }

    // Retrieve hash before deletion to invalidate cache
    const keyResult = await query(
      `SELECT key_hash FROM api_keys WHERE id = $1 AND user_id = $2`,
      [keyId, userId]
    );

    if (keyResult.rowCount === 0) {
      return res.status(404).json({ error: 'API Key not found or already revoked' });
    }

    const keyHash = keyResult.rows[0].key_hash;

    await query(
      `DELETE FROM api_keys WHERE id = $1`,
      [keyId]
    );

    // Invalidate cache
    await invalidateApiKeyCache(keyHash);

    return res.status(200).json({ success: true, message: 'API Key revoked successfully' });
  } catch (error) {
    console.error('Error revoking API key:', error);
    return res.status(500).json({ error: 'Failed to revoke API key' });
  }
};

/**
 * PUT /api/keys/:id/flow
 * body: { flow_id | null }
 *
 * Assigns (or, with null, unassigns) a Flow to an API key. The flow must belong
 * to the requesting user. The cached key payload is invalidated so subsequent
 * ingest requests pick up the new flow routing immediately.
 */
export const assignKeyFlow = async (req, res) => {
  try {
    const userId = req.user.id;
    const keyId = req.params.id;
    const { flow_id } = req.body; // validated by assignFlowSchema (uuid | null)

    // Verify the key belongs to the user (also grab the hash for cache busting)
    const keyResult = await query(
      `SELECT id, key_hash FROM api_keys WHERE id = $1 AND user_id = $2`,
      [keyId, userId]
    );
    if (keyResult.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'API Key not found' });
    }

    // If assigning (not unassigning), verify the flow belongs to the user
    if (flow_id) {
      const flowResult = await query(
        `SELECT id FROM flows WHERE id = $1 AND user_id = $2`,
        [flow_id, userId]
      );
      if (flowResult.rowCount === 0) {
        return res.status(404).json({ success: false, message: 'Flow not found' });
      }
    }

    const updated = await query(
      `UPDATE api_keys SET flow_id = $1 WHERE id = $2
       RETURNING id, prefix, last_four, flow_id, created_at, last_used_at`,
      [flow_id || null, keyId]
    );

    // Invalidate the cached auth payload so the new flow_id is honoured at once
    await invalidateApiKeyCache(keyResult.rows[0].key_hash);

    return res.status(200).json({ success: true, key: updated.rows[0] });
  } catch (error) {
    console.error('Error assigning flow to API key:', error);
    return res.status(500).json({ error: 'Failed to assign flow to API key' });
  }
};

/**
 * POST /api/keys/:id/signing-secret
 *
 * Generates (or rotates) the HMAC signing secret for a key and returns it ONCE.
 * The secret is never returned by any subsequent GET — treat it like a client
 * secret. Caller must own the key.
 */
export const rotateSigningSecret = async (req, res) => {
  try {
    const userId = req.user.id;
    const keyId = req.params.id;

    const keyResult = await query(
      `SELECT key_hash FROM api_keys WHERE id = $1 AND user_id = $2`,
      [keyId, userId]
    );
    if (keyResult.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'API Key not found' });
    }

    const signingSecret = crypto.randomBytes(32).toString('hex');

    await query(
      `UPDATE api_keys SET signing_secret = $1 WHERE id = $2`,
      [signingSecret, keyId]
    );

    // Invalidate cache so the new secret is used on the next request
    await invalidateApiKeyCache(keyResult.rows[0].key_hash);

    return res.status(201).json({
      success: true,
      message: 'Signing secret generated. Save it now — it will not be shown again.',
      signing_secret: signingSecret,
    });
  } catch (error) {
    console.error('Error rotating signing secret:', error);
    return res.status(500).json({ error: 'Failed to rotate signing secret' });
  }
};

/**
 * DELETE /api/keys/:id/signing-secret
 *
 * Removes the signing secret and disables signature enforcement for the key.
 */
export const deleteSigningSecret = async (req, res) => {
  try {
    const userId = req.user.id;
    const keyId = req.params.id;

    const keyResult = await query(
      `SELECT key_hash FROM api_keys WHERE id = $1 AND user_id = $2`,
      [keyId, userId]
    );
    if (keyResult.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'API Key not found' });
    }

    await query(
      `UPDATE api_keys SET signing_secret = NULL, require_signature = FALSE WHERE id = $1`,
      [keyId]
    );

    await invalidateApiKeyCache(keyResult.rows[0].key_hash);

    return res.status(200).json({ success: true, message: 'Signing secret removed' });
  } catch (error) {
    console.error('Error deleting signing secret:', error);
    return res.status(500).json({ error: 'Failed to delete signing secret' });
  }
};

/**
 * PUT /api/keys/:id/signature-required
 * body: { required: boolean }
 *
 * Toggles HMAC signature enforcement. Cannot be enabled until a signing secret
 * exists for the key.
 */
export const setSignatureRequired = async (req, res) => {
  try {
    const userId = req.user.id;
    const keyId = req.params.id;
    const { required } = req.body; // validated boolean

    const keyResult = await query(
      `SELECT key_hash, signing_secret FROM api_keys WHERE id = $1 AND user_id = $2`,
      [keyId, userId]
    );
    if (keyResult.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'API Key not found' });
    }

    if (required === true && !keyResult.rows[0].signing_secret) {
      return res.status(400).json({
        success: false,
        message: 'Generate a signing secret before requiring signatures.',
      });
    }

    await query(
      `UPDATE api_keys SET require_signature = $1 WHERE id = $2`,
      [required === true, keyId]
    );

    await invalidateApiKeyCache(keyResult.rows[0].key_hash);

    return res.status(200).json({ success: true, require_signature: required === true });
  } catch (error) {
    console.error('Error setting signature requirement:', error);
    return res.status(500).json({ error: 'Failed to update signature requirement' });
  }
};
