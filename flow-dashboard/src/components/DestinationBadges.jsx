import { Plug, Database, Workflow, Webhook, Send } from 'lucide-react';

/**
 * Presentational badges shared by DestinationManager and FlowManager.
 * Backend exposes `destination_type` ('webhook' | 'rest_api'), `provider`
 * ('generic' | 'nocodb' | 'n8n' | 'gohighlevel'), and a boolean `has_token`
 * (the raw token is never returned to the client).
 */

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
