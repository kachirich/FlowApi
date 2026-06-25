import pg from "pg";
import logger from "../utils/logger.js";

const { Pool } = pg;

/**
 * PostgreSQL connection pool.
 *
 * Reads connection parameters from the standard PG* environment variables
 * (PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD) which are loaded via
 * dotenv in the application entry point.
 */
const pool = new Pool({
  // pgbouncer sits in front of Postgres, so keep the app-side pool small to
  // avoid multiplying connection pressure across app instances.
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 3_000,
  // Server-side cap: any single statement exceeding 10s is aborted so a slow
  // or lock-blocked query (e.g. the lead_counters SELECT … FOR UPDATE under
  // contention) cannot pin a pooled connection indefinitely.
  statement_timeout: 10_000,
});

pool.on("error", (err) => {
  logger.error({ err }, "Unexpected error on idle client");
});

/**
 * Run a parameterised query against the pool.
 *
 * @param {string}  text   - SQL query string with $1, $2, … placeholders.
 * @param {any[]}   params - Bind parameters.
 * @returns {Promise<pg.QueryResult>}
 */
export function query(text, params) {
  return pool.query(text, params);
}

/**
 * Gracefully shut down the pool.  Called during SIGTERM / SIGINT handling.
 */
export async function closePool() {
  await pool.end();
  console.log("[db] Connection pool closed");
}

export default pool;
