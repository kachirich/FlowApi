import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { URL } from 'url';

export const DAY_MS = 24 * 60 * 60 * 1000;

export const NOTIFICATION_TYPES = {
  ONBOARDING: 'onboarding',
  FEATURE_ANNOUNCEMENT: 'feature_announcement',
  DELIVERY_FAILURE: 'delivery_failure',
  WEEKLY_DIGEST: 'weekly_digest',
  BILLING_ALERT: 'billing_alert',
  USAGE_ALERT: 'usage_alert',
};

const _parsed = new URL(process.env.REDIS_URL || 'redis://redis:6379');
const _conn = new IORedis({
  host: _parsed.hostname,
  port: parseInt(_parsed.port || '6379', 10),
  ...(_parsed.username ? { username: _parsed.username } : {}),
  ...(_parsed.password ? { password: _parsed.password } : {}),
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

const notificationQueue = new Queue('notifications', { connection: _conn });

export async function enqueueNotification(userId, type, data, opts = {}) {
  await notificationQueue.add(type, { userId, ...data }, {
    delay: opts.delay ?? 0,
    removeOnComplete: true,
    removeOnFail: 100,
  });
}
