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
  round_robin: { label: 'Round Robin', className: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
  broadcast: { label: 'Broadcast', className: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
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
          <h2 className="text-xl font-extrabold text-slate-100 flex items-center gap-2">
            <Workflow className="h-6 w-6 text-cyan-400" />
            Flows
          </h2>
          <p className="text-xs text-slate-400 mt-1 leading-normal">
            Group a subset of your destinations into a named pipeline with its own routing strategy.
            Assign a flow to an API key to control exactly where its leads go.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="shrink-0 flex items-center gap-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 px-4 py-2.5 text-xs font-bold text-cyan-400 hover:bg-cyan-500/20 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Flow
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
          <p className="text-xs">Loading flows...</p>
        </div>
      ) : flows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700/60 bg-slate-900/40 p-12 flex flex-col items-center justify-center text-center">
          <div className="h-14 w-14 rounded-2xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-center mb-4">
            <Workflow className="h-6 w-6 text-slate-400" />
          </div>
          <h3 className="text-base font-bold text-slate-200 mb-1">Create your first flow</h3>
          <p className="text-xs text-slate-400 max-w-sm mb-6 leading-relaxed">
            Flows let you route leads from a specific API key to a chosen set of destinations instead of all of them.
          </p>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 px-5 py-2.5 text-sm font-semibold text-cyan-400 hover:bg-cyan-500/20 transition-colors"
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
                className="rounded-2xl border border-slate-800/60 bg-slate-900/40 backdrop-blur-xl p-5 shadow-xl transition-colors hover:border-slate-700/80"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="text-sm font-bold text-slate-100 truncate">{flow.name}</h3>
                      <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>

                    {/* Destination pills */}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {dests.length === 0 ? (
                        <span className="text-[11px] text-slate-500 italic">No destinations</span>
                      ) : (
                        dests.map((d) => (
                          <span
                            key={d.id}
                            className="inline-flex items-center rounded-md bg-slate-800/70 border border-slate-700/50 px-2 py-0.5 text-[10px] font-medium text-slate-300"
                            title={d.target_url}
                          >
                            {d.name}
                          </span>
                        ))
                      )}
                    </div>

                    <p className="mt-3 text-[11px] text-slate-500">
                      {keyCount} key{keyCount === 1 ? '' : 's'} assigned
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => openEdit(flow)}
                      className="rounded bg-slate-800/70 p-2 text-slate-300 transition-colors hover:bg-slate-700 hover:text-white border border-slate-700/50"
                      title="Edit flow"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(flow.id)}
                      disabled={deletingId === flow.id}
                      className="rounded bg-rose-500/10 p-2 text-rose-400 transition-colors hover:bg-rose-500/20 border border-rose-500/20 disabled:opacity-50"
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
            className="relative z-10 w-full max-w-lg animate-modal-in overflow-hidden rounded-2xl border border-slate-700/60 bg-surface-raised shadow-2xl shadow-black/40"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-800/60 p-6 pb-4">
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-cyan-400">
                  {isEditMode ? 'Edit Flow' : 'New Flow'}
                </p>
                <h3 className="text-lg font-bold text-slate-100">
                  {isEditMode ? name || 'Untitled Flow' : 'Build a routing flow'}
                </h3>
              </div>
              <button
                onClick={closeBuilder}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit}>
              <div className="max-h-[60vh] overflow-y-auto p-6 space-y-5">
                {/* Flow name */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5 font-mono">
                    Flow Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. GHL → n8n + KCB Bank"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-xs text-slate-200 outline-none transition focus:border-cyan-500/40 placeholder:text-slate-600"
                  />
                </div>

                {/* Routing strategy */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5 font-mono">
                    Routing Strategy
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setStrategy('round_robin')}
                      className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-xs font-semibold transition-colors ${
                        strategy === 'round_robin'
                          ? 'border-indigo-500/40 bg-indigo-500/15 text-indigo-300'
                          : 'border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      <Shuffle className="h-3.5 w-3.5" /> Round Robin
                    </button>
                    <button
                      type="button"
                      onClick={() => setStrategy('broadcast')}
                      className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-xs font-semibold transition-colors ${
                        strategy === 'broadcast'
                          ? 'border-cyan-500/40 bg-cyan-500/15 text-cyan-300'
                          : 'border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      <Radio className="h-3.5 w-3.5" /> Broadcast
                    </button>
                  </div>
                  <p className="mt-1.5 text-[10px] text-slate-500 leading-relaxed">
                    {strategy === 'round_robin'
                      ? 'Round Robin delivers each lead to the first available destination under its cap.'
                      : 'Broadcast delivers each lead to every destination under its cap.'}
                  </p>
                </div>

                {/* Destinations */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5 font-mono">
                    Destinations {isEditMode && <span className="text-slate-600 normal-case">(saved instantly)</span>}
                  </label>
                  {destinations.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-700/60 bg-slate-950/50 p-4 text-center text-[11px] text-slate-500 italic">
                      No destinations yet. Create destinations first, then add them to this flow.
                    </div>
                  ) : (
                    <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/40 p-2 max-h-52 overflow-y-auto">
                      {destinations.map((dest) => {
                        const checked = selectedIds.includes(dest.id);
                        const isToggling = togglingId === dest.id;
                        return (
                          <button
                            type="button"
                            key={dest.id}
                            onClick={() => !isToggling && toggleDestination(dest.id)}
                            disabled={isToggling}
                            className="w-full flex items-center gap-3 rounded-lg border border-slate-800/60 bg-slate-900/50 px-3 py-2.5 text-left transition-colors hover:border-slate-700 disabled:opacity-60"
                          >
                            <span
                              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                                checked
                                  ? 'border-cyan-500/50 bg-cyan-500/20 text-cyan-300'
                                  : 'border-slate-600 bg-slate-950'
                              }`}
                            >
                              {isToggling ? (
                                <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
                              ) : checked ? (
                                <Check className="h-3 w-3" />
                              ) : null}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-xs font-semibold text-slate-200 truncate">{dest.name}</span>
                              <span className="block font-mono text-[10px] text-slate-500 truncate" title={dest.target_url}>
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
              <div className="border-t border-slate-800/60 px-6 py-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeBuilder}
                  disabled={submitting}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-semibold text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !name.trim()}
                  className="flex items-center justify-center gap-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 px-5 py-2.5 text-xs font-bold text-cyan-400 hover:bg-cyan-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
