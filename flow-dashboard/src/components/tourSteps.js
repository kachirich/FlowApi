/**
 * Tier-aware onboarding tour steps.
 *
 * Every `target` below is a stable `id` that is rendered on the default
 * dashboard view (verified in Dashboard.jsx). Steps are FILTERED by plan —
 * anchor ids are never relabeled per tier, which keeps the spotlight stable
 * and prevents the per-tier layout drift that plagued the old tour.
 */
export function getTourSteps(planType) {
  const isPaid = ['basic', 'pro', 'plus'].includes(planType);
  const isPlus = planType === 'plus';

  const steps = [
    {
      target: '#tour-webhook-generator',
      title: 'Your Inbound Endpoint',
      content:
        'This is your unique webhook URL. Paste it into GoHighLevel or any CRM to start catching leads.',
      disableBeacon: true,
    },
    {
      target: '#tour-destination-sandbox',
      title: 'Map a Destination',
      content:
        'Destinations are where caught leads get routed. Open the sandbox to wire up your first target.',
    },
    {
      target: '#tour-lead-ledger',
      title: 'The Lead Vault',
      content:
        'Every inbound lead is scored, deduplicated, and tracked here — watch delivery status update live.',
    },
    {
      target: '#tour-metrics-panel',
      title: 'Live Metrics',
      content: isPaid
        ? 'Track throughput, blocked bots, and delivery health in real time.'
        : 'Track your usage here. Upgrade to unlock retries, custom headers, and broadcast routing.',
    },
    ...(isPlus
      ? [
          {
            target: '#tour-control-panel',
            title: 'Enterprise Controls',
            content:
              'Unlimited log retention and 100-attempt enterprise retry tiers are active on your Plus plan.',
          },
        ]
      : []),
  ];

  return steps;
}
