/**
 * Universal onboarding tour — one path for every user. Where a feature is
 * gated, we mention the upgrade plan in the copy (e.g. "30 days on Growth")
 * instead of branching the steps. This keeps anchors stable and surfaces
 * upgrade value without dot-spam.
 *
 * Every target id is rendered on the default Dashboard tab so all anchors
 * are guaranteed mounted when the tour runs.
 */
export function getTourSteps() {
  return [
    {
      target: 'body',
      placement: 'center',
      title: 'Welcome to FlowGateway',
      content:
        'A 30-second tour of the gateway — your central hub for catching, scoring, and routing leads from any CRM.',
    },
    {
      target: '#tour-webhook-generator',
      title: 'Your Inbound Endpoint',
      content:
        'Generate your unique webhook URL here. Paste it into GoHighLevel, Jotform, or any source to start catching leads.',
    },
    {
      target: '#tour-destination-sandbox',
      title: 'Map a Destination',
      content:
        'Destinations are where your leads get dispatched. Round-robin routing is included on Free; broadcast routing unlocks with the Growth plan.',
    },
    {
      target: '#tour-lead-ledger',
      title: 'The Lead Vault',
      content:
        'Every inbound lead lands here — scored, deduplicated, and tracked through delivery in real time. Logs are kept 7 days on Free, 30 days on Growth, unlimited on Enterprise.',
    },
    {
      target: '#tour-metrics-panel',
      title: 'Live Metrics',
      content:
        "You're all set. Throughput, blocked spam, and Zapier tax saved update live. Upgrade to Growth to unlock retries, custom headers, and broadcast routing.",
    },
  ];
}
