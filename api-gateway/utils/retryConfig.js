/**
 * BullMQ delivery retry config. Thin wrapper over config/plans.js so the two
 * dispatch paths (WebhookDispatcher.dispatchLead and the direct catch path in
 * leadIngest) can never diverge. Accepts a tier OR a legacy plan_type.
 *
 *   enterprise (plus) → 100 attempts, exponential
 *   growth (pro/basic) → 5 attempts, exponential
 *   sandbox (free)     → a single attempt, no retry
 */
import { planFor } from "../config/plans.js";

export function retryConfig(planType) {
  return planFor(planType).retry;
}
