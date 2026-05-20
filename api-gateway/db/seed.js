import "dotenv/config";
import bcrypt from "bcrypt";
import pg from "pg";

const { Pool } = pg;

const SALT_ROUNDS = 12;

const TEST_USER = {
  email: "kachirichard75@gmail.com",
  password: "pass@4355",
};

async function seed() {
  const pool = new Pool();

  try {
    // Hash the password
    const passwordHash = await bcrypt.hash(TEST_USER.password, SALT_ROUNDS);

    // Upsert the test user (safe to re-run)
    const result = await pool.query(
      `INSERT INTO users (email, password_hash)
       VALUES ($1, $2)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
       RETURNING id, email, created_at`,
      [TEST_USER.email, passwordHash]
    );

    const user = result.rows[0];
    console.log("[seed] ✔ Test user ready:");
    console.log(`       id         : ${user.id}`);
    console.log(`       email      : ${user.email}`);
    console.log(`       password   : ${TEST_USER.password}`);
    console.log(`       created_at : ${user.created_at}`);
  } catch (err) {
    console.error("[seed] ✘ Failed:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
