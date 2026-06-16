-- =============================================================================
-- Migration 008: Promote request_logs.id from INTEGER (SERIAL) to BIGINT.
-- High-traffic gateways can exhaust a 2^31 SERIAL in months.
-- =============================================================================

ALTER TABLE request_logs ALTER COLUMN id TYPE BIGINT;

-- Ensure the backing sequence is declared as BIGINT so it never wraps.
-- The sequence was auto-created by SERIAL; we just widen its type.
CREATE SEQUENCE IF NOT EXISTS request_logs_id_seq AS BIGINT;

-- Re-attach in case the existing sequence is still typed as INTEGER.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'request_logs_id_seq') THEN
    ALTER SEQUENCE request_logs_id_seq AS BIGINT MAXVALUE 9223372036854775807;
  END IF;
END $$;
