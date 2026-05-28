import React, { useState, useEffect } from 'react';
import apiClient from '../utils/api';
import { Plus, Trash2, Loader2, Shuffle, Settings } from 'lucide-react';
import toast from 'react-hot-toast';

export default function DestinationManager() {
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Form states
  const [name, setName] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [dailyCap, setDailyCap] = useState("0");

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
      toast.error("Name and Target Webhook URL are required");
      return;
    }

    try {
      setSubmitting(true);
      const res = await apiClient.post('/api/destinations', {
        name,
        target_url: targetUrl,
        daily_cap: parseInt(dailyCap, 10) || 0
      });

      if (res.data && res.data.success) {
        toast.success("Destination created successfully");
        setName("");
        setTargetUrl("");
        setDailyCap("0");
        fetchDestinations();
      }
    } catch (err) {
      console.error('Failed to create destination:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this destination?")) return;

    try {
      setDeletingId(id);
      const res = await apiClient.delete(`/api/destinations/${id}`);
      if (res.data && res.data.success) {
        toast.success("Destination deleted successfully");
        fetchDestinations();
      }
    } catch (err) {
      console.error('Failed to delete destination:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleActive = async (destination) => {
    try {
      const res = await apiClient.put(`/api/destinations/${destination.id}`, {
        is_active: !destination.is_active
      });
      if (res.data && res.data.success) {
        toast.success(`Destination ${!destination.is_active ? 'enabled' : 'disabled'}`);
        fetchDestinations();
      }
    } catch (err) {
      console.error('Failed to toggle destination status:', err);
    }
  };

  return (
    <div className="space-y-6 w-full max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-xl font-extrabold text-slate-100 flex items-center gap-2">
          <Shuffle className="h-6 w-6 text-emerald-400" />
          Destination Manager
        </h2>
        <p className="text-xs text-slate-400 mt-1 leading-normal">
          Configure external HTTP endpoints to route incoming webhook data. Define daily lead caps to throttle ingestion.
        </p>
      </div>

      {/* Top Section - Create Form */}
      <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 backdrop-blur-xl p-6 shadow-xl">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4 flex items-center gap-2">
          <Plus className="h-4 w-4 text-emerald-400" />
          Add New Routing Endpoint
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5 font-mono">
                Destination Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Buyer A CRM, Core Leads, Staging Webhook"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-xs text-slate-200 outline-none transition focus:border-emerald-500/40 placeholder:text-slate-600"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5 font-mono">
                Target Webhook URL
              </label>
              <input
                type="url"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="https://your-destination.com/webhook"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 font-mono text-xs text-slate-200 outline-none transition focus:border-emerald-500/40 placeholder:text-slate-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5 font-mono">
                Daily Lead Cap (0 for Unlimited)
              </label>
              <input
                type="number"
                min="0"
                value={dailyCap}
                onChange={(e) => setDailyCap(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-xs text-slate-200 outline-none transition focus:border-emerald-500/40 placeholder:text-slate-600"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !name || !targetUrl}
              className="flex items-center justify-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 py-2.5 text-xs font-bold text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed h-10 w-full"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin animate-infinite" />
                  Creating Endpoint...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Add Destination
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Bottom Section - Table */}
      <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 backdrop-blur-xl p-6 shadow-xl">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4 flex items-center gap-2">
          <Settings className="h-4 w-4 text-emerald-400" />
          Active Destinations
        </h3>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
            <p className="text-xs">Loading routing destinations...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="pb-3 font-semibold px-2">Status</th>
                  <th className="pb-3 font-semibold px-2">Name</th>
                  <th className="pb-3 font-semibold px-2">Target Webhook URL</th>
                  <th className="pb-3 font-semibold px-2">Daily Cap</th>
                  <th className="pb-3 font-semibold text-right px-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {destinations.map((dest) => (
                  <tr key={dest.id} className="transition-colors hover:bg-slate-800/20">
                    <td className="py-3 px-2">
                      <button
                        onClick={() => handleToggleActive(dest)}
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold transition-all ${
                          dest.is_active
                            ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                            : 'bg-slate-800 text-slate-500 hover:bg-slate-700'
                        }`}
                      >
                        {dest.is_active ? 'Active' : 'Disabled'}
                      </button>
                    </td>
                    <td className="py-3 px-2 font-semibold text-slate-100">{dest.name}</td>
                    <td className="py-3 px-2 font-mono text-[11px] text-slate-400 max-w-[250px] truncate" title={dest.target_url}>
                      {dest.target_url}
                    </td>
                    <td className="py-3 px-2">
                      {dest.daily_cap === 0 ? (
                        <span className="text-slate-500 italic">Unlimited</span>
                      ) : (
                        <span className="text-amber-400/90 font-semibold">{dest.daily_cap} leads</span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-right">
                      <button
                        onClick={() => handleDelete(dest.id)}
                        disabled={deletingId === dest.id}
                        className="rounded bg-rose-500/10 p-1.5 text-rose-400 transition-colors hover:bg-rose-500/20 disabled:opacity-50"
                        title="Delete Destination"
                      >
                        {deletingId === dest.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
                {destinations.length === 0 && (
                  <tr>
                    <td colSpan="5" className="py-12 text-center text-slate-500 italic">
                      No routing destinations configured. Create your first endpoint above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
