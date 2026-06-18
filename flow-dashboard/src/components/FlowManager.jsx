import { useState, useEffect } from 'react';
import apiClient from '../utils/api';
import {
  Workflow,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  X,
  Check,
  Shuffle,
  Radio,
} from 'lucide-react';
import toast from 'react-hot-toast';

/* ═══════════════════════════════════════════════════════════════════════════
   Routing strategy presentation helpers
   ═══════════════════════════════════════════════════════════════════════════ */
const STRATEGY_BADGE = {
  round_robin: { label: 'Round Robin', className: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20' },
  broadcast: { label: 'Broadcast', className: 'bg-zinc-800 text-zinc-300 border-zinc-700' },
};

export default function FlowManager() {
  const [flows, setFlows] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  // Builder (create/edit) state
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingFlow, setEditingFlow] = useState(null); // null => create mode
  const [name, setName] = useState('');
  const [strategy, setStrategy] = useState('round_robin');
  const [selectedIds, setSelectedIds] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  const isEditMode = !!editingFlow;

  /* ── Data fetching ──────────────────────────────────────────────────── */
  const fetchFlows = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/api/flows');
      if (res.data && res.data.success) {
        setFlows(res.data.flows || []);
      }
    } catch (err) {
      console.error('Failed to fetch flows:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDestinations = async () => {
    try {
      const res = await apiClient.get('/api/destinations');
      if (res.data && res.data.success) {
        setDestinations(res.data.destinations || []);
      }
    } catch (err) {
      console.error('Failed to fetch destinations:', err);
    }
  };

  useEffect(() => {
    fetchFlows();
    fetchDestinations();
  }, []);

  /* ── Builder open/close ─────────────────────────────────────────────── */
  const openCreate = () => {
    setEditingFlow(null);
    setName('');
    setStrategy('round_robin');
    setSelectedIds([]);
    setBuilderOpen(true);
  };

  const openEdit = (flow) => {
    setEditingFlow(flow);
    setName(flow.name || '');
    setStrategy(flow.routing_strategy || 'round_robin');
    setSelectedIds((flow.destinations || []).map((d) => d.id));
    setBuilderOpen(true);
  };

  const closeBuilder = () => {
    if (submitting) return;
    setBuilderOpen(false);
    setEditingFlow(null);
  };

  /* ── Destination selection ──────────────────────────────────────────── */
  // In create mode we just collect the ids; in edit mode we persist each
  // add/remove immediately (optimistic, with rollback on failure).
  const toggleDestination = async (destId) => {
    const isSelected = selectedIds.includes(destId);

    if (!isEditMode) {
      setSelectedIds((prev) =>
        isSelected ? prev.filter((x) => x !== destId) : [...prev, destId]
      );
      return;
    }

    const previous = selectedIds;
    const next = isSelected
      ? selectedIds.filter((x) => x !== destId)
      : [...selectedIds, destId];

    // Optimistic update
    setSelectedIds(next);
    setTogglingId(destId);
    try {
      if (isSelected) {
        await apiClient.delete(`/api/flows/${editingFlow.id}/destinations/${destId}`);
        toast.success('Destination removed from flow');
      } else {
        await apiClient.post(`/api/flows/${editingFlow.id}/destinations`, {
          destination_id: destId,
        });
        toast.success('Destination added to flow');
      }
      fetchFlows();
    } catch (err) {
      console.error('Failed to update flow destination:', err);
      setSelectedIds(previous); // rollback
    } finally {
      setTogglingId(null);
    }
  };

  /* ── Submit (create or save) ────────────────────────────────────────── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Flow name is required');
      return;
    }

    try {
      setSubmitting(true);
      if (isEditMode) {
        const res = await apiClient.put(`/api/flows/${editingFlow.id}`, {
          name: name.trim(),
          routing_strategy: strategy,
        });
        if (res.data && res.data.success) {
          toast.success('Flow updated successfully');
          setBuilderOpen(false);
          setEditingFlow(null);
          fetchFlows();
        }
      } else {
        const res = await apiClient.post('/api/flows', {
          name: name.trim(),
          routing_strategy: strategy,
          destination_ids: selectedIds,
        });
        if (res.data && res.data.success) {
          toast.success('Flow created successfully');
          setBuilderOpen(false);
          fetchFlows();
        }
      }
    } catch (err) {
      console.error('Failed to save flow:', err);
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Delete ─────────────────────────────────────────────────────────── */
  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this flow? API keys assigned to it will fall back to all destinations.')) {
      return;
    }
    try {
      setDeletingId(id);
      const res = await apiClient.delete(`/api/flows/${id}`);
      if (res.data && res.data.success) {
        toast.success('Flow deleted successfully');
        fetchFlows();
      }
    } catch (err) {
      console.error('Failed to delete flow:', err);
    } finally {
      setDeletingId(null);
    }
  };

  /* ═══════════════════════════════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-6 w-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-medium tracking-tight text-zinc-50 flex items-center gap-2">
            <Workflow className="h-6 w-6 text-indigo-400" />
            Flows
          </h2>
          <p className="text-sm text-zinc-400 mt-1 leading-relaxed">
            Group a subset of your destinations into a named pipeline with its own routing strategy.
            Assign a flow to an API key to control exactly where its leads go.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="shrink-0 flex items-center gap-2 rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 transition-colors duration-150"
        >
          <Plus className="h-4 w-4" />
          New Flow
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-3 text-zinc-500">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
          <p className="text-xs">Loading flows...</p>
        </div>
      ) : flows.length === 0 ? (
        <div className="py-12 flex flex-col items-center justify-center text-center">
          <Workflow className="h-8 w-8 text-zinc-700 mb-3" />
          <h3 className="text-sm font-medium text-zinc-300 mb-1">Create your first flow</h3>
          <p className="text-xs text-zinc-500 max-w-sm mb-6 leading-relaxed">
            Flows let you route leads from a specific API key to a chosen set of destinations instead of all of them.
          </p>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-md bg-zinc-800 border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700 transition-colors duration-150"
          >
            <Plus className="h-4 w-4" /> New Flow
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {flows.map((flow) => {
            const badge = STRATEGY_BADGE[flow.routing_strategy] || STRATEGY_BADGE.round_robin;
            const dests = flow.destinations || [];
            const keyCount = flow.api_key_count ?? 0;
            return (
              <div
                key={flow.id}
                className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 transition-colors duration-150 hover:border-zinc-700"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="text-base font-medium text-zinc-50 truncate">{flow.name}</h3>
                      <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>

                    {/* Destination pills */}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {dests.length === 0 ? (
                        <span className="text-xs text-zinc-500 italic">No destinations</span>
                      ) : (
                        dests.map((d) => (
                          <span
                            key={d.id}
                            className="inline-flex items-center rounded-md bg-zinc-800 border border-zinc-700 px-2 py-0.5 text-xs font-medium text-zinc-300"
                            title={d.target_url}
                          >
                            {d.name}
                          </span>
                        ))
                      )}
                    </div>

                    <p className="mt-3 text-xs text-zinc-500">
                      {keyCount} key{keyCount === 1 ? '' : 's'} assigned
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => openEdit(flow)}
                      className="rounded-md bg-zinc-800 p-2 text-zinc-300 transition-colors duration-150 hover:bg-zinc-700 hover:text-zinc-100 border border-zinc-700"
                      title="Edit flow"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(flow.id)}
                      disabled={deletingId === flow.id}
                      className="rounded-md p-2 text-rose-400 transition-colors duration-150 hover:bg-rose-500/10 disabled:opacity-50"
                      title="Delete flow"
                    >
                      {deletingId === flow.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Builder Modal */}
      {builderOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={closeBuilder}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" />
          <div
            className="relative z-10 w-full max-w-lg animate-modal-in overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-zinc-800 p-6 pb-4">
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-widest text-indigo-300">
                  {isEditMode ? 'Edit Flow' : 'New Flow'}
                </p>
                <h3 className="text-lg font-medium text-zinc-50">
                  {isEditMode ? name || 'Untitled Flow' : 'Build a routing flow'}
                </h3>
              </div>
              <button
                onClick={closeBuilder}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit}>
              <div className="max-h-[60vh] overflow-y-auto p-6 space-y-5">
                {/* Flow name */}
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-zinc-500 block mb-1.5">
                    Flow Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. GHL → n8n + KCB Bank"
                    className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-indigo-500 placeholder:text-zinc-600"
                  />
                </div>

                {/* Routing strategy */}
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-zinc-500 block mb-1.5">
                    Routing Strategy
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setStrategy('round_robin')}
                      className={`flex items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors duration-150 ${
                        strategy === 'round_robin'
                          ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                          : 'border-zinc-700 bg-zinc-950 text-zinc-400 hover:border-zinc-600'
                      }`}
                    >
                      <Shuffle className="h-3.5 w-3.5" /> Round Robin
                    </button>
                    <button
                      type="button"
                      onClick={() => setStrategy('broadcast')}
                      className={`flex items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors duration-150 ${
                        strategy === 'broadcast'
                          ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                          : 'border-zinc-700 bg-zinc-950 text-zinc-400 hover:border-zinc-600'
                      }`}
                    >
                      <Radio className="h-3.5 w-3.5" /> Broadcast
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs text-zinc-500 leading-relaxed">
                    {strategy === 'round_robin'
                      ? 'Round Robin delivers each lead to the first available destination under its cap.'
                      : 'Broadcast delivers each lead to every destination under its cap.'}
                  </p>
                </div>

                {/* Destinations */}
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-zinc-500 block mb-1.5">
                    Destinations {isEditMode && <span className="text-zinc-600 normal-case">(saved instantly)</span>}
                  </label>
                  {destinations.length === 0 ? (
                    <div className="rounded-md border border-dashed border-zinc-700 bg-zinc-950 p-4 text-center text-xs text-zinc-500 italic">
                      No destinations yet. Create destinations first, then add them to this flow.
                    </div>
                  ) : (
                    <div className="space-y-2 rounded-md border border-zinc-800 bg-zinc-950 p-2 max-h-52 overflow-y-auto">
                      {destinations.map((dest) => {
                        const checked = selectedIds.includes(dest.id);
                        const isToggling = togglingId === dest.id;
                        return (
                          <button
                            type="button"
                            key={dest.id}
                            onClick={() => !isToggling && toggleDestination(dest.id)}
                            disabled={isToggling}
                            className="w-full flex items-center gap-3 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-left transition-colors duration-150 hover:border-zinc-700 disabled:opacity-60"
                          >
                            <span
                              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                                checked
                                  ? 'border-indigo-500 bg-indigo-500 text-white'
                                  : 'border-zinc-600 bg-zinc-950'
                              }`}
                            >
                              {isToggling ? (
                                <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />
                              ) : checked ? (
                                <Check className="h-3 w-3" />
                              ) : null}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium text-zinc-200 truncate">{dest.name}</span>
                              <span className="block font-mono text-xs text-zinc-500 truncate" title={dest.target_url}>
                                {dest.target_url}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-zinc-800 px-6 py-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeBuilder}
                  disabled={submitting}
                  className="rounded-md border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 transition-colors duration-150 hover:bg-zinc-700 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !name.trim()}
                  className="flex items-center justify-center gap-2 rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {isEditMode ? 'Saving...' : 'Creating...'}
                    </>
                  ) : (
                    <>{isEditMode ? 'Save Changes' : 'Create Flow'}</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
