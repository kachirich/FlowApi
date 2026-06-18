import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { URL } from 'url';
import { sendNotification } from './notification.service.js';

const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
const parsed = new URL(redisUrl);

const connection = new IORedis({
  host: parsed.hostname,
  port: parseInt(parsed.port || '6379', 10),
  ...(parsed.username ? { username: parsed.username } : {}),
  ...(parsed.password ? { password: parsed.password } : {}),
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

export const notificationQueue = new Queue('notification-dispatch', { connection });

export const notificationWorker = new Worker(
  'notification-dispatch',
  async (job) => {
    const { userId, type, data } = job.data;
    await sendNotification(userId, type, data);
  },
  { connection, concurrency: 5 }
);

notificationWorker.on('failed', (job, err) => {
  console.error(`[NotifQueue] Job ${job?.id} (${job?.data?.type}) failed:`, err.message);
});

export async function enqueueNotification(userId, type, data = {}, options = {}) {
  await notificationQueue.add(
    type,
    { userId, type, data },
    {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 50,
      ...options,
    }
  );
}
