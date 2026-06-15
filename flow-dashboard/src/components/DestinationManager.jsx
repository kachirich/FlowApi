import { useState, useEffect } from 'react';
import apiClient from '../utils/api';
import { Plus, Trash2, Loader2, Shuffle, X, Lock, History, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const CREDIT_PACKS = [
  { id: 'starter', label: 'Starter', leads: 500, blurb: 'Best for testing', popular: false },
  { id: 'growth', label: 'Growth', leads: 2000, blurb: 'Most popular', popular: true },
  { id: 'pro', label: 'Pro', leads: 10000, blurb: 'High volume agencies', popular: false },
];

const fmtNum = (n) => (n ?? 0).toLocaleString();
const fmtDate = (s) =>
  new Date(s).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function DestinationManager({ setActiveTab }) {
  const { user } = useAuth();
  const isMeteringTier = user?.tier === 'growth' || user?.tier === 'enterprise';

  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Form
  const [name, setName] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [dailyCap, setDailyCap] = useState('0');

  // Metering
  const [balances, setBalances] = useState({}); // destId -> balance record
  const [txByDest, setTxByDest] = useState({}); // destId -> [transactions]
  const [historyOpen, setHistoryOpen] = useState({}); // destId -> bool
  const [topUp, setTopUp] = useState(null); // { dest }
  const [selectedPack, setSelectedPack] = useState(null);
  const [requesting, setRequesting] = useState(false);

  const fetchBalances = async (dests) => {
    if (!isMeteringTier || dests.length === 0) return;
    const entries = await Promise.all(
      dests.map(async (d) => {
        try {
          const r = await apiClient.get(`/api/destinations/${d.id}/balance`);
          return [d.id, r.data];
        } catch {
          return [d.id, null];
        }
      })
    );
    setBalances(Object.fromEntries(entries));
  };

  const fetchDestinations = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/api/destinations');
      if (res.data && res.data.success) {
        setDestinations(res.data.destinations);
        fetchBalances(res.data.destinations);
      }
    } catch (err) {
      console.error('Failed to fetch destinations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDestinations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refetchBalance = async (destId) => {
    try {
      const r = await apiClient.get(`/api/destinations/${destId}/balance`);
      setBalances((prev) => ({ ...prev, [destId]: r.data }));
    } catch { /* interceptor handles toast */ }
  };

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
        daily_cap: parseInt(dailyCap, 10) || 0,
      });
      if (res.data && res.data.success) {
        toast.success('Destination created successfully');
        setName('');
        setTargetUrl('');
        setDailyCap('0');
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

  const handleToggleMetering = async (dest) => {
    const current = balances[dest.id]?.is_metered;
    try {
      await apiClient.put(`/api/destinations/${dest.id}/balance/settings`, { is_metered: !current });
      toast.success(!current ? 'Lead metering enabled' : 'Lead metering disabled');
      refetchBalance(dest.id);
    } catch (err) {
      console.error('Failed to toggle metering:', err);
    }
  };

  const handleSetAction = async (dest, action) => {
    if (balances[dest.id]?.exhausted_action === action) return;
    try {
      await apiClient.put(`/api/destinations/${dest.id}/balance/settings`, { exhausted_action: action });
      toast.success('Setting saved');
      refetchBalance(dest.id);
    } catch (err) {
      console.error('Failed to save setting:', err);
    }
  };

  const toggleHistory = async (destId) => {
    const opening = !historyOpen[destId];
    setHistoryOpen((prev) => ({ ...prev, [destId]: opening }));
    if (opening && !txByDest[destId]) {
      try {
        const r = await apiClient.get(`/api/destinations/${destId}/balance/transactions?limit=10`);
        setTxByDest((prev) => ({ ...prev, [destId]: r.data.transactions || [] }));
      } catch { /* interceptor handles toast */ }
    }
  };

  const openTopUp = (dest) => {
    setTopUp({ dest });
    setSelectedPack(null);
  };

  const submitTopUp = async () => {
    if (!selectedPack || !topUp) return;
    try {
      setRequesting(true);
      const r = await apiClient.post(`/api/destinations/${topUp.dest.id}/balance/top-up-request`, {
        pack: selectedPack,
      });
      toast.success("Request received — we'll confirm within 24 hours");
      if (r.data?.booking_url) window.open(r.data.booking_url, '_blank', 'noopener,noreferrer');
      setTopUp(null);
      if (historyOpen[topUp.dest.id]) {
        const tx = await apiClient.get(`/api/destinations/${topUp.dest.id}/balance/transactions?limit=10`);
        setTxByDest((prev) => ({ ...prev, [topUp.dest.id]: tx.data.transactions || [] }));
      }
    } catch (err) {
      console.error('Top-up request failed:', err);
    } finally {
      setRequesting(false);
    }
  };

  const balanceChip = (b) => {
    if (!b) return null;
    let cls = 'bg-success/10 text-success border-success/20';
    let mark = '●';
    if (b.balance === 0) {
      cls = 'bg-error/10 text-error border-error/20';
    } else if (b.low_balance) {
      cls = 'bg-warning/10 text-warning border-warning/20';
      mark = '⚠';
    }
    return (
      <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${cls}`}>
        {mark} {fmtNum(b.balance)} credits
      </span>
    );
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
          Configure where leads are delivered. Define daily caps and prepaid lead credits per buyer.
        </p>
      </div>

      {/* Create form */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
        <h3 className="text-lg font-medium text-zinc-100 mb-4 flex items-center gap-2">
          <Plus className="h-4 w-4 text-indigo-400" />
          Add routing destination
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Destination name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. KCB Bank, Pesapal" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Target URL</label>
              <input type="url" value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} placeholder="https://your-buyer.com/webhook" className={`${inputCls} font-mono`} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div>
              <label className={labelCls}>Daily lead cap (0 = unlimited)</label>
              <input type="number" min="0" value={dailyCap} onChange={(e) => setDailyCap(e.target.value)} className={inputCls} />
            </div>
            <button
              type="submit"
              disabled={submitting || !name || !targetUrl}
              className="flex items-center justify-center gap-2 rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed h-9 w-full"
            >
              {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating...</> : <><Plus className="h-4 w-4" /> Add destination</>}
            </button>
          </div>
        </form>
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
          {destinations.map((dest) => {
            const b = balances[dest.id];
            const metered = !!b?.is_metered;
            return (
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
                      <h3 className="text-base font-medium text-zinc-50 truncate">{dest.name}</h3>
                    </div>
                    <p className="mt-1 font-mono text-xs text-zinc-500 truncate" title={dest.target_url}>{dest.target_url}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {dest.daily_cap === 0 ? 'Unlimited daily cap' : `${fmtNum(dest.daily_cap)} leads/day cap`}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(dest.id)}
                    disabled={deletingId === dest.id}
                    className="rounded-md p-2 text-rose-400 transition-colors duration-150 hover:bg-rose-500/10 disabled:opacity-50"
                    title="Delete destination"
                  >
                    {deletingId === dest.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>

                {/* Lead Metering section */}
                <div className="mt-4 border-t border-zinc-800 pt-4">
                  {!isMeteringTier ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-zinc-500">
                        <Lock className="h-3.5 w-3.5" />
                        Lead Metering — Growth plan required
                      </div>
                      <button
                        onClick={() => setActiveTab && setActiveTab('pricing')}
                        className="text-xs font-medium text-indigo-400 hover:text-indigo-300"
                      >
                        Upgrade →
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {/* Toggle switch */}
                          <button
                            role="switch"
                            aria-checked={metered}
                            onClick={() => handleToggleMetering(dest)}
                            className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-150 ${metered ? 'bg-indigo-500' : 'bg-zinc-700'}`}
                          >
                            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all duration-150 ${metered ? 'left-[18px]' : 'left-0.5'}`} />
                          </button>
                          <div>
                            <p className="text-sm font-medium text-zinc-200">Lead metering</p>
                            <p className="text-xs text-zinc-500">Track leads delivered to this buyer</p>
                          </div>
                        </div>
                        {metered && balanceChip(b)}
                      </div>

                      {metered && (
                        <div className="mt-4 space-y-4">
                          {/* When credits run out */}
                          <div>
                            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-1.5">When credits run out</p>
                            <div className="grid grid-cols-2 gap-2 max-w-xs">
                              {['pause', 'continue'].map((action) => {
                                const active = b.exhausted_action === action;
                                return (
                                  <button
                                    key={action}
                                    onClick={() => handleSetAction(dest, action)}
                                    className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors duration-150 ${
                                      active ? 'bg-zinc-800 border-indigo-500 text-zinc-50' : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                                    }`}
                                  >
                                    {action === 'pause' ? 'Pause delivery' : 'Keep delivering'}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <button
                              onClick={() => openTopUp(dest)}
                              className="flex items-center gap-1.5 rounded-md bg-zinc-800 border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-100 hover:bg-zinc-700 transition-colors duration-150"
                            >
                              <Plus className="h-3.5 w-3.5" /> Add Credits
                            </button>
                            <button onClick={() => toggleHistory(dest.id)} className="flex items-center gap-1 text-xs font-medium text-indigo-400 hover:text-indigo-300">
                              <History className="h-3.5 w-3.5" /> {historyOpen[dest.id] ? 'Hide history' : 'View history'}
                            </button>
                          </div>

                          {/* History */}
                          {historyOpen[dest.id] && (
                            <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3">
                              {!txByDest[dest.id] ? (
                                <div className="flex items-center gap-2 text-xs text-zinc-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading...</div>
                              ) : txByDest[dest.id].length === 0 ? (
                                <p className="text-xs text-zinc-500 italic">No transactions yet.</p>
                              ) : (
                                <ul className="space-y-1.5 font-mono text-xs">
                                  {txByDest[dest.id].map((tx) => {
                                    const pending = (tx.note || '').includes('PENDING');
                                    const isCredit = tx.type === 'credit';
                                    return (
                                      <li key={tx.id} className="flex items-center justify-between gap-3">
                                        <span className="text-zinc-600 shrink-0">[{fmtDate(tx.created_at)}]</span>
                                        <span className={`flex-1 ${isCredit ? 'text-success' : 'text-zinc-500'} ${pending ? 'text-warning italic' : ''}`}>
                                          {isCredit ? '✓ Credit' : '↓ Debit'}{' '}
                                          {isCredit ? '+' : '-'}{fmtNum(tx.amount)}
                                          {tx.pack_name ? ` · ${tx.pack_name} pack` : ''}
                                          {pending ? ' · PENDING' : tx.note ? ` · ${tx.note}` : ''}
                                        </span>
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Top-up modal */}
      {topUp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => !requesting && setTopUp(null)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" />
          <div className="relative z-10 w-full max-w-xl animate-modal-in overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-zinc-800 p-6 pb-4">
              <div>
                <h3 className="text-lg font-medium text-zinc-50 flex items-center gap-2"><CreditCard className="h-5 w-5 text-indigo-400" /> Add lead credits</h3>
                <p className="mt-0.5 text-sm text-zinc-500">{topUp.dest.name}</p>
              </div>
              <button onClick={() => !requesting && setTopUp(null)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="rounded-md bg-indigo-500/10 px-3 py-2.5 text-xs text-indigo-300">
                During early access, credits are processed manually. Select a pack below and we&apos;ll confirm via email within 24 hours.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {CREDIT_PACKS.map((pack) => {
                  const sel = selectedPack === pack.id;
                  return (
                    <button
                      key={pack.id}
                      onClick={() => setSelectedPack(pack.id)}
                      className={`rounded-lg border p-4 text-left transition-colors duration-150 ${
                        sel ? 'border-indigo-500 bg-indigo-500/5 text-zinc-50' : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      {pack.popular && <p className="mb-1 text-xs font-medium text-indigo-300">★ Most popular</p>}
                      <p className="text-base font-medium text-zinc-100">{pack.label}</p>
                      <p className="mt-1 font-mono text-sm text-zinc-300">{fmtNum(pack.leads)} leads</p>
                      <p className="mt-1 text-xs text-zinc-500">{pack.blurb}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-zinc-800 px-6 py-4">
              <button onClick={() => !requesting && setTopUp(null)} className="rounded-md px-4 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors">
                Cancel
              </button>
              <button
                onClick={submitTopUp}
                disabled={!selectedPack || requesting}
                className="flex items-center justify-center gap-2 rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {requesting ? <><Loader2 className="h-4 w-4 animate-spin" /> Requesting...</> : 'Request Credits'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
