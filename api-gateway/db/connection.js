import pg from "pg";

const { Pool } = pg;

/**
 * PostgreSQL connection pool.
 *
 * Reads connection parameters from the standard PG* environment variables
 * (PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD) which are loaded via
 * dotenv in the application entry point.
 */
const pool = new Pool({
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on("error", (err) => {
  console.error("[db] Unexpected error on idle client:", err.message);
});

/**
 * Bootstrap the database schema.
 *
 * Creates the `request_logs` table if it does not already exist.  Call this
 * once at server startup so the logging middleware has a table to write to.
 */
export async function initializeDatabase() {
  console.log("[db] Initialising connection with:", {
    host: process.env.PGHOST,
    port: process.env.PGPORT,
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD ? "********" : "undefined",
  });
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS request_logs (
        id          SERIAL PRIMARY KEY,
        ip_address  VARCHAR(45)  NOT NULL,
        method      VARCHAR(10)  NOT NULL,
        path        TEXT         NOT NULL,
        status_code SMALLINT,
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_request_logs_created_at
        ON request_logs (created_at);

      CREATE INDEX IF NOT EXISTS idx_request_logs_ip_address
        ON request_logs (ip_address);

      CREATE TABLE IF NOT EXISTS users (
        id            SERIAL        PRIMARY KEY,
        email         VARCHAR(255)  NOT NULL UNIQUE,
        password_hash TEXT          NOT NULL,
        two_factor_secret VARCHAR(255),
        two_factor_enabled BOOLEAN DEFAULT FALSE,
        has_completed_onboarding BOOLEAN DEFAULT FALSE,
        created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      );

      ALTER TABLE users ADD COLUMN IF NOT EXISTS has_completed_onboarding BOOLEAN DEFAULT FALSE;

      CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

      CREATE TABLE IF NOT EXISTS guest_sessions (
        id                 SERIAL        PRIMARY KEY,
        first_name         VARCHAR(100)  NOT NULL,
        last_name          VARCHAR(100)  NOT NULL,
        email              VARCHAR(255)  NOT NULL,
        session_id         VARCHAR(128)  NOT NULL UNIQUE,
        lead_score         INTEGER,
        ai_welcome_message TEXT,
        created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_guest_sessions_session_id
        ON guest_sessions (session_id);

      CREATE TABLE IF NOT EXISTS ghl_leads (
        id            SERIAL       PRIMARY KEY,
        contact_id    VARCHAR(255) UNIQUE,
        first_name    VARCHAR(100),
        last_name     VARCHAR(100),
        email         VARCHAR(255),
        phone         VARCHAR(50),
        tags          TEXT[],
        raw_payload   JSONB        NOT NULL,
        delivery_status VARCHAR(50) DEFAULT 'PENDING',
        retry_count   INTEGER      DEFAULT 0,
        last_delivery_error TEXT,
        created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );

      ALTER TABLE ghl_leads ADD COLUMN IF NOT EXISTS status VARCHAR(50);
      ALTER TABLE ghl_leads ADD COLUMN IF NOT EXISTS api_key VARCHAR(100);
      ALTER TABLE ghl_leads ADD COLUMN IF NOT EXISTS lead_score INTEGER;
      ALTER TABLE ghl_leads ADD COLUMN IF NOT EXISTS webhook_key_id INTEGER;
      ALTER TABLE ghl_leads ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(50) DEFAULT 'PENDING';
      ALTER TABLE ghl_leads ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
      ALTER TABLE ghl_leads ADD COLUMN IF NOT EXISTS last_delivery_error TEXT;

      CREATE TABLE IF NOT EXISTS webhook_keys (
        id          SERIAL       PRIMARY KEY,
        api_key     VARCHAR(64)  NOT NULL UNIQUE,
        webhook_url TEXT         NOT NULL,
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_webhook_keys_api_key
        ON webhook_keys (api_key);

      ALTER TABLE webhook_keys ADD COLUMN IF NOT EXISTS destination_url TEXT;
      ALTER TABLE webhook_keys ADD COLUMN IF NOT EXISTS masked_key VARCHAR(64);

      CREATE TABLE IF NOT EXISTS gateway_counters (
        key         VARCHAR(64) PRIMARY KEY,
        value       BIGINT      NOT NULL DEFAULT 0,
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      INSERT INTO gateway_counters (key, value)
        VALUES ('bots_blocked', 0)
        ON CONFLICT (key) DO NOTHING;
    `);
    console.log("[db] Schema initialised — request_logs, users, guest_sessions, ghl_leads, webhook_keys & gateway_counters tables ready");
  } finally {
    client.release();
  }
}

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
