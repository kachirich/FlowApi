/**
 * Single source of truth for BullMQ delivery retry config, keyed on `plan_type`.
 *
 * Used by both dispatch paths so they can never diverge again:
 *   - the queue-routing path (`WebhookDispatcher.dispatchLead`), and
 *   - the direct catch path (`leadIngest`).
 *
 * Previously these disagreed — `WebhookDispatcher` keyed on `tier`
 * (sandbox/growth/enterprise) while `leadIngest` keyed on `plan_type`, with
 * different attempt counts and backoff types that could never agree.
 *
 *   plus → 100 attempts, exponential (preserves the documented top-tier SLA)
 *   pro  → 5 attempts, exponential
 *   free / basic / anything else → a single attempt, no retry
 */
export function retryConfig(planType) {
  if (planType === "plus") {
    return { attempts: 100, backoff: { type: "exponential", delay: 5000 } };
  }
  if (planType === "pro") {
    return { attempts: 5, backoff: { type: "exponential", delay: 5000 } };
  }
  return { attempts: 1, backoff: undefined };
}
