import cron from "node-cron";
import { query } from "../db/connection.js";
import { enqueueNotification, notificationQueue } from "./notification.queue.js";
import { NOTIFICATION_TYPES } from "./notification.service.js";

/**
 * Janitor Service — Log Retention Enforcer
 *
 * Runs nightly at midnight (00:00) and purges webhook_logs based on user plan:
 *   • free / basic  → 7-day retention
 *   • pro           → 30-day retention
 *   • plus          → Unlimited (no purge)
 */
async function purgeExpiredLogs() {
  console.log("[janitor] Running nightly log retention sweep...");

  try {
    // Delete logs for Basic/Free users older than 7 days
    const freeResult = await query(`
      DELETE FROM webhook_logs wl
      USING users u
      WHERE wl.user_id = u.id
        AND (u.plan_type = 'free' OR u.plan_type IS NULL)
        AND wl.created_at < NOW() - INTERVAL '7 days'
    `);

    // Delete logs for Pro users older than 30 days
    const proResult = await query(`
      DELETE FROM webhook_logs wl
      USING users u
      WHERE wl.user_id = u.id
        AND u.plan_type = 'pro'
        AND wl.created_at < NOW() - INTERVAL '30 days'
    `);

    const totalPurged = (freeResult.rowCount || 0) + (proResult.rowCount || 0);
    console.log(`[janitor] Retention sweep complete — ${totalPurged} expired logs purged`);
    console.log(`[janitor]   Basic/Free (>7d): ${freeResult.rowCount || 0} removed`);
    console.log(`[janitor]   Pro (>30d):       ${proResult.rowCount || 0} removed`);
    console.log(`[janitor]   Plus:             Unlimited — no purge`);
  } catch (err) {
    console.error("[janitor] Error during log retention sweep:", err.message);
  }
}

async function sendWeeklyDigests() {
  console.log("[janitor] Sending weekly digest emails...");
  try {
    const users = await query(`
      SELECT u.id, COUNT(l.id) FILTER (WHERE l.created_at > NOW() - INTERVAL '7 days') AS leads_received,
             COUNT(l.id) FILTER (WHERE l.delivery_status = 'DELIVERED' AND l.created_at > NOW() - INTERVAL '7 days') AS leads_delivered,
             COUNT(l.id) FILTER (WHERE l.delivery_status = 'FAILED' AND l.created_at > NOW() - INTERVAL '7 days') AS leads_failed
      FROM users u
      LEFT JOIN ghl_leads l ON l.user_id = u.id
      GROUP BY u.id
    `);

    let sent = 0;
    for (const row of users.rows) {
      await enqueueNotification(row.id, NOTIFICATION_TYPES.WEEKLY_DIGEST, {
        leads_received: parseInt(row.leads_received, 10) || 0,
        leads_delivered: parseInt(row.leads_delivered, 10) || 0,
        leads_failed: parseInt(row.leads_failed, 10) || 0,
      }).catch(() => {});
      sent++;
    }
    console.log(`[janitor] Weekly digest queued for ${sent} users`);
  } catch (err) {
    console.error("[janitor] Weekly digest error:", err.message);
  }
}

/**
 * Starts the Janitor cron job.
 * Schedule: Every day at midnight (00:00). Weekly digest on Mondays at 09:00 UTC.
 */
export function startJanitorService() {
  console.log("[janitor] Log retention enforcer initialized (runs daily at midnight)");

  cron.schedule("0 0 * * *", () => {
    purgeExpiredLogs();
  });

  // Weekly digest — every Monday at 09:00 UTC
  cron.schedule("0 9 * * 1", () => {
    sendWeeklyDigests();
  });

  return { purgeExpiredLogs, sendWeeklyDigests };
}
