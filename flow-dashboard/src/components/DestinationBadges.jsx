import { Plug, Database, Workflow, Webhook, Send, Zap, FileText, Table2 } from 'lucide-react';

/**
 * Presentational badges shared by DestinationManager and FlowManager.
 * Backend exposes `destination_type` ('webhook' | 'rest_api'), `provider`
 * ('generic' | 'nocodb' | 'n8n' | 'gohighlevel'), and a boolean `has_token`
 * (the raw token is never returned to the client).
 */

/**
 * Brand identity for the flow icon-chain. Lightweight: a real backend provider
 * wins, otherwise the brand is inferred from the destination URL hostname so a
 * plain webhook pointed at Zapier/Notion/Airtable/etc. still reads at a glance.
 * Icons are clean lucide glyphs, not exact logos (no extra deps, no schema).
 */
const BRANDS = {
  gohighlevel: { label: 'GoHighLevel', Icon: Send },
  nocodb: { label: 'NocoDB', Icon: Database },
  n8n: { label: 'n8n', Icon: Workflow },
  zapier: { label: 'Zapier', Icon: Zap },
  notion: { label: 'Notion', Icon: FileText },
  airtable: { label: 'Airtable', Icon: Table2 },
  make: { label: 'Make', Icon: Workflow },
  webhook: { label: 'Webhook', Icon: Webhook },
  custom: { label: 'Custom', Icon: Plug },
};

function inferBrandKey({ destination_type, provider, target_url } = {}) {
  if (provider && provider !== 'generic' && BRANDS[provider]) return provider;
  let host = '';
  try { host = new URL(target_url).hostname.toLowerCase(); } catch { host = ''; }
  if (host.includes('leadconnectorhq') || host.includes('gohighlevel')) return 'gohighlevel';
  if (host.includes('zapier')) return 'zapier';
  if (host.includes('notion')) return 'notion';
  if (host.includes('airtable')) return 'airtable';
  if (host.includes('make.com') || host.includes('integromat')) return 'make';
  if (host.includes('nocodb')) return 'nocodb';
  if (host.includes('n8n')) return 'n8n';
  return destination_type === 'rest_api' ? 'custom' : 'webhook';
}

/** Resolve a destination to its { label, Icon } brand. */
export function brandFor(dest) {
  return BRANDS[inferBrandKey(dest)] || BRANDS.custom;
}

// rest_api providers get a specific label/icon; generic/undefined → "REST API".
const PROVIDER_BADGE_META = {
  generic: { label: 'REST API', Icon: Plug },
  nocodb: { label: 'NocoDB', Icon: Database },
  n8n: { label: 'n8n', Icon: Workflow },
  gohighlevel: { label: 'GoHighLevel', Icon: Send },
};

/**
 * Violet pill identifying a destination's channel. Token-based (rest_api)
 * destinations key off `provider`; webhook destinations show a generic
 * "Webhook" pill — except GoHighLevel, which is a webhook-delivery provider
 * and gets its own branded pill.
 */
export function DestinationTypeBadge({ type, provider }) {
  if (type !== 'rest_api') {
    if (provider === 'gohighlevel') {
      const { label, Icon } = PROVIDER_BADGE_META.gohighlevel;
      return (
        <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-violet-500/10 text-violet-300 border border-violet-500/20">
          <Icon className="h-3 w-3" />
          {label}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-zinc-800/60 text-zinc-400 border border-zinc-700">
        <Webhook className="h-3 w-3" />
        Webhook
      </span>
    );
  }
  const { label, Icon } = PROVIDER_BADGE_META[provider] || PROVIDER_BADGE_META.generic;
  return (
    <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-violet-500/10 text-violet-300 border border-violet-500/20">
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

/** Gray monospace indicator that an encrypted token is stored for this destination. */
export function TokenBadge() {
  return (
    <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-mono text-zinc-500 bg-zinc-800/60 border border-zinc-700">
      ••••••• token set
    </span>
  );
}
