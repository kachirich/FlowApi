-- ============================================================================
-- Migration 005: Create api_keys table
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_keys (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_hash      VARCHAR(255)  NOT NULL,
  prefix        VARCHAR(255)  NOT NULL,
  last_four     VARCHAR(4)    NOT NULL,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  last_used_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
