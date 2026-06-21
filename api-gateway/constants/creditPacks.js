/**
 * Prepaid lead-credit packs. 1 credit = 1 successfully delivered lead.
 * Single source of truth — import everywhere (routes, tests, future Stripe).
 */
export const CREDIT_PACKS = {
  starter: { credits: 500,   label: 'Starter', description: 'Best for testing' },
  growth:  { credits: 2000,  label: 'Growth',  description: 'Most popular' },
  pro:     { credits: 10000, label: 'Pro',     description: 'High volume' },
};

/**
 * Monthly credit grant per destination, keyed by plan_type.
 * free/basic → 50  |  pro (Growth tier) → 1 000  |  plus (Enterprise) → 10 000
 */
export const PLAN_MONTHLY_GRANTS = {
  free:  50,
  basic: 50,
  pro:   1000,
  plus:  10000,
};
