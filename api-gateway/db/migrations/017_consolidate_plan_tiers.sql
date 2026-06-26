-- Plan consolidation, phase 1 (reversible — no columns dropped).
--
-- Make `tier` (sandbox/growth/enterprise) authoritative everywhere by
-- reconciling it from the legacy `plan_type`, and bring existing daily lead
-- caps in line with each user's tier (they were all seeded at a hardcoded 100).
--
-- Mapping: plus -> enterprise, pro+basic -> growth, free/null -> sandbox.
-- `plan_type` is retained for now; a later migration drops it once Stripe /
-- LemonSqueezy webhooks and the frontend no longer read it (phase 2).

UPDATE user_billing SET tier = CASE
  WHEN plan_type = 'plus'           THEN 'enterprise'
  WHEN plan_type IN ('pro','basic') THEN 'growth'
  ELSE 'sandbox'
END;

-- Re-seed daily lead caps from tier (sandbox 500 / growth 10k / enterprise 100k).
-- Only touch rows still on the historical default of 100 so any future custom
-- caps are preserved.
UPDATE lead_counters lc SET daily_lead_cap = CASE ub.tier
  WHEN 'enterprise' THEN 100000
  WHEN 'growth'     THEN 10000
  ELSE 500
END
FROM user_billing ub
WHERE ub.user_id = lc.user_id
  AND lc.daily_lead_cap = 100;
