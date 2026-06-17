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

  try {
    await pool.query(`
      -- 1. Infrastructure Rebuild
      CREATE TABLE IF NOT EXISTS request_logs (
        id          SERIAL PRIMARY KEY,
        ip_address  VARCHAR(45)  NOT NULL,
        method      VARCHAR(10)  NOT NULL,
        path        TEXT         NOT NULL,
        status_code SMALLINT,
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_request_logs_created_at ON request_logs (created_at);
      CREATE INDEX IF NOT EXISTS idx_request_logs_ip_address ON request_logs (ip_address);

      -- 2. The Identity Layer
      CREATE TABLE IF NOT EXISTS users (
        id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        email         VARCHAR(255)  NOT NULL UNIQUE,
        password_hash TEXT          NOT NULL,
        first_name    VARCHAR(100),
        last_name     VARCHAR(100),
        profile_pic   TEXT,
        two_factor_secret VARCHAR(255),
        two_factor_enabled BOOLEAN DEFAULT FALSE,
        has_completed_onboarding BOOLEAN DEFAULT FALSE,
        created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

      -- Restore 2FA Schema Safeguard
      ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE;

      -- Stripe Billing Integration
      ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_type VARCHAR(50) DEFAULT 'free';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'inactive';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS tier VARCHAR(50) DEFAULT 'sandbox';
      
      -- Lifetime Ledger
      ALTER TABLE users ADD COLUMN IF NOT EXISTS lifetime_webhooks_created INTEGER DEFAULT 0;

      -- Metered Billing
      ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_request_count INTEGER DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS billing_cycle_reset TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS routing_strategy VARCHAR(50) DEFAULT 'round_robin';

      -- 3. API Keys
      CREATE TABLE IF NOT EXISTS api_keys (
        id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id       UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name          VARCHAR(100),
        key_hash      VARCHAR(255)  NOT NULL UNIQUE,
        prefix        VARCHAR(50)   NOT NULL,
        last_four     VARCHAR(10)   NOT NULL,
        last_used_at  TIMESTAMPTZ,
        created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys (user_id);
      CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys (key_hash);

      -- Optional per-key HMAC request signing.
      -- signing_secret is a 64-char hex shared secret (crypto.randomBytes(32)).
      -- It is intentionally stored UN-hashed — like an OAuth client secret —
      -- because the gateway must recompute the HMAC at request time. It is
      -- shown to the user exactly once on rotation and never returned again.
      ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS signing_secret VARCHAR(128);
      ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS require_signature BOOLEAN NOT NULL DEFAULT FALSE;

      -- 4. The OTP Engine
      CREATE TABLE IF NOT EXISTS otps (
        id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        email       VARCHAR(255)  NOT NULL,
        code        VARCHAR(10)   NOT NULL,
        expires_at  TIMESTAMPTZ   NOT NULL,
        created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_otps_email ON otps (email);

      -- 4. Data Partitioning Layer
      CREATE TABLE IF NOT EXISTS webhook_keys (
        id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id         UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        api_key         VARCHAR(64)  NOT NULL UNIQUE,
        masked_key      VARCHAR(64),
        webhook_url     TEXT         NOT NULL,
        target_url      TEXT,
        http_method     VARCHAR(10)  DEFAULT 'POST',
        daily_lead_cap  INTEGER      DEFAULT 10,
        created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_webhook_keys_api_key ON webhook_keys (api_key);

      -- Dynamic Dispatcher Migration (existing DBs)
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='webhook_keys' AND column_name='destination_url') THEN
          ALTER TABLE webhook_keys RENAME COLUMN destination_url TO target_url;
        END IF;
      END $$;
      ALTER TABLE webhook_keys ADD COLUMN IF NOT EXISTS http_method VARCHAR(10) DEFAULT 'POST';
      ALTER TABLE webhook_keys ADD COLUMN IF NOT EXISTS daily_lead_cap INTEGER DEFAULT 10;

      CREATE TABLE IF NOT EXISTS ghl_leads (
        id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id             UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        webhook_key_id      UUID         REFERENCES webhook_keys(id) ON DELETE CASCADE,
        contact_id          VARCHAR(255) UNIQUE,
        first_name          VARCHAR(100),
        last_name           VARCHAR(100),
        email               VARCHAR(255),
        phone               VARCHAR(50),
        tags                TEXT[],
        raw_payload         JSONB        NOT NULL,
        status              VARCHAR(50),
        lead_score          INTEGER,
        delivery_status     VARCHAR(50)  DEFAULT 'PENDING',
        retry_count         INTEGER      DEFAULT 0,
        last_delivery_error TEXT,
        api_key             VARCHAR(100),
        created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS gateway_counters (
        key         VARCHAR(64) PRIMARY KEY,
        value       BIGINT      NOT NULL DEFAULT 0,
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      INSERT INTO gateway_counters (key, value)
        VALUES ('bots_blocked', 0)
        ON CONFLICT (key) DO NOTHING;

      -- 5. Webhook Logs
      CREATE TABLE IF NOT EXISTS webhook_logs (
        id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id         UUID         REFERENCES users(id) ON DELETE CASCADE,
        webhook_id      UUID         REFERENCES webhook_keys(id) ON DELETE CASCADE,
        method          VARCHAR(10),
        status_code     INTEGER,
        request_payload JSONB,
        response_error  TEXT,
        created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_webhook_logs_user_id ON webhook_logs (user_id);
      CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook_id ON webhook_logs (webhook_id);

      -- Add is_test column to webhook_logs and ghl_leads
      ALTER TABLE webhook_logs ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT FALSE;
      ALTER TABLE ghl_leads ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT FALSE;

      -- Add custom_headers column to webhook_keys
      ALTER TABLE webhook_keys ADD COLUMN IF NOT EXISTS custom_headers JSONB DEFAULT '{}'::jsonb;

      -- Lead Caps
      CREATE TABLE IF NOT EXISTS lead_counters (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        daily_lead_cap INTEGER NOT NULL DEFAULT 100,
        daily_leads_received INTEGER NOT NULL DEFAULT 0,
        last_reset_date DATE NOT NULL DEFAULT CURRENT_DATE
      );

      -- Destinations Table
      CREATE TABLE IF NOT EXISTS destinations (
        id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id      UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name         VARCHAR(255) NOT NULL,
        target_url   TEXT         NOT NULL,
        daily_cap    INTEGER      NOT NULL DEFAULT 0,
        is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
        created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_destinations_user_id ON destinations(user_id);

      ALTER TABLE webhook_logs ADD COLUMN IF NOT EXISTS destination_id UUID REFERENCES destinations(id) ON DELETE CASCADE;
      ALTER TABLE ghl_leads ADD COLUMN IF NOT EXISTS destination_id UUID REFERENCES destinations(id) ON DELETE SET NULL;

      -- Flows: named pipelines grouping a subset of destinations with their own strategy
      CREATE TABLE IF NOT EXISTS flows (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name             VARCHAR(255) NOT NULL,
        routing_strategy VARCHAR(20) NOT NULL DEFAULT 'round_robin',
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_flows_user_id ON flows(user_id);

      CREATE TABLE IF NOT EXISTS flow_destinations (
        flow_id        UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
        destination_id UUID NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
        PRIMARY KEY (flow_id, destination_id)
      );

      -- An API key may optionally point to a Flow; unassign (SET NULL) if the flow is deleted
      ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS flow_id UUID
        REFERENCES flows(id) ON DELETE SET NULL;

      -- ── Per-destination lead metering / prepaid credit balances ──────────
      -- 1 credit = 1 successfully delivered lead. Credits are prepaid and never
      -- expire. Metering is opt-in per destination (Growth/Enterprise tiers).
      CREATE TABLE IF NOT EXISTS destination_balances (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        destination_id    UUID NOT NULL UNIQUE REFERENCES destinations(id) ON DELETE CASCADE,
        user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        is_metered        BOOLEAN NOT NULL DEFAULT FALSE,
        exhausted_action  VARCHAR(10) NOT NULL DEFAULT 'continue'
                            CHECK (exhausted_action IN ('pause','continue')),
        balance           INTEGER NOT NULL DEFAULT 0,
        total_purchased   INTEGER NOT NULL DEFAULT 0,
        total_consumed    INTEGER NOT NULL DEFAULT 0,
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_dest_balances_user
        ON destination_balances(user_id);

      CREATE TABLE IF NOT EXISTS balance_transactions (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        destination_id UUID NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
        user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type           VARCHAR(10) NOT NULL CHECK (type IN ('credit','debit')),
        amount         INTEGER NOT NULL,
        pack_name      VARCHAR(20),
        lead_id        UUID REFERENCES ghl_leads(id) ON DELETE SET NULL,
        note           TEXT,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_balance_tx_dest
        ON balance_transactions(destination_id, created_at DESC);

      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin
        BOOLEAN NOT NULL DEFAULT FALSE;

      -- Email Automation: unsubscribe token for one-click opt-out
      ALTER TABLE users ADD COLUMN IF NOT EXISTS unsubscribe_token VARCHAR(64) UNIQUE;

      -- Per-user notification preferences (one row per type, opt-in by default)
      CREATE TABLE IF NOT EXISTS notification_preferences (
        user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type       VARCHAR(50) NOT NULL,
        enabled    BOOLEAN     NOT NULL DEFAULT TRUE,
        PRIMARY KEY (user_id, type)
      );

      -- Audit log of every notification sent or failed
      CREATE TABLE IF NOT EXISTS notifications (
        id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type     VARCHAR(50) NOT NULL,
        subject  TEXT        NOT NULL,
        status   VARCHAR(20) NOT NULL DEFAULT 'sent',
        metadata JSONB,
        sent_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, sent_at DESC);

      -- Auth hardening
      ALTER TABLE users ADD COLUMN IF NOT EXISTS last_otp_verified_at TIMESTAMPTZ;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_passwordless BOOLEAN NOT NULL DEFAULT FALSE;

      -- BullMQ job tracking for real queue cancellation
      ALTER TABLE ghl_leads ADD COLUMN IF NOT EXISTS bullmq_job_id VARCHAR(64);
    `);
    console.log("[db] Schema initialised — request_logs, users, api_keys, guest_sessions, ghl_leads, webhook_keys, gateway_counters, lead_counters & destinations tables ready");
  } catch (err) {
    console.error("[db] Failed to initialise the database schema. Retrying is highly recommended.", err.message);
  }

  // Notification schema runs in a separate block so it always executes
  // even if an earlier statement in the main block failed or was skipped.
  try {
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS unsubscribe_token VARCHAR(64) UNIQUE;

      CREATE TABLE IF NOT EXISTS notification_preferences (
        user_id UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type    VARCHAR(50) NOT NULL,
        enabled BOOLEAN     NOT NULL DEFAULT TRUE,
        PRIMARY KEY (user_id, type)
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type     VARCHAR(50) NOT NULL,
        subject  TEXT        NOT NULL,
        status   VARCHAR(20) NOT NULL DEFAULT 'sent',
        metadata JSONB,
        sent_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, sent_at DESC);
    `);
    console.log("[db] Notification schema ready");
  } catch (err) {
    console.error("[db] Failed to initialise notification schema:", err.message);
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
