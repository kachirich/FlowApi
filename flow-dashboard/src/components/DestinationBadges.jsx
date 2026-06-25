import { Plug } from 'lucide-react';

/**
 * Presentational badges shared by DestinationManager and FlowManager.
 * Backend exposes `destination_type` ('webhook' | 'rest_api') and a boolean
 * `has_token` (the raw token is never returned to the client). The specific
 * tool (NocoDB, n8n, Airtable, …) lives in the user-supplied name, not the type.
 */

const TYPE_BADGE_META = {
  rest_api: { label: 'REST API', Icon: Plug },
};

/** Violet pill identifying a token-based destination type. Renders nothing for webhook. */
export function DestinationTypeBadge({ type }) {
  const meta = TYPE_BADGE_META[type];
  if (!meta) return null;
  const { label, Icon } = meta;
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
