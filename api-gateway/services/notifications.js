import { Queue } from 'bullmq';
import redisClient from '../utils/redisClient.js';

export const DAY_MS = 24 * 60 * 60 * 1000;

export const NOTIFICATION_TYPES = {
  ONBOARDING: 'onboarding',
  FEATURE_ANNOUNCEMENT: 'feature_announcement',
  DELIVERY_FAILURE: 'delivery_failure',
  WEEKLY_DIGEST: 'weekly_digest',
  BILLING_ALERT: 'billing_alert',
  USAGE_ALERT: 'usage_alert',
};

const notificationQueue = new Queue('notifications', { connection: redisClient });

export async function enqueueNotification(userId, type, data, opts = {}) {
  await notificationQueue.add(type, { userId, ...data }, {
    delay: opts.delay ?? 0,
    removeOnComplete: true,
    removeOnFail: 100,
  });
}
