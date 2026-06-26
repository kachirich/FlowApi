import axios from "axios";

/**
 * Provider registry — single source of truth for how each REST API provider
 * authenticates and (optionally) exposes a browsable resource tree.
 *
 * `destination_type` stays 'rest_api'; the `provider` column selects an adapter.
 * Adding a new table-DB (Airtable, Baserow, …) is a new entry here, not a rewrite.
 *
 * Each adapter:
 *   - label / icon            → presentation (icon = lucide name; FE maps it)
 *   - auth { header, value }  → outbound auth header at dispatch time
 *   - urlPlaceholder?         → hint for free-text (no-browse) providers
 *   - browse?                 → lazy resource picker (omit for webhook-style tools)
 */

const NOCODB_BASE = "https://app.nocodb.com";

const PROVIDERS = {
  generic: {
    label: "REST API",
    icon: "Plug",
    auth: { header: "Authorization", value: (t) => `Bearer ${t}` },
  },

  nocodb: {
    label: "NocoDB",
    icon: "Database",
    // Cloud base is hardcoded — the user never pastes a base URL.
    baseUrl: NOCODB_BASE,
    auth: { header: "xc-token", value: (t) => t },
    browse: {
      // Three-level cascade. NocoDB Cloud scopes base listing to a workspace —
      // the bare /meta/bases/ endpoint 403s — so we start at the workspace.
      // path=[] → workspaces; path=[wsId] → bases; path=[wsId,baseId] → tables.
      // Leaf items carry the fully-resolved records URL so ids stay server-side.
      levels: ["Workspace", "Base", "Table"],
      list: async (token, path = []) => {
        const headers = { "xc-token": token };

        if (path.length === 0) {
          const { data } = await axios.get(`${NOCODB_BASE}/api/v2/meta/workspaces/`, { headers, timeout: 5000 });
          return (data?.list || []).map((w) => ({ id: w.id, name: w.title || w.id, leaf: false }));
        }

        if (path.length === 1) {
          const workspaceId = path[0];
          const { data } = await axios.get(
            `${NOCODB_BASE}/api/v2/meta/workspaces/${encodeURIComponent(workspaceId)}/bases`,
            { headers, timeout: 5000 }
          );
          return (data?.list || []).map((b) => ({ id: b.id, name: b.title || b.id, leaf: false }));
        }

        const baseId = path[1];
        const { data } = await axios.get(
          `${NOCODB_BASE}/api/v2/meta/bases/${encodeURIComponent(baseId)}/tables`,
          { headers, timeout: 5000 }
        );
        return (data?.list || []).map((t) => ({
          id: t.id,
          name: t.title || t.id,
          leaf: true,
          target_url: `${NOCODB_BASE}/api/v2/tables/${encodeURIComponent(t.id)}/records`,
        }));
      },
    },
  },

  n8n: {
    label: "n8n",
    icon: "Workflow",
    // Webhook-style: no browsable schema, so free-text URL + Bearer. Authenticated
    // n8n sets a Header Auth credential expecting `Authorization: Bearer <token>`.
    urlPlaceholder: "https://<your-n8n-host>/webhook/<path>",
    auth: { header: "Authorization", value: (t) => `Bearer ${t}` },
  },

  gohighlevel: {
    label: "GoHighLevel",
    icon: "Send",
    // Inbound-webhook delivery: the user pastes a GHL Workflow "Inbound Webhook"
    // trigger URL. No auth header — GHL authenticates by the unguessable URL, so
    // this rides the plain webhook dispatch path (destination_type 'webhook', no
    // token). The auth entry is a harmless Bearer fallback that is only consulted
    // when a token is present, which it never is for this provider.
    urlPlaceholder: "https://services.leadconnectorhq.com/hooks/<location>/webhook-trigger/<id>",
    auth: { header: "Authorization", value: (t) => `Bearer ${t}` },
  },
};

export const PROVIDER_IDS = Object.keys(PROVIDERS);
export const BROWSABLE_PROVIDER_IDS = PROVIDER_IDS.filter((id) => PROVIDERS[id].browse);

/** Adapter for a provider, falling back to the generic (Bearer) adapter. */
export function getAdapter(provider) {
  return PROVIDERS[provider] || PROVIDERS.generic;
}

/**
 * Outbound auth header for a destination, or null when there is no token.
 * Used by both dispatch paths (WebhookDispatcher + legacy queueWorker) so they
 * never diverge — generic/unknown → Bearer, nocodb → xc-token.
 */
export function getAuthHeader(provider, token) {
  if (!token) return null;
  const { auth } = getAdapter(provider);
  return { name: auth.header, value: auth.value(token) };
}
