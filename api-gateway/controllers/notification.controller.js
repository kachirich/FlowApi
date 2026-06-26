import { query } from '../db/connection.js';
import { getPreferences, setPreferences, unsubscribeByToken, NOTIFICATION_TYPES } from '../services/notification.service.js';
import { enqueueNotification } from '../services/notification.queue.js';
import { normalizeTier } from '../config/plans.js';

export const getNotificationPreferences = async (req, res) => {
  try {
    const prefs = await getPreferences(req.user.id);
    return res.json({ success: true, preferences: prefs });
  } catch (err) {
    console.error('[NotifCtrl] getPreferences:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to load preferences' });
  }
};

export const updateNotificationPreferences = async (req, res) => {
  try {
    const { preferences } = req.body;
    if (!Array.isArray(preferences)) {
      return res.status(400).json({ success: false, error: 'preferences must be an array' });
    }
    await setPreferences(req.user.id, preferences);
    const updated = await getPreferences(req.user.id);
    return res.json({ success: true, preferences: updated });
  } catch (err) {
    console.error('[NotifCtrl] updatePreferences:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to update preferences' });
  }
};

export const unsubscribe = async (req, res) => {
  try {
    const { token } = req.params;
    const type = req.query.type || 'all';
    const ok = await unsubscribeByToken(token, type);
    if (!ok) {
      return res.status(404).send('<html><body style="font-family:sans-serif;text-align:center;padding:60px;background:#0f0f13;color:#e2e8f0;"><h2 style="color:#ef4444;">Invalid link</h2><p>This unsubscribe link is invalid or has expired.</p></body></html>');
    }
    const label = type === 'all' ? 'all non-essential emails' : type.replace(/_/g, ' ') + ' emails';
    const frontendUrl = process.env.FRONTEND_URL || 'https://flowgateway.dev';
    return res.send(`<html><body style="font-family:sans-serif;text-align:center;padding:60px;background:#0f0f13;color:#e2e8f0;"><h2 style="color:#10b981;">&#10003; Unsubscribed</h2><p style="color:#94a3b8;">You have been unsubscribed from ${label}.</p><a href="${frontendUrl}/dashboard" style="color:#6c63ff;">Manage notification preferences &rarr;</a></body></html>`);
  } catch (err) {
    console.error('[NotifCtrl] unsubscribe:', err.message);
    return res.status(500).send('<html><body style="font-family:sans-serif;text-align:center;padding:60px;"><h2>Something went wrong.</h2></body></html>');
  }
};

export const adminBroadcast = async (req, res) => {
  try {
    const { subject, headline, body_html, cta_label, cta_url, plan_filter } = req.body;
    if (!subject || !headline || !body_html) {
      return res.status(400).json({ success: false, error: 'subject, headline, and body_html are required' });
    }

    let sql = 'SELECT u.id FROM users u JOIN user_billing ub ON ub.user_id = u.id WHERE TRUE';
    const params = [];
    if (Array.isArray(plan_filter) && plan_filter.length > 0) {
      // Accept tier or legacy plan_type names; filter on the canonical tier.
      params.push([...new Set(plan_filter.map(normalizeTier))]);
      sql += ` AND ub.tier = ANY($${params.length})`;
    }

    const result = await query(sql, params);
    const userIds = result.rows.map(r => r.id);

    for (const userId of userIds) {
      await enqueueNotification(userId, NOTIFICATION_TYPES.FEATURE_ANNOUNCEMENT, {
        subject,
        headline,
        body_html,
        cta_label,
        cta_url,
      });
    }

    return res.json({
      success: true,
      queued: userIds.length,
      message: `Broadcast queued for ${userIds.length} user${userIds.length !== 1 ? 's' : ''}`,
    });
  } catch (err) {
    console.error('[NotifCtrl] broadcast:', err.message);
    return res.status(500).json({ success: false, error: 'Broadcast failed' });
  }
};
