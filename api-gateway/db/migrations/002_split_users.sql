-- =============================================================================
-- Migration 002: Split users table into users + user_billing + user_auth + user_settings.
--
-- After this migration the users table retains only identity columns:
--   id, email, password_hash, first_name, last_name, profile_pic, is_admin, created_at
--
-- A TRIGGER auto-inserts satellite rows whenever a user row is created so
-- application code never needs to insert into the three satellite tables directly.
--
-- Idempotent: all DDL uses IF NOT EXISTS / IF EXISTS.
-- =============================================================================

-- ── 1. Satellite tables ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_billing (
  user_id                UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id     VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  plan_type              VARCHAR(50) NOT NULL DEFAULT 'free',
  subscription_status    VARCHAR(50) NOT NULL DEFAULT 'inactive',
  tier                   VARCHAR(50) NOT NULL DEFAULT 'sandbox',
  monthly_request_count  INTEGER     NOT NULL DEFAULT 0,
  billing_cycle_reset    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lifetime_webhooks_created INTEGER  NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_auth (
  user_id              UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  two_factor_secret    VARCHAR(255),
  two_factor_enabled   BOOLEAN     NOT NULL DEFAULT FALSE,
  is_passwordless      BOOLEAN     NOT NULL DEFAULT FALSE,
  last_otp_verified_at TIMESTAMPTZ,
  unsubscribe_token    VARCHAR(64) UNIQUE
);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id                  UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  routing_strategy         VARCHAR(50) NOT NULL DEFAULT 'round_robin',
  has_completed_onboarding BOOLEAN     NOT NULL DEFAULT FALSE
);

-- ── 2. Backfill satellite rows from existing users data ──────────────────────

INSERT INTO user_billing (
  user_id, stripe_customer_id, stripe_subscription_id,
  plan_type, subscription_status, tier,
  monthly_request_count, billing_cycle_reset, lifetime_webhooks_created
)
SELECT
  u.id,
  u.stripe_customer_id,
  u.stripe_subscription_id,
  COALESCE(u.plan_type, 'free'),
  COALESCE(u.subscription_status, 'inactive'),
  COALESCE(u.tier, 'sandbox'),
  COALESCE(u.monthly_request_count, 0),
  COALESCE(u.billing_cycle_reset, NOW()),
  COALESCE(u.lifetime_webhooks_created, 0)
FROM users u
WHERE EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_name = 'users' AND column_name = 'plan_type'
)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO user_auth (
  user_id, two_factor_secret, two_factor_enabled,
  is_passwordless, last_otp_verified_at
)
SELECT
  u.id,
  u.two_factor_secret,
  COALESCE(u.two_factor_enabled, FALSE),
  COALESCE(u.is_passwordless, FALSE),
  u.last_otp_verified_at
FROM users u
WHERE EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_name = 'users' AND column_name = 'two_factor_enabled'
)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO user_settings (user_id, routing_strategy, has_completed_onboarding)
SELECT
  u.id,
  COALESCE(u.routing_strategy, 'round_robin'),
  COALESCE(u.has_completed_onboarding, FALSE)
FROM users u
WHERE EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_name = 'users' AND column_name = 'routing_strategy'
)
ON CONFLICT (user_id) DO NOTHING;

-- ── 3. Drop migrated columns from users ─────────────────────────────────────

ALTER TABLE users DROP COLUMN IF EXISTS stripe_customer_id;
ALTER TABLE users DROP COLUMN IF EXISTS stripe_subscription_id;
ALTER TABLE users DROP COLUMN IF EXISTS plan_type;
ALTER TABLE users DROP COLUMN IF EXISTS subscription_status;
ALTER TABLE users DROP COLUMN IF EXISTS tier;
ALTER TABLE users DROP COLUMN IF EXISTS monthly_request_count;
ALTER TABLE users DROP COLUMN IF EXISTS billing_cycle_reset;
ALTER TABLE users DROP COLUMN IF EXISTS lifetime_webhooks_created;
ALTER TABLE users DROP COLUMN IF EXISTS two_factor_secret;
ALTER TABLE users DROP COLUMN IF EXISTS two_factor_enabled;
ALTER TABLE users DROP COLUMN IF EXISTS is_passwordless;
ALTER TABLE users DROP COLUMN IF EXISTS last_otp_verified_at;
ALTER TABLE users DROP COLUMN IF EXISTS routing_strategy;
ALTER TABLE users DROP COLUMN IF EXISTS has_completed_onboarding;

-- ── 4. Auto-create satellite rows on INSERT INTO users ──────────────────────

CREATE OR REPLACE FUNCTION fn_create_user_satellites()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO user_billing (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  INSERT INTO user_auth    (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  INSERT INTO user_settings(user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_satellites ON users;
CREATE TRIGGER trg_user_satellites
  AFTER INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION fn_create_user_satellites();
