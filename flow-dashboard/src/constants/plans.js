export const PLAN_DISPLAY_NAMES = {
  free: 'Free',
  basic: 'Starter',
  pro: 'Growth',
  plus: 'Enterprise',
};

export const PLAN_PERKS = {
  basic: [
    '3-attempt retry logic with 5s backoff',
    '7-day delivery log retention',
    'Higher monthly request quota (100k)',
    'Email support',
  ],
  pro: [
    'Custom headers on outbound webhooks',
    'Broadcast routing — fan out to every destination',
    '100-attempt retry tiers',
    '30-day delivery log retention',
    'Priority email support',
  ],
  plus: [
    'Unlimited monthly requests',
    'Unlimited delivery log retention',
    'Enterprise retry tiers (100 attempts, exponential)',
    'Custom headers + broadcast routing',
    'Dedicated support channel',
  ],
};

export const displayPlan = (planType) =>
  PLAN_DISPLAY_NAMES[(planType || 'free').toLowerCase()] || 'Free';
