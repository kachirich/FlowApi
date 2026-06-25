-- Backfill `tier` for existing paid accounts.
--
-- Before this, the billing webhook and admin upgrade routes set `plan_type` but
-- never `tier`, so every paid account stayed at tier='sandbox' — silently
-- throttled to the 500/day sandbox lead cap (rateLimiter.js) instead of the
-- 10k (growth) / 100k (enterprise) paid caps.
--
-- Mapping mirrors utils/tierFromPlan.js. Idempotent — only touches rows whose
-- tier disagrees with their plan_type, so re-running is a no-op.

UPDATE user_billing
SET tier = CASE
  WHEN plan_type = 'plus' THEN 'enterprise'
  WHEN plan_type = 'pro'  THEN 'growth'
  ELSE 'sandbox'
END
WHERE tier IS DISTINCT FROM CASE
  WHEN plan_type = 'plus' THEN 'enterprise'
  WHEN plan_type = 'pro'  THEN 'growth'
  ELSE 'sandbox'
END;
