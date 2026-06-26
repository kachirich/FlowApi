import { useState, useEffect, useRef } from 'react';
import apiClient from '../utils/api';
import {
  Plus, Trash2, Loader2, Shuffle, Edit2, Pencil, X, Webhook, Plug, Database, Workflow, Send, Eye, EyeOff, Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { DestinationTypeBadge, TokenBadge } from './DestinationBadges';
import { apiTokenSchema } from '../utils/validators';

const fmtNum = (n) => (n ?? 0).toLocaleString();

/**
 * Channels — the single source of truth for the destination picker. Each tile
 * maps to a backend (destination_type, provider) pair. `needsToken` drives the
 * encrypted-token field; `picker` swaps the URL field for the NocoDB browser.
 * Mirrors api-gateway/services/providers/registry.js.
 */
const CHANNELS = [
  {
    id: 'webhook', label: 'Webhook', Icon: Webhook,
    blurb: 'POST leads as JSON to any HTTPS endpoint.',
    type: 'webhook', provider: 'generic', needsToken: false,
    urlPlaceholder: 'https://your-buyer.com/webhook',
  },
  {
    id: 'gohighlevel', label: 'GoHighLevel', Icon: Send,
    blurb: 'Push leads into a GHL Workflow inbound webhook.',
    type: 'webhook', provider: 'gohighlevel', needsToken: false,
    urlPlaceholder: 'https://services.leadconnectorhq.com/hooks/<location>/webhook-trigger/<id>',
  },
  {
    id: 'rest_api', label: 'REST API', Icon: Plug,
    blurb: 'Any endpoint that accepts a Bearer token.',
    type: 'rest_api', provider: 'generic', needsToken: true,
    urlPlaceholder: 'https://your-api.example.com/endpoint',
  },
  {
    id: 'nocodb', label: 'NocoDB', Icon: Database,
    blurb: 'Insert rows straight into a NocoDB table.',
    type: 'rest_api', provider: 'nocodb', needsToken: true, picker: true,
  },
  {
    id: 'n8n', label: 'n8n', Icon: Workflow,
    blurb: 'Trigger an n8n workflow over webhook.',
    type: 'rest_api', provider: 'n8n', needsToken: true,
    urlPlaceholder: 'https://<your-n8n-host>/webhook/<path>',
  },
];

const channelFor = (type, provider) =>
  CHANNELS.find((c) => c.type === (type || 'webhook') && c.provider === (provider || 'generic')) || CHANNELS[0];
const channelById = (id) => CHANNELS.find((c) => c.id === id) || CHANNELS[0];

const labelCls = 'text-xs font-medium uppercase tracking-wider text-zinc-500 block mb-1.5';
const inputCls =
  'w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-indigo-500 placeholder:text-zinc-600';

/**
 * Masked secret field that is NOT type="password" — that's deliberate. A
 * password-type input makes the browser's password manager offer to "save" the
 * API token (the "Save password?" popup). We mask via the `.secret-mask` CSS
 * class instead and opt out of every known manager (1Password, LastPass,
 * Bitwarden, Chrome), while still offering a show/hide toggle.
 */
function SecretInput({ value, onChange, placeholder, error }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        data-1p-ignore=""
        data-lpignore="true"
        data-bwignore=""
        data-form-type="other"
        className={`${inputCls} pr-10 font-mono ${show ? '' : 'secret-mask'} ${error ? 'border-rose-500/60 focus:border-rose-500' : ''}`}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        tabIndex={-1}
        title={show ? 'Hide token' : 'Show token'}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-zinc-500 transition-colors hover:text-zinc-300"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

const pickerInputCls =
  'w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-indigo-500 placeholder:text-zinc-600';

/**
 * Generic NocoDB resource picker — a lazy N-level cascade driven entirely by
 * the backend's `levels` labels and per-item `leaf`/`target_url` flags. NocoDB
 * Cloud needs Workspace → Base → Table (base listing is workspace-scoped), but
 * this component never hardcodes that depth, so the registry can change levels
 * without a frontend edit. The resolved records URL is sent up via onResolved;
 * the base URL (app.nocodb.com) and all ids stay server-side.
 */
function NocoDbPicker({ apiToken, resolvedUrl, onResolved }) {
  const [levels, setLevels] = useState([]);     // label per depth, e.g. ["Workspace","Base","Table"]
  const [options, setOptions] = useState([]);   // options[i] = item list shown at depth i
  const [selected, setSelected] = useState([]); // selected[i] = chosen id at depth i
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const browse = async (path) => {
    const res = await apiClient.post('/api/destinations/browse', {
      provider: 'nocodb',
      api_token: apiToken,
      path,
    });
    return res.data || {};
  };

  const start = async () => {
    if (!apiToken.trim()) {
      setError('Enter your NocoDB API token first.');
      return;
    }
    setLoading(true);
    setError('');
    setSelected([]);
    onResolved('');
    try {
      const data = await browse([]);
      setLevels(data.levels || []);
      setOptions([data.items || []]);
    } catch (e) {
      setError(e.response?.data?.message || 'Could not browse NocoDB.');
      setLevels([]);
      setOptions([]);
    } finally {
      setLoading(false);
    }
  };

  const pick = async (depth, id) => {
    const nextSelected = selected.slice(0, depth);
    nextSelected[depth] = id;
    setSelected(nextSelected);
    setOptions((prev) => prev.slice(0, depth + 1)); // drop any deeper levels
    onResolved('');
    if (!id) return;

    const item = (options[depth] || []).find((x) => String(x.id) === String(id));
    if (!item) return;
    if (item.leaf) {
      onResolved(item.target_url || '');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const data = await browse(nextSelected.slice(0, depth + 1));
      setOptions((prev) => {
        const next = prev.slice(0, depth + 1);
        next[depth + 1] = data.items || [];
        return next;
      });
    } catch (e) {
      setError(e.response?.data?.message || 'Could not load the next level.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className={labelCls}>NocoDB table</label>
      <button
        type="button"
        onClick={start}
        disabled={loading || !apiToken.trim()}
        className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Database className="h-3.5 w-3.5" />}
        {options.length ? 'Reload' : 'Browse my NocoDB'}
      </button>

      {options.map((opts, depth) => (
        <select
          key={depth}
          value={selected[depth] || ''}
          onChange={(e) => pick(depth, e.target.value)}
          disabled={loading}
          className={`${pickerInputCls} ${depth === 0 ? 'mt-1' : ''}`}
        >
          <option value="">— Select a {(levels[depth] || 'item').toLowerCase()} —</option>
          {opts.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      ))}

      {error && <p className="text-xs text-rose-400">{error}</p>}
      {resolvedUrl && (
        <p className="font-mono text-xs text-emerald-400/90 break-all">{resolvedUrl}</p>
      )}
    </div>
  );
}

const CAP_PRESETS = [
  { label: 'Unlimited', value: 0 },
  { label: '50', value: 50 },
  { label: '100', value: 100 },
  { label: '250', value: 250 },
  { label: '500', value: 500 },
  { label: '1k', value: 1000 },
];

function CapChipSelector({ value, onChange, inline = false }) {
  const [showCustom, setShowCustom] = useState(false);
  const customInputRef = useRef(null);

  const handlePresetClick = (presetValue) => {
    onChange(presetValue);
    setShowCustom(false);
  };

  const handleCustomInput = (e) => {
    const num = parseInt(e.target.value, 10);
    if (!isNaN(num)) {
      onChange(num);
    }
  };

  const containerClass = inline ? 'flex flex-wrap gap-1.5' : 'flex flex-wrap gap-2';

  return (
    <div className={containerClass}>
      {CAP_PRESETS.map((preset) => {
        const isActive = value === preset.value;
        return (
          <button
            key={preset.value}
            type="button"
            onClick={() => handlePresetClick(preset.value)}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              isActive
                ? 'bg-indigo-500 text-white border border-indigo-400'
                : 'bg-zinc-800 text-zinc-300 border border-zinc-700 hover:border-zinc-600'
            } ${inline ? 'text-[11px] px-2 py-0.5' : ''}`}
          >
            {preset.label}
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => setShowCustom((s) => !s)}
        className={`px-2.5 py-1 rounded text-xs font-medium transition-colors bg-zinc-800 text-zinc-300 border border-zinc-700 hover:border-zinc-600 ${
          inline ? 'text-[11px] px-2 py-0.5' : ''
        }`}
      >
        Custom {showCustom ? '▴' : '▾'}
      </button>
      {showCustom && (
        <div className={`${inline ? 'w-full' : ''}`}>
          <input
            ref={customInputRef}
            type="number"
            min="0"
            placeholder="Enter number"
            onChange={handleCustomInput}
            autoFocus
            className={`rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-100 outline-none focus:border-indigo-500 ${
              inline ? 'w-full' : 'w-24'
            }`}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Integration-style tile grid for picking the destination channel. Mirrors the
 * Integrations tab cards — icon chip + name + one-line blurb, single indigo
 * accent for the selected tile.
 */
function ChannelPicker({ value, onSelect }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {CHANNELS.map((c) => {
        const active = c.id === value;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(c.id)}
            className={`group flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
              active
                ? 'border-indigo-500 bg-indigo-500/10'
                : 'border-zinc-800 bg-zinc-950 hover:border-zinc-700'
            }`}
          >
            <span
              className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${
                active
                  ? 'border-indigo-500/30 bg-indigo-500/15 text-indigo-300'
                  : 'border-zinc-700 bg-zinc-900 text-zinc-400 group-hover:text-zinc-300'
              }`}
            >
              <c.Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className={`text-sm font-medium ${active ? 'text-zinc-50' : 'text-zinc-200'}`}>{c.label}</span>
                {active && <Check className="h-3.5 w-3.5 text-indigo-400" />}
              </span>
              <span className="mt-0.5 block text-xs leading-snug text-zinc-500">{c.blurb}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Shared add/edit modal — gives both flows the same "integration modal" feel.
 * mode='add' starts blank; mode='edit' seeds from `dest`. Mounted only while
 * open (keyed by dest id), so state resets cleanly each time.
 */
function DestinationFormModal({ mode, dest, onClose, onSaved }) {
  const origChannel = mode === 'edit' ? channelFor(dest.destination_type, dest.provider) : CHANNELS[0];

  const [channelId, setChannelId] = useState(origChannel.id);
  const [name, setName] = useState(dest?.name || '');
  const [targetUrl, setTargetUrl] = useState(dest?.target_url || '');
  const [dailyCap, setDailyCap] = useState(dest?.daily_cap ?? 0);
  const [apiToken, setApiToken] = useState('');
  const [tokenError, setTokenError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const channel = channelById(channelId);
  const hasStoredToken = mode === 'edit' && origChannel.id === channelId && !!dest.has_token;

  // Real-time token validation (mirrors the backend api_token rule).
  useEffect(() => {
    if (!channel.needsToken || !apiToken) {
      setTokenError('');
      return;
    }
    const result = apiTokenSchema.safeParse(apiToken);
    setTokenError(result.success ? '' : result.error.issues[0].message);
  }, [apiToken, channel.needsToken]);

  const selectChannel = (id) => {
    setChannelId(id);
    setApiToken('');
    setTokenError('');
    // Restore the saved URL when re-selecting the original channel in edit mode;
    // otherwise clear it so a stale URL never carries across channels.
    setTargetUrl(mode === 'edit' && id === origChannel.id ? (dest.target_url || '') : '');
  };

  const tokenRequired = channel.needsToken && !apiToken.trim() && !hasStoredToken;

  const hasChanges =
    mode === 'add' ||
    name.trim() !== (dest.name || '') ||
    targetUrl.trim() !== (dest.target_url || '') ||
    dailyCap !== (dest.daily_cap ?? 0) ||
    channelId !== origChannel.id ||
    !!apiToken.trim();

  const submitDisabled =
    submitting || !name.trim() || !targetUrl.trim() || tokenRequired || !!tokenError || !hasChanges;

  const close = () => {
    if (submitting) return;
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !targetUrl.trim()) {
      toast.error('Name and Target URL are required');
      return;
    }
    if (channel.needsToken && apiToken.trim()) {
      const result = apiTokenSchema.safeParse(apiToken);
      if (!result.success) {
        setTokenError(result.error.issues[0].message);
        return;
      }
    }
    if (tokenRequired) {
      setTokenError('A token is required for this destination type');
      return;
    }

    try {
      setSubmitting(true);
      if (mode === 'add') {
        const res = await apiClient.post('/api/destinations', {
          name: name.trim(),
          target_url: targetUrl.trim(),
          daily_cap: dailyCap,
          destination_type: channel.type,
          provider: channel.provider,
          ...(channel.needsToken && apiToken.trim() ? { api_token: apiToken.trim() } : {}),
        });
        if (res.data?.success) {
          toast.success('Destination created successfully');
          onSaved();
          onClose();
        }
        return;
      }

      // Edit — send only changed fields. Backend rules: token typed → rotate;
      // type → webhook → clear token; blank → unchanged.
      const payload = {};
      if (name.trim() !== (dest.name || '')) payload.name = name.trim();
      if (targetUrl.trim() !== (dest.target_url || '')) payload.target_url = targetUrl.trim();
      if (dailyCap !== (dest.daily_cap ?? 0)) payload.daily_cap = dailyCap;
      if (channel.type !== (dest.destination_type || 'webhook')) payload.destination_type = channel.type;
      if (channel.provider !== (dest.provider || 'generic')) payload.provider = channel.provider;
      if (channel.needsToken && apiToken.trim()) payload.api_token = apiToken.trim();

      if (Object.keys(payload).length === 0) {
        onClose();
        return;
      }
      const res = await apiClient.put(`/api/destinations/${dest.id}`, payload);
      if (res.data?.success) {
        toast.success('Destination updated');
        onSaved();
        onClose();
      }
    } catch (err) {
      console.error(`Failed to ${mode} destination:`, err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={close}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" />
      <div
        className="relative z-10 w-full max-w-lg animate-modal-in overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-zinc-800 p-6 pb-4">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-widest text-indigo-300">
              {mode === 'add' ? 'New Destination' : 'Edit Destination'}
            </p>
            <h3 className="text-lg font-medium text-zinc-50 truncate">
              {mode === 'add' ? 'Connect a destination' : dest.name}
            </h3>
          </div>
          <button
            onClick={close}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit}>
          <div className="max-h-[60vh] overflow-y-auto p-6 space-y-4">
            <div>
              <label className={labelCls}>Channel</label>
              <ChannelPicker value={channelId} onSelect={selectChannel} />
            </div>

            <div>
              <label className={labelCls}>Destination name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. KCB Bank, Pesapal"
                className={inputCls}
              />
            </div>

            {channel.needsToken && (
              <div>
                <label className={labelCls}>API token</label>
                <SecretInput
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  placeholder={hasStoredToken ? 'Leave blank to keep current token' : 'Paste your API token'}
                  error={tokenError}
                />
                {tokenError ? (
                  <p className="mt-1 text-xs text-rose-400">{tokenError}</p>
                ) : (
                  <p className="mt-1 text-xs text-zinc-500">
                    {hasStoredToken
                      ? channel.picker
                        ? 'Type your token to re-pick a table, or leave blank to keep the current one.'
                        : 'A token is already stored. Type a new value to rotate it.'
                      : channel.picker
                        ? 'Used to list your NocoDB tables, then stored encrypted.'
                        : 'Stored encrypted. Never shown again after save.'}
                  </p>
                )}
              </div>
            )}

            {channel.picker ? (
              <NocoDbPicker apiToken={apiToken} resolvedUrl={targetUrl} onResolved={setTargetUrl} />
            ) : (
              <div>
                <label className={labelCls}>Target URL</label>
                <input
                  type="url"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder={channel.urlPlaceholder}
                  className={`${inputCls} font-mono`}
                />
              </div>
            )}

            <div>
              <label className={labelCls}>Daily lead cap (0 = unlimited)</label>
              <CapChipSelector value={dailyCap} onChange={setDailyCap} />
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-zinc-800 px-6 py-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={close}
              disabled={submitting}
              className="rounded-md border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 transition-colors duration-150 hover:bg-zinc-700 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitDisabled}
              className="flex items-center justify-center gap-2 rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> {mode === 'add' ? 'Creating...' : 'Saving...'}</>
              ) : (
                mode === 'add' ? <><Plus className="h-4 w-4" /> Add destination</> : 'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function DestinationManager() {
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  // Add/edit modal: null | { mode: 'add' } | { mode: 'edit', dest }
  const [modal, setModal] = useState(null);

  // Inline cap edit
  const [editingCapId, setEditingCapId] = useState(null);

  const fetchDestinations = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/api/destinations');
      if (res.data && res.data.success) {
        setDestinations(res.data.destinations);
      }
    } catch (err) {
      console.error('Failed to fetch destinations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDestinations();
  }, []);

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this destination?')) return;
    try {
      setDeletingId(id);
      const res = await apiClient.delete(`/api/destinations/${id}`);
      if (res.data && res.data.success) {
        toast.success('Destination deleted successfully');
        fetchDestinations();
      }
    } catch (err) {
      console.error('Failed to delete destination:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleActive = async (dest) => {
    try {
      const res = await apiClient.put(`/api/destinations/${dest.id}`, { is_active: !dest.is_active });
      if (res.data && res.data.success) {
        toast.success(`Destination ${!dest.is_active ? 'enabled' : 'disabled'}`);
        fetchDestinations();
      }
    } catch (err) {
      console.error('Failed to toggle destination status:', err);
    }
  };

  const handleUpdateCap = async (destId, newCap) => {
    try {
      const res = await apiClient.put(`/api/destinations/${destId}`, { daily_cap: newCap });
      if (res.data && res.data.success) {
        toast.success('Daily cap updated');
        setEditingCapId(null);
        fetchDestinations();
      }
    } catch (err) {
      console.error('Failed to update daily cap:', err);
    }
  };

  return (
    <div className="space-y-6 w-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-medium tracking-tight text-zinc-50 flex items-center gap-2">
            <Shuffle className="h-6 w-6 text-indigo-400" />
            Destinations
          </h2>
          <p className="text-sm text-zinc-400 mt-1 leading-relaxed">
            Configure where leads are delivered. Define daily caps per buyer.
          </p>
        </div>
        <button
          onClick={() => setModal({ mode: 'add' })}
          className="flex shrink-0 items-center gap-2 rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-indigo-400"
        >
          <Plus className="h-4 w-4" />
          Add destination
        </button>
      </div>

      {/* Destination cards */}
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-3 text-zinc-500">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
          <p className="text-xs">Loading destinations...</p>
        </div>
      ) : destinations.length === 0 ? (
        <div className="py-12 flex flex-col items-center justify-center text-center">
          <Shuffle className="h-8 w-8 text-zinc-700 mb-3" />
          <h4 className="text-sm font-medium text-zinc-300 mb-1">No destinations yet</h4>
          <p className="text-xs text-zinc-500 mb-4">Connect your first routing destination.</p>
          <button
            onClick={() => setModal({ mode: 'add' })}
            className="flex items-center gap-2 rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-indigo-400"
          >
            <Plus className="h-4 w-4" />
            Add destination
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {destinations.map((dest) => (
            <div key={dest.id} className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 transition-colors duration-150 hover:border-zinc-700">
              {/* Top row */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <button
                      onClick={() => handleToggleActive(dest)}
                      className={`rounded-md px-2 py-0.5 text-xs font-medium transition-colors duration-150 ${
                        dest.is_active ? 'bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20' : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'
                      }`}
                    >
                      {dest.is_active ? 'Active' : 'Disabled'}
                    </button>
                    <DestinationTypeBadge type={dest.destination_type} provider={dest.provider} />
                    {dest.has_token && <TokenBadge />}
                    <h3 className="text-base font-medium text-zinc-50 truncate">{dest.name}</h3>
                  </div>
                  <p className="mt-1 font-mono text-xs text-zinc-500 truncate" title={dest.target_url}>{dest.target_url}</p>

                  {/* Daily cap with inline edit */}
                  <div className="mt-1 flex items-center gap-2">
                    {editingCapId === dest.id ? (
                      <div className="flex items-center gap-2">
                        <CapChipSelector
                          value={dest.daily_cap}
                          onChange={(newVal) => handleUpdateCap(dest.id, newVal)}
                          inline={true}
                        />
                      </div>
                    ) : (
                      <>
                        <p className="text-xs text-zinc-500">
                          {dest.daily_cap === 0 ? 'Unlimited daily cap' : `${fmtNum(dest.daily_cap)} leads/day cap`}
                        </p>
                        <button
                          onClick={() => setEditingCapId(dest.id)}
                          className="text-zinc-600 hover:text-zinc-400 transition-colors"
                          title="Edit daily cap"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => setModal({ mode: 'edit', dest })}
                    className="rounded-md bg-zinc-800 p-2 text-zinc-300 transition-colors duration-150 hover:bg-zinc-700 hover:text-zinc-100 border border-zinc-700"
                    title="Edit destination"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(dest.id)}
                    disabled={deletingId === dest.id}
                    className="rounded-md p-2 text-rose-400 transition-colors duration-150 hover:bg-rose-500/10 disabled:opacity-50"
                    title="Delete destination"
                  >
                    {deletingId === dest.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              {/* lead metering disabled — re-enable when backend is stable */}
            </div>
          ))}
        </div>
      )}

      {modal && (
        <DestinationFormModal
          key={modal.mode === 'edit' ? modal.dest.id : 'add'}
          mode={modal.mode}
          dest={modal.dest}
          onClose={() => setModal(null)}
          onSaved={fetchDestinations}
        />
      )}
    </div>
  );
}
