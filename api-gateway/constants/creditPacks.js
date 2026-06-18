/**
 * Prepaid lead-credit packs. 1 credit = 1 successfully delivered lead.
 * Single source of truth — import everywhere (routes, tests, future Stripe).
 */
export const CREDIT_PACKS = {
  starter: { credits: 500,   label: 'Starter', description: 'Best for testing' },
  growth:  { credits: 2000,  label: 'Growth',  description: 'Most popular' },
  pro:     { credits: 10000, label: 'Pro',     description: 'High volume' },
};
