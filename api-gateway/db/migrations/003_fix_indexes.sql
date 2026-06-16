-- NO TRANSACTION
-- =============================================================================
-- Migration 003: Add missing composite and covering indexes.
-- Uses CREATE INDEX CONCURRENTLY to avoid table locks on live data.
-- Must run outside a transaction (see migrate.js NO TRANSACTION handling).
-- =============================================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ghl_leads_user_created
  ON ghl_leads(user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ghl_leads_delivery_status
  ON ghl_leads(delivery_status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ghl_leads_user_status
  ON ghl_leads(user_id, delivery_status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_webhook_keys_user_id
  ON webhook_keys(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_otps_expires_at
  ON otps(expires_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_webhook_logs_user_created
  ON webhook_logs(user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_balance_tx_user
  ON balance_transactions(user_id);
