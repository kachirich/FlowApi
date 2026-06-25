import crypto from 'crypto';
import { Resend } from 'resend';
import { query } from '../db/connection.js';
import redisClient from '../utils/redisClient.js';

import { buildEmail as buildFeatureAnnouncement } from '../email-templates/feature_announcement.js';
import { buildEmail as buildOnboarding } from '../email-templates/onboarding.js';
import { buildEmail as buildUsageAlert } from '../email-templates/usage_alert.js';
import { buildEmail as buildDeliveryFailure } from '../email-templates/delivery_failure.js';
import { buildEmail as buildBillingAlert } from '../email-templates/billing_alert.js';
import { buildEmail as buildWeeklyDigest } from '../email-templates/weekly_digest.js';

const resend = new Resend(process.env.RESEND_API_KEY);
const BASE_URL = process.env.FRONTEND_URL || 'https://flowgateway.dev';
const API_URL = process.env.BASE_URL || 'https://flowgateway.dev';

export const NOTIFICATION_TYPES = {
  FEATURE_ANNOUNCEMENT: 'feature_announcement',
  ONBOARDING: 'onboarding',
  USAGE_ALERT: 'usage_alert',
  DELIVERY_FAILURE: 'delivery_failure',
  BILLING_ALERT: 'billing_alert',
  WEEKLY_DIGEST: 'weekly_digest',
};

// Transactional — cannot be disabled by the user
const TRANSACTIONAL = new Set([NOTIFICATION_TYPES.BILLING_ALERT]);

const TEMPLATE_MAP = {
  [NOTIFICATION_TYPES.FEATURE_ANNOUNCEMENT]: buildFeatureAnnouncement,
  [NOTIFICATION_TYPES.ONBOARDING]: buildOnboarding,
  [NOTIFICATION_TYPES.USAGE_ALERT]: buildUsageAlert,
  [NOTIFICATION_TYPES.DELIVERY_FAILURE]: buildDeliveryFailure,
  [NOTIFICATION_TYPES.BILLING_ALERT]: buildBillingAlert,
  [NOTIFICATION_TYPES.WEEKLY_DIGEST]: buildWeeklyDigest,
};

export async function getOrCreateUnsubscribeToken(userId) {
  const res = await query('SELECT unsubscribe_token FROM users WHERE id = $1', [userId]);
  if (!res.rows[0]) return null;
  if (res.rows[0].unsubscribe_token) return res.rows[0].unsubscribe_token;
  const token = crypto.randomBytes(32).toString('hex');
  await query('UPDATE users SET unsubscribe_token = $1 WHERE id = $2', [token, userId]);
  return token;
}

export async function getPreferences(userId) {
  try {
    const saved = await query(
      'SELECT type, enabled FROM notification_preferences WHERE user_id = $1',
      [userId]
    );
    const savedMap = Object.fromEntries(saved.rows.map(r => [r.type, r.enabled]));
    return Object.values(NOTIFICATION_TYPES).map(type => ({
      type,
      enabled: savedMap[type] ?? true,
      locked: TRANSACTIONAL.has(type),
    }));
  } catch (err) {
    if (err.code === '42P01') {
      return Object.values(NOTIFICATION_TYPES).map(type => ({
        type,
        enabled: true,
        locked: TRANSACTIONAL.has(type),
      }));
    }
    throw err;
  }
}

export async function setPreferences(userId, prefs) {
  for (const { type, enabled } of prefs) {
    if (TRANSACTIONAL.has(type)) continue;
    if (!Object.values(NOTIFICATION_TYPES).includes(type)) continue;
    await query(
      `INSERT INTO notification_preferences (user_id, type, enabled)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, type) DO UPDATE SET enabled = $3`,
      [userId, type, Boolean(enabled)]
    );
  }
}

export async function unsubscribeByToken(token, type) {
  const res = await query('SELECT id FROM users WHERE unsubscribe_token = $1', [token]);
  if (!res.rows[0]) return false;
  const userId = res.rows[0].id;
  const targets = type === 'all'
    ? Object.values(NOTIFICATION_TYPES).filter(t => !TRANSACTIONAL.has(t))
    : Object.values(NOTIFICATION_TYPES).includes(type) && !TRANSACTIONAL.has(type) ? [type] : [];
  for (const t of targets) {
    await query(
      `INSERT INTO notification_preferences (user_id, type, enabled)
       VALUES ($1, $2, FALSE)
       ON CONFLICT (user_id, type) DO UPDATE SET enabled = FALSE`,
      [userId, t]
    );
  }
  return true;
}

async function isEnabled(userId, type) {
  if (TRANSACTIONAL.has(type)) return true;
  const res = await query(
    'SELECT enabled FROM notification_preferences WHERE user_id = $1 AND type = $2',
    [userId, type]
  );
  return res.rows[0]?.enabled ?? true; // default opt-in
}

async function logNotification(userId, type, subject, status, metadata) {
  await query(
    `INSERT INTO notifications (user_id, type, subject, status, metadata) VALUES ($1, $2, $3, $4, $5)`,
    [userId, type, subject, status, JSON.stringify(metadata || {})]
  ).catch(e => console.error('[NotifService] Audit log failed:', e.message));
}

// Returns true if already sent (dedup gate), false if safe to proceed
export async function dedupCheck(key, ttlSeconds) {
  try {
    const exists = await redisClient.get(key);
    if (exists) return true;
    await redisClient.set(key, '1', 'EX', ttlSeconds);
    return false;
  } catch {
    return false; // on Redis error, allow the send
  }
}

export async function sendNotification(userId, type, data = {}) {
  try {
    const buildEmail = TEMPLATE_MAP[type];
    if (!buildEmail) {
      console.error(`[NotifService] Unknown type: ${type}`);
      return;
    }

    const userRes = await query(
      'SELECT email, first_name FROM users WHERE id = $1',
      [userId]
    );
    if (!userRes.rows[0]) return;
    const user = userRes.rows[0];

    if (!(await isEnabled(userId, type))) {
      console.log(`[NotifService] Skipped ${type} for ${userId} (opted out)`);
      return;
    }

    const token = await getOrCreateUnsubscribeToken(userId);
    const unsubscribeUrl = `${API_URL}/api/notifications/unsubscribe/${token}?type=${type}`;
    const unsubscribeAllUrl = `${API_URL}/api/notifications/unsubscribe/${token}?type=all`;
    const displayName = user.first_name || user.email.split('@')[0];

    const { subject, html } = buildEmail({
      user,
      displayName,
      data,
      unsubscribeUrl,
      unsubscribeAllUrl,
      BASE_URL,
    });

    const { data: sent, error } = await resend.emails.send({
      from: 'FlowGateway <notifications@flowgateway.dev>',
      to: user.email,
      subject,
      html,
    });

    if (error) {
      console.error(`[NotifService] Resend error for ${type}:`, error);
      await logNotification(userId, type, subject, 'failed', data);
      return;
    }

    await logNotification(userId, type, subject, 'sent', data);
    console.log(`[NotifService] ${type} → ${user.email} (id: ${sent?.id})`);
  } catch (err) {
    console.error(`[NotifService] Unexpected error for ${type}:`, err.message);
  }
}
