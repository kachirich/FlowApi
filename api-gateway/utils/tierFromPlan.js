/**
 * Derive the billing `tier` from a `plan_type` (or pass a tier through). Thin
 * wrapper over the single source of truth in config/plans.js — kept as a named
 * export so the billing webhook, admin upgrade routes and migrations that
 * already import it don't need to change.
 *
 * Mapping: plus→enterprise, pro+basic→growth, free→sandbox.
 */
import { normalizeTier } from "../config/plans.js";

export function tierFromPlan(planType) {
  return normalizeTier(planType);
}
