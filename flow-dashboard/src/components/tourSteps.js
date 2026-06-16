/**
 * Universal onboarding tour steps.
 *
 * One flat list for all users — no tier branching.
 * Steps that mention premium features use soft copy so users understand
 * what they can unlock; the actual feature gates live in the UI itself.
 */
export function getTourSteps() {
  return [
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
        'Destinations are where caught leads get routed. Open the sandbox to wire up your first target. Custom headers and broadcast routing unlock on the Growth plan.',
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
      content:
        'Track throughput, blocked bots, and delivery health. Retry analytics and extended log history unlock on the Growth plan.',
    },
    {
      target: '#tour-control-panel',
      title: 'Control Panel',
      content:
        'Collapse sections, manage your API key, and control delivery settings from here. Enterprise retry tiers and unlimited log retention unlock on the Enterprise plan.',
    },
  ];
}
