import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

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

    const result = await pool.query(
      `UPDATE users
       SET plan_type = $1
       WHERE email = ANY($2::text[])
       RETURNING id, email, plan_type`,
      [plan, emails]
    );

    if (result.rows.length === 0) {
      console.error(`[upgrade-users] ✘ No users found with the provided emails`);
      process.exit(1);
    }

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
