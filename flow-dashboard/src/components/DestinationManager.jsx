import { useState, useEffect, useRef } from 'react';
import apiClient from '../utils/api';
import { Plus, Trash2, Loader2, Shuffle, Edit2, Pencil, X, Webhook, Plug } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { DestinationTypeBadge, TokenBadge } from './DestinationBadges';
import { apiTokenSchema } from '../utils/validators';

const fmtNum = (n) => (n ?? 0).toLocaleString();

/**
 * Per-type presentation + guidance. Drives the type-selector buttons, the URL
 * placeholder, and the doc help-link under the token field.
 */
const DEST_TYPE_META = {
  webhook: {
    label: 'Webhook',
    Icon: Webhook,
    urlPlaceholder: 'https://your-buyer.com/webhook',
  },
  rest_api: {
    label: 'REST API',
    Icon: Plug,
    urlPlaceholder: 'https://your-api.example.com/endpoint',
    helpText: 'Any REST endpoint that accepts a Bearer token.',
  },
};

const DEST_TYPE_ORDER = ['webhook', 'rest_api'];

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

export default function DestinationManager({ setActiveTab }) {
  const { user } = useAuth();

  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Collapsible add form
  const [addFormOpen, setAddFormOpen] = useState(false);

  // Form
  const [name, setName] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [dailyCap, setDailyCap] = useState(0);
  const [destinationType, setDestinationType] = useState('webhook');
  const [apiToken, setApiToken] = useState('');
  const [tokenError, setTokenError] = useState('');

  // Inline cap edit
  const [editingCapId, setEditingCapId] = useState(null);
  const [updatingCapId, setUpdatingCapId] = useState(null);

  // Inline edit modal (rename / change type / rotate token)
  const [editingDest, setEditingDest] = useState(null);
  const [editName, setEditName] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editType, setEditType] = useState('webhook');
  const [editToken, setEditToken] = useState('');
  const [editTokenError, setEditTokenError] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Real-time token validation for the create form (mirrors webhookDestinationSchema usage)
  useEffect(() => {
    if (destinationType === 'webhook' || !apiToken) {
      setTokenError('');
      return;
    }
    const result = apiTokenSchema.safeParse(apiToken);
    setTokenError(result.success ? '' : result.error.issues[0].message);
  }, [apiToken, destinationType]);

  // Real-time token validation for the edit modal
  useEffect(() => {
    if (editType === 'webhook' || !editToken) {
      setEditTokenError('');
      return;
    }
    const result = apiTokenSchema.safeParse(editToken);
    setEditTokenError(result.success ? '' : result.error.issues[0].message);
  }, [editToken, editType]);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !targetUrl.trim()) {
      toast.error('Name and Target URL are required');
      return;
    }
    try {
      setSubmitting(true);
      const res = await apiClient.post('/api/destinations', {
        name,
        target_url: targetUrl,
        daily_cap: dailyCap,
        destination_type: destinationType,
        ...(destinationType !== 'webhook' && apiToken ? { api_token: apiToken } : {}),
      });
      if (res.data && res.data.success) {
        toast.success('Destination created successfully');
        setName('');
        setTargetUrl('');
        setDailyCap(0);
        setDestinationType('webhook');
        setApiToken('');
        fetchDestinations();
      }
    } catch (err) {
      console.error('Failed to create destination:', err);
    } finally {
      setSubmitting(false);
    }
  };

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
      setUpdatingCapId(destId);
      const res = await apiClient.put(`/api/destinations/${destId}`, { daily_cap: newCap });
      if (res.data && res.data.success) {
        toast.success('Daily cap updated');
        setEditingCapId(null);
        fetchDestinations();
      }
    } catch (err) {
      console.error('Failed to update daily cap:', err);
    } finally {
      setUpdatingCapId(null);
    }
  };

  const openEdit = (dest) => {
    setEditingDest(dest);
    setEditName(dest.name || '');
    setEditUrl(dest.target_url || '');
    setEditType(dest.destination_type || 'webhook');
    setEditToken('');
    setEditTokenError('');
  };

  const closeEdit = () => {
    if (editSubmitting) return;
    setEditingDest(null);
  };

  // Require a token only when switching a token type on with no existing credential.
  const editTokenRequired =
    !!editingDest && editType !== 'webhook' && !editToken.trim() && !editingDest.has_token;

  const editHasChanges =
    !!editingDest &&
    (editName.trim() !== (editingDest.name || '') ||
      editUrl.trim() !== (editingDest.target_url || '') ||
      editType !== (editingDest.destination_type || 'webhook') ||
      !!editToken.trim());

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingDest) return;
    if (!editName.trim() || !editUrl.trim()) {
      toast.error('Name and Target URL are required');
      return;
    }
    if (editType !== 'webhook' && editToken.trim()) {
      const result = apiTokenSchema.safeParse(editToken);
      if (!result.success) {
        setEditTokenError(result.error.issues[0].message);
        return;
      }
    }
    if (editTokenRequired) {
      setEditTokenError('A token is required for this destination type');
      return;
    }

    // Send only changed fields. Backend rules: token typed → rotate;
    // type → webhook → clear token; blank → unchanged.
    const payload = {};
    if (editName.trim() !== (editingDest.name || '')) payload.name = editName.trim();
    if (editUrl.trim() !== (editingDest.target_url || '')) payload.target_url = editUrl.trim();
    if (editType !== (editingDest.destination_type || 'webhook')) payload.destination_type = editType;
    if (editType !== 'webhook' && editToken.trim()) payload.api_token = editToken.trim();

    if (Object.keys(payload).length === 0) {
      closeEdit();
      return;
    }

    try {
      setEditSubmitting(true);
      const res = await apiClient.put(`/api/destinations/${editingDest.id}`, payload);
      if (res.data && res.data.success) {
        toast.success('Destination updated');
        setEditingDest(null);
        fetchDestinations();
      }
    } catch (err) {
      console.error('Failed to update destination:', err);
    } finally {
      setEditSubmitting(false);
    }
  };

  const labelCls = 'text-xs font-medium uppercase tracking-wider text-zinc-500 block mb-1.5';
  const inputCls =
    'w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-indigo-500 placeholder:text-zinc-600';

  return (
    <div className="space-y-6 w-full max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-medium tracking-tight text-zinc-50 flex items-center gap-2">
          <Shuffle className="h-6 w-6 text-indigo-400" />
          Destinations
        </h2>
        <p className="text-sm text-zinc-400 mt-1 leading-relaxed">
          Configure where leads are delivered. Define daily caps per buyer.
        </p>
      </div>

      {/* Create form — collapsible */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
        <button
          type="button"
          onClick={() => setAddFormOpen((o) => !o)}
          className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-zinc-800/50 transition-colors duration-150"
        >
          <span className="text-base font-medium text-zinc-100 flex items-center gap-2">
            <Plus className="h-4 w-4 text-indigo-400" />
            Add routing destination
          </span>
          <span className={`text-zinc-500 transition-transform duration-150 ${addFormOpen ? 'rotate-180' : ''}`}>▾</span>
        </button>
        {addFormOpen && (
          <div className="px-6 pb-6 border-t border-zinc-800 pt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={labelCls}>Destination type</label>
                <div className="flex gap-2">
                  {DEST_TYPE_ORDER.map((value) => {
                    const { label, Icon } = DEST_TYPE_META[value];
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => { setDestinationType(value); setApiToken(''); }}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                          destinationType === value
                            ? 'bg-indigo-500 text-white border-indigo-400'
                            : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:border-zinc-600'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Destination name</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. KCB Bank, Pesapal" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Target URL</label>
                  <input type="url" value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} placeholder={DEST_TYPE_META[destinationType].urlPlaceholder} className={`${inputCls} font-mono`} />
                </div>
              </div>
              {destinationType !== 'webhook' && (
                <div>
                  <label className={labelCls}>API token</label>
                  <input
                    type="password"
                    value={apiToken}
                    onChange={(e) => setApiToken(e.target.value)}
                    placeholder="Paste your API token"
                    autoComplete="new-password"
                    className={`${inputCls} font-mono ${tokenError ? 'border-rose-500/60 focus:border-rose-500' : ''}`}
                  />
                  {tokenError ? (
                    <p className="mt-1 text-xs text-rose-400">{tokenError}</p>
                  ) : (
                    <p className="mt-1 text-xs text-zinc-500">Stored encrypted. Never shown again after save.</p>
                  )}
                  {DEST_TYPE_META[destinationType].helpText && (
                    <p className="mt-1 text-xs text-zinc-500">{DEST_TYPE_META[destinationType].helpText}</p>
                  )}
                </div>
              )}
              <div>
                <label className={labelCls}>Daily lead cap (0 = unlimited)</label>
                <CapChipSelector value={dailyCap} onChange={setDailyCap} />
              </div>
              <button
                type="submit"
                disabled={submitting || !name || !targetUrl || (destinationType !== 'webhook' && !apiToken) || !!tokenError}
                className="flex items-center justify-center gap-2 rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto"
              >
                {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating...</> : <><Plus className="h-4 w-4" /> Add destination</>}
              </button>
            </form>
          </div>
        )}
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
          <p className="text-xs text-zinc-500">Add your first routing destination above.</p>
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
                    <DestinationTypeBadge type={dest.destination_type} />
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
                    onClick={() => openEdit(dest)}
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

      {/* Inline edit modal — rename / change type / rotate token */}
      {editingDest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={closeEdit}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" />
          <div
            className="relative z-10 w-full max-w-lg animate-modal-in overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-zinc-800 p-6 pb-4">
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-widest text-indigo-300">Edit Destination</p>
                <h3 className="text-lg font-medium text-zinc-50 truncate">{editingDest.name}</h3>
              </div>
              <button
                onClick={closeEdit}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleEditSubmit}>
              <div className="max-h-[60vh] overflow-y-auto p-6 space-y-4">
                <div>
                  <label className={labelCls}>Destination type</label>
                  <div className="flex gap-2">
                    {DEST_TYPE_ORDER.map((value) => {
                      const { label, Icon } = DEST_TYPE_META[value];
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => { setEditType(value); setEditToken(''); }}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                            editType === value
                              ? 'bg-indigo-500 text-white border-indigo-400'
                              : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:border-zinc-600'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Destination name</label>
                  <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className={inputCls} />
                </div>

                <div>
                  <label className={labelCls}>Target URL</label>
                  <input type="url" value={editUrl} onChange={(e) => setEditUrl(e.target.value)} placeholder={DEST_TYPE_META[editType].urlPlaceholder} className={`${inputCls} font-mono`} />
                </div>

                {editType !== 'webhook' && (
                  <div>
                    <label className={labelCls}>API token</label>
                    <input
                      type="password"
                      value={editToken}
                      onChange={(e) => setEditToken(e.target.value)}
                      placeholder="Leave blank to keep current token"
                      autoComplete="new-password"
                      className={`${inputCls} font-mono ${editTokenError ? 'border-rose-500/60 focus:border-rose-500' : ''}`}
                    />
                    {editTokenError ? (
                      <p className="mt-1 text-xs text-rose-400">{editTokenError}</p>
                    ) : (
                      <p className="mt-1 text-xs text-zinc-500">
                        {editingDest.has_token
                          ? 'A token is already stored. Type a new value to rotate it.'
                          : 'Stored encrypted. Never shown again after save.'}
                      </p>
                    )}
                    {DEST_TYPE_META[editType].helpText && (
                      <p className="mt-1 text-xs text-zinc-500">{DEST_TYPE_META[editType].helpText}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-zinc-800 px-6 py-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeEdit}
                  disabled={editSubmitting}
                  className="rounded-md border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 transition-colors duration-150 hover:bg-zinc-700 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting || !editName.trim() || !editUrl.trim() || editTokenRequired || !!editTokenError || !editHasChanges}
                  className="flex items-center justify-center gap-2 rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
