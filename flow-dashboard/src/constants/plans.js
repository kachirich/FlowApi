// Frontend mirror of api-gateway/config/plans.js. Canonical tiers:
// sandbox (free) · growth (was pro) · enterprise (was plus).
// normalizeTier() coerces any legacy plan_type value so older API payloads
// (or cached state) still resolve to one of the three tiers.

export function normalizeTier(value) {
  switch (value) {
    case 'enterprise':
    case 'plus':
      return 'enterprise';
    case 'growth':
    case 'pro':
    case 'basic':
      return 'growth';
    case 'sandbox':
    case 'free':
    default:
      return 'sandbox';
  }
}

export const TIER_DISPLAY_NAMES = {
  sandbox: 'Sandbox',
  growth: 'Growth',
  enterprise: 'Enterprise',
};

/** Lifetime API-key (webhook) cap per tier — mirrors PLANS[tier].maxApiKeys. */
export const TIER_API_KEY_LIMIT = {
  sandbox: 2,
  growth: 50,
  enterprise: Infinity,
};

/** The tier a user is prompted to upgrade to next (null at the top). */
export const NEXT_TIER = {
  sandbox: 'growth',
  growth: 'enterprise',
  enterprise: null,
};

export const TIER_PERKS = {
  growth: [
    'Custom headers on outbound webhooks',
    'Broadcast routing — fan out to every destination',
    '100k monthly requests · 10k leads/day',
    '30-day delivery log retention',
    'Priority email support',
  ],
  enterprise: [
    'Unlimited monthly requests',
    'Unlimited delivery log retention',
    'Enterprise retry tiers (100 attempts, exponential)',
    'Custom headers + broadcast routing',
    'Dedicated support channel',
  ],
};

/** Human-friendly tier name; accepts a tier or a legacy plan_type. */
export const displayPlan = (value) => TIER_DISPLAY_NAMES[normalizeTier(value)] || 'Sandbox';
