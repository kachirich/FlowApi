/**
 * Plans — the single source of truth for billing tiers and every limit they
 * gate. Before this file the same concepts were spread across tierFromPlan,
 * retryConfig, creditPacks, rateLimiter, meteredLimiter, requirePlan and the
 * admin/stats routes, each keyed differently (some on `tier`, some on the
 * legacy `plan_type`). Everything now derives from here.
 *
 * Canonical tiers: sandbox (free) · growth (was pro) · enterprise (was plus).
 * The legacy `plan_type` enum (free/basic/pro/plus) is being retired; until the
 * column is dropped, normalizeTier() accepts either form so call sites can pass
 * whatever they already have and still resolve to one of the three tiers.
 */

export const TIERS = ["sandbox", "growth", "enterprise"];

export const PLANS = {
  sandbox: {
    label: "Sandbox",
    monthlyRequests: 10_000,
    dailyLeadCap: 500,
    maxDestinations: 1,
    maxApiKeys: 2,
    customHeaders: false,
    webhookLogs: false,
    logRetentionDays: 7,
    monthlyCredits: 50,
    retry: { attempts: 1, backoff: undefined },
  },
  growth: {
    label: "Growth",
    monthlyRequests: 100_000,
    dailyLeadCap: 10_000,
    maxDestinations: 5,
    maxApiKeys: 50,
    customHeaders: true,
    webhookLogs: true,
    logRetentionDays: 30,
    monthlyCredits: 1_000,
    retry: { attempts: 5, backoff: { type: "exponential", delay: 5000 } },
  },
  enterprise: {
    label: "Enterprise",
    monthlyRequests: Infinity,
    dailyLeadCap: 100_000,
    maxDestinations: Infinity,
    maxApiKeys: Infinity,
    customHeaders: true,
    webhookLogs: true,
    logRetentionDays: null, // null = retain forever
    monthlyCredits: 10_000,
    retry: { attempts: 100, backoff: { type: "exponential", delay: 5000 } },
  },
};

/**
 * Map any plan identifier — a canonical tier OR a legacy plan_type — to one of
 * the three tiers. free→sandbox, basic+pro→growth, plus→enterprise. Unknown or
 * missing values fall back to the safest tier (sandbox).
 */
export function normalizeTier(value) {
  switch (value) {
    case "enterprise":
    case "plus":
      return "enterprise";
    case "growth":
    case "pro":
    case "basic":
      return "growth";
    case "sandbox":
    case "free":
    default:
      return "sandbox";
  }
}

/** Resolve a tier-or-plan_type string to its full plan config. */
export function planFor(value) {
  return PLANS[normalizeTier(value)];
}
