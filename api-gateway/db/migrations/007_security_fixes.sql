-- =============================================================================
-- Migration 007: Security hardening.
--   1. Ensure is_passwordless exists in user_auth (in case 002 ran on an older DB).
--   2. Drop ghl_leads.api_key — plaintext key stored on a lead row is a data
--      leak; the api_keys table with hashed keys is the authoritative store.
--   3. Hash OTP codes — replace the plaintext `code` column with `code_hash`
--      (SHA-256 hex).  Application code must hash before INSERT/SELECT.
--      pgcrypto is used for the one-time backfill of existing rows; ongoing
--      hashing is done in Node.js via crypto.createHash('sha256').
-- =============================================================================

-- 1. Ensure is_passwordless is in user_auth
ALTER TABLE user_auth ADD COLUMN IF NOT EXISTS is_passwordless BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Drop the plaintext api_key column from ghl_leads
ALTER TABLE ghl_leads DROP COLUMN IF EXISTS api_key;

-- 3. Hashed OTP storage
--    Step A: ensure pgcrypto is available for the backfill UPDATE
CREATE EXTENSION IF NOT EXISTS pgcrypto;

--    Step B: add the new column (idempotent)
ALTER TABLE otps ADD COLUMN IF NOT EXISTS code_hash VARCHAR(64);

--    Step C: backfill existing rows that still have a plaintext code
--            (OTPs are short-lived — any row without code_hash is either
--            expired or about to be; hashing them is safe and keeps the
--            column NOT NULL-able after the old column is dropped.)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'otps' AND column_name = 'code'
  ) THEN
    UPDATE otps
       SET code_hash = encode(digest(code::text, 'sha256'), 'hex')
     WHERE code_hash IS NULL;
  END IF;
END $$;

--    Step D: also handle the intermediate `hashed_code` column name from an
--            earlier version of this migration that may have already run.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'otps' AND column_name = 'hashed_code'
  ) THEN
    UPDATE otps SET code_hash = hashed_code WHERE code_hash IS NULL AND hashed_code IS NOT NULL;
    ALTER TABLE otps DROP COLUMN hashed_code;
  END IF;
END $$;

--    Step E: drop the old plaintext columns
ALTER TABLE otps DROP COLUMN IF EXISTS code;
