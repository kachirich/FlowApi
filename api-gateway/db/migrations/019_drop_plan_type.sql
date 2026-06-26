-- Plan consolidation phase 2c (IRREVERSIBLE).
-- `tier` (sandbox/growth/enterprise) is now the sole plan axis; no application
-- code reads or writes plan_type (see phase 2a, commit 2c37319). Drop the
-- legacy column. tierFromPlan() still maps Stripe/LemonSqueezy product names to
-- a tier, but never persists plan_type.

ALTER TABLE user_billing DROP COLUMN IF EXISTS plan_type;
