import crypto from 'crypto';
import { query } from '../db/connection.js';

export const generateKey = async (req, res) => {
  try {
    const userId = req.user.id; // From authenticate middleware

    // Generate random raw key
    const rawKey = `flow_live_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const prefix = 'flow_live_';
    const lastFour = rawKey.slice(-4);

    // Insert into DB
    const insertResult = await query(
      `INSERT INTO api_keys (user_id, key_hash, prefix, last_four)
       VALUES ($1, $2, $3, $4) RETURNING id, created_at`,
      [userId, keyHash, prefix, lastFour]
    );

    const { id, created_at } = insertResult.rows[0];

    // Return the raw key EXACTLY ONCE
    return res.status(201).json({
      success: true,
      message: 'API Key generated successfully. Please save this key now as you will not be able to see it again.',
      key: {
        id,
        raw_key: rawKey,
        prefix,
        last_four: lastFour,
        created_at
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
      `SELECT id, prefix, last_four, created_at, last_used_at
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

    const result = await query(
      `DELETE FROM api_keys WHERE id = $1 AND user_id = $2 RETURNING id`,
      [keyId, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'API Key not found or already revoked' });
    }

    return res.status(200).json({ success: true, message: 'API Key revoked successfully' });
  } catch (error) {
    console.error('Error revoking API key:', error);
    return res.status(500).json({ error: 'Failed to revoke API key' });
  }
};
