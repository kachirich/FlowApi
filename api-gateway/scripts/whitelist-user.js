/**
 * Script to whitelist a user for internal/localhost destination URLs
 *
 * Usage: node scripts/whitelist-user.js <email>
 * Example: node scripts/whitelist-user.js support.flowapi@gmail.com
 */

import "dotenv/config";
import pg from "pg";

const { Client } = pg;

const EMAIL = process.argv[2];

if (!EMAIL) {
  console.error("❌ Usage: node scripts/whitelist-user.js <email>");
  console.error("   Example: node scripts/whitelist-user.js support.flowapi@gmail.com");
  process.exit(1);
}

const client = new Client({
  connectionTimeoutMillis: 5000,
});

async function run() {
  try {
    await client.connect();
    console.log("✅ Connected to database");

    // Check if user exists
    const userCheck = await client.query("SELECT id, email FROM users WHERE email = $1", [EMAIL.toLowerCase()]);

    if (userCheck.rows.length === 0) {
      console.error(`❌ User not found: ${EMAIL}`);
      process.exit(1);
    }

    const user = userCheck.rows[0];
    console.log(`✅ Found user: ${user.email} (ID: ${user.id})`);

    // Whitelist the user
    const result = await client.query(
      "UPDATE users SET allow_internal_urls = TRUE WHERE email = $1 RETURNING id, email, allow_internal_urls",
      [EMAIL.toLowerCase()]
    );

    const updatedUser = result.rows[0];
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`✅ USER WHITELISTED FOR INTERNAL URLs`);
    console.log(`${'═'.repeat(60)}`);
    console.log(`Email:                ${updatedUser.email}`);
    console.log(`ID:                   ${updatedUser.id}`);
    console.log(`allow_internal_urls:  ${updatedUser.allow_internal_urls}`);
    console.log(`${'═'.repeat(60)}\n`);

    console.log("✅ User can now create destinations with:");
    console.log("   • localhost:5678 (or any port)");
    console.log("   • 127.0.0.1:5678");
    console.log("   • Private IP ranges (10.x.x.x, 192.168.x.x, etc.)");
    console.log("\n✅ Example n8n destination URL: http://localhost:5678/webhook");

  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
