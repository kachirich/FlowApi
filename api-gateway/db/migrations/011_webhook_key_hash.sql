-- Migration 011: Add SHA-256 hash column to webhook_keys for O(1) key lookup.
--
-- Background: ghlAuth previously did a full-table bcrypt scan (O(n)) which
-- was a DoS vector and a timing oracle. The new lookup hashes the incoming
-- key with SHA-256 and does a single indexed SELECT.
--
-- Existing rows will have api_key_hash = NULL. Those keys must be rotated
-- (deleted and re-generated) before the new ghlAuth middleware can validate
-- them. The old bcrypt `api_key` column is retained for the transition period.

ALTER TABLE webhook_keys
  ADD COLUMN IF NOT EXISTS api_key_hash VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_keys_api_key_hash
  ON webhook_keys (api_key_hash)
  WHERE api_key_hash IS NOT NULL;
