export const PLAN_DISPLAY_NAMES = {
  free: 'Free',
  basic: 'Starter',
  pro: 'Growth',
  plus: 'Enterprise',
};

export const PLAN_PERKS = {
  basic: [
    '3-attempt retries on failed deliveries',
    '7-day log retention',
    'Round-robin routing across destinations',
  ],
  pro: [
    'Custom headers on webhook destinations',
    'Broadcast routing (deliver to all destinations)',
    '100-attempt retries with exponential backoff',
    '30-day log retention',
  ],
  plus: [
    'Everything in Growth',
    'Unlimited log retention',
    'Enterprise retry tiers (100 attempts)',
    'Priority support',
  ],
};

export const displayPlan = (planType) =>
  PLAN_DISPLAY_NAMES[(planType || 'free').toLowerCase()] || 'Free';
