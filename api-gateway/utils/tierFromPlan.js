/**
 * Derive the billing `tier` from a `plan_type`. Single source of truth so the
 * billing webhook, the admin upgrade routes, and the migration-014 backfill all
 * agree. `tier` gates the daily lead cap in middleware/rateLimiter.js
 * (enterprise → 100k, growth → 10k, sandbox → 500/day).
 */
export function tierFromPlan(planType) {
  if (planType === "plus") return "enterprise";
  if (planType === "pro") return "growth";
  return "sandbox";
}
