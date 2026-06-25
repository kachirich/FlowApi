import "dotenv/config";
import pg from "pg";
import IORedis from "ioredis";
import { tierFromPlan } from "../utils/tierFromPlan.js";

const { Pool } = pg;

// Mirrors middleware/requirePlan.js:planCacheKey — keep formats in sync.
const planCacheKey = (userId) => `user:${userId}:plan`;
// plan_type lives in user_billing — never UPDATE users.plan_type directly.

/**
 * Best-effort invalidation of the Redis plan cache for the given user ids.
 * Never throws — a Redis hiccup must not fail an otherwise-successful upgrade;
 * the worst case is the cached value expires on its own 15-minute TTL.
 */
async function invalidatePlanCache(userIds) {
  if (!userIds.length) return;
  const client = new IORedis(process.env.REDIS_URL || "redis://redis:6379", {
    connectTimeout: 5000,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
  let connectError = null;
  client.on("error", (err) => { connectError = err; });
  try {
    await client.connect();
    await Promise.all(userIds.map((id) => client.del(planCacheKey(id))));
    console.log(`[upgrade-users] ✔ Redis plan cache invalidated for ${userIds.length} user(s).`);
  } catch (err) {
    const msg = connectError?.message || err.message;
    console.error(`\n[upgrade-users] ✘ ERROR: Could not reach Redis to invalidate plan cache: ${msg}`);
    console.error(`[upgrade-users]   The database was updated successfully, but the 15-minute Redis`);
    console.error(`[upgrade-users]   cache will keep serving the OLD plan until it expires or you`);
    console.error(`[upgrade-users]   manually delete the keys. Run these commands to force-expire now:\n`);
    userIds.forEach((id) => {
      console.error(`    redis-cli DEL ${planCacheKey(id)}`);
    });
    console.error('');
  } finally {
    try { await client.quit(); } catch { /* already closed */ }
  }
}

/**
 * Usage: node db/upgrade-users.js <plan> <email1> [<email2> ...]
 * Example: node db/upgrade-users.js plus kachirichard75@gmail.com kachirichard34@gmail.com
 *
 * Directly updates user plan_type in the database.
 */
async function upgradeUsers() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error("Usage: node db/upgrade-users.js <plan> <email1> [<email2> ...]");
    console.error("Example: node db/upgrade-users.js plus kachirichard75@gmail.com kachirichard34@gmail.com");
    process.exit(1);
  }

  const plan = args[0].toLowerCase();
  const emails = args.slice(1).map((e) => e.trim().toLowerCase());

  const allowedPlans = ["free", "basic", "pro", "plus"];
  if (!allowedPlans.includes(plan)) {
    console.error(`[upgrade-users] ✘ Invalid plan: ${plan}`);
    console.error(`               Valid plans: ${allowedPlans.join(", ")}`);
    process.exit(1);
  }

  const pool = new Pool();

  try {
    console.log(`\n[upgrade-users] Upgrading ${emails.length} user(s) to "${plan}"...`);

    // plan_type lives in user_billing (split out of users in migration 002),
    // so we update there — that's the column requirePlan and /me actually read.
    const result = await pool.query(
      `UPDATE user_billing ub
       SET plan_type = $1, tier = $2
       FROM users u
       WHERE ub.user_id = u.id AND u.email = ANY($3::text[])
       RETURNING u.id, u.email, ub.plan_type`,
      [plan, tierFromPlan(plan), emails]
    );

    if (result.rows.length === 0) {
      console.error(`[upgrade-users] ✘ No users found with the provided emails`);
      process.exit(1);
    }

    // Invalidate the Redis plan cache so requirePlan/getPlanType see the new
    // tier immediately instead of serving the stale 15-minute cached value.
    await invalidatePlanCache(result.rows.map((u) => u.id));

    console.log(`\n[upgrade-users] ✔ Successfully upgraded ${result.rows.length} user(s):`);
    result.rows.forEach((user) => {
      console.log(`                 • ${user.email} → ${user.plan_type}`);
    });

    const notFound = emails.filter(
      (email) => !result.rows.some((r) => r.email === email)
    );

    if (notFound.length > 0) {
      console.warn(`\n[upgrade-users] ⚠ Not found (${notFound.length}):`);
      notFound.forEach((email) => {
        console.warn(`                 • ${email}`);
      });
    }

    console.log("\n");
  } catch (err) {
    console.error("[upgrade-users] ✘ Database error:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

upgradeUsers();
