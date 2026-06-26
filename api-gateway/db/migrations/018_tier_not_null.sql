-- Plan consolidation phase 2a (reversible — plan_type column retained).
-- Make `tier` authoritative and self-defaulting now that all code reads/writes
-- it. Backfill any NULLs from the legacy plan_type, then default + NOT NULL.
-- The plan_type column is dropped in a later migration (phase 2c) once the
-- frontend cutover has shipped and the test suite has run.

UPDATE user_billing
SET tier = CASE
  WHEN plan_type = 'plus'           THEN 'enterprise'
  WHEN plan_type IN ('pro','basic') THEN 'growth'
  ELSE 'sandbox'
END
WHERE tier IS NULL;

ALTER TABLE user_billing ALTER COLUMN tier SET DEFAULT 'sandbox';
ALTER TABLE user_billing ALTER COLUMN tier SET NOT NULL;
