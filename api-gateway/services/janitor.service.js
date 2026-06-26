import cron from "node-cron";
import { query } from "../db/connection.js";
import { enqueueNotification, notificationQueue } from "./notification.queue.js";
import { NOTIFICATION_TYPES } from "./notification.service.js";
import { grantMonthlyCredits } from "./destinationMetering.js";
import { PLANS, TIERS } from "../config/plans.js";

/**
 * Janitor Service — Log Retention Enforcer + Nightly Housekeeping
 *
 * Runs at midnight and performs:
 *   1. Purge webhook_logs by plan (7d free/basic, 30d pro, unlimited plus).
 *   2. Delete expired OTP codes.
 *   3. Weekly digest rollup query (uses idx_ghl_leads_user_created index).
 */
async function purgeExpiredLogs() {
  console.log("[janitor] Running nightly log retention sweep...");

  try {
    // Retention per tier is config-driven (config/plans.js). Tiers with a null
    // retention (enterprise) are never purged. Rows with no tier are treated as
    // sandbox (the safest/shortest retention).
    let totalPurged = 0;
    for (const tier of TIERS) {
      const days = PLANS[tier].logRetentionDays;
      if (days == null) continue; // retain forever
      const tierMatch = tier === "sandbox" ? "(ub.tier = $1 OR ub.tier IS NULL)" : "ub.tier = $1";
      const result = await query(
        `DELETE FROM webhook_logs wl
         USING user_billing ub
         WHERE wl.user_id = ub.user_id
           AND ${tierMatch}
           AND wl.created_at < NOW() - ($2 || ' days')::interval`,
        [tier, String(days)]
      );
      totalPurged += result.rowCount || 0;
      console.log(`[janitor]   ${tier} (>${days}d): ${result.rowCount || 0} removed`);
    }

    // Delete expired OTP codes (safe; they've already been rejected or used)
    const otpResult = await query(`
      DELETE FROM otps WHERE expires_at < NOW()
    `);

    console.log(`[janitor] Retention sweep complete — ${totalPurged} expired logs purged`);
    console.log(`[janitor]   Expired OTPs: ${otpResult.rowCount || 0} removed`);
  } catch (err) {
    console.error("[janitor] Error during log retention sweep:", err.message);
  }
}

async function expireAndRenewMonthlyGrants() {
  console.log("[janitor] Running monthly credit grant expiry + renewal...");
  try {
    // Find metered destinations whose grant has expired
    const expired = await query(`
      SELECT db.destination_id, db.user_id, db.balance, ub.plan_type
      FROM destination_balances db
      JOIN user_billing ub ON ub.user_id = db.user_id
      WHERE db.grant_expires_at <= NOW()
        AND db.monthly_grant > 0
    `);

    let expired_count = 0;
    for (const row of expired.rows) {
      // Zero out remaining balance (unused credits don't roll over)
      if (row.balance > 0) {
        await query(
          `UPDATE destination_balances SET balance = 0, updated_at = NOW() WHERE destination_id = $1`,
          [row.destination_id]
        );
        await query(
          `INSERT INTO balance_transactions (destination_id, user_id, type, amount, note)
           VALUES ($1, $2, 'debit', $3, 'credit_expiry')`,
          [row.destination_id, row.user_id, row.balance]
        );
      }
      // Issue the new month's grant
      await grantMonthlyCredits(row.destination_id, row.user_id, row.plan_type || 'free');
      expired_count++;
    }
    console.log(`[janitor] Monthly grant renewal complete — ${expired_count} destinations refreshed`);
  } catch (err) {
    console.error("[janitor] Error during monthly grant expiry:", err.message);
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
 * Weekly lead digest — grouped stats per user for the past 7 days.
 * Uses the (user_id, created_at DESC) index to avoid a full table scan.
 */
export async function weeklyLeadDigest() {
  return query(`
    SELECT
      user_id,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') AS leads_received,
      COUNT(*) FILTER (WHERE delivery_status = 'DELIVERED' AND created_at > NOW() - INTERVAL '7 days') AS leads_delivered,
      COUNT(*) FILTER (WHERE delivery_status = 'FAILED'    AND created_at > NOW() - INTERVAL '7 days') AS leads_failed
    FROM ghl_leads
    WHERE created_at > NOW() - INTERVAL '7 days'
    GROUP BY user_id
  `);
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

  // Monthly grant expiry + renewal — 1st of each month at 00:01 UTC
  cron.schedule("1 0 1 * *", () => {
    expireAndRenewMonthlyGrants();
  });

  // Weekly digest — every Monday at 09:00 UTC
  cron.schedule("0 9 * * 1", () => {
    sendWeeklyDigests();
  });

  return { purgeExpiredLogs, sendWeeklyDigests, expireAndRenewMonthlyGrants };
}
