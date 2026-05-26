import cron from "node-cron";
import { query } from "../db/connection.js";

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

/**
 * Starts the Janitor cron job.
 * Schedule: Every day at midnight (00:00).
 */
export function startJanitorService() {
  console.log("[janitor] Log retention enforcer initialized (runs daily at midnight)");

  cron.schedule("0 0 * * *", () => {
    purgeExpiredLogs();
  });

  // Also expose for manual trigger if needed
  return { purgeExpiredLogs };
}
