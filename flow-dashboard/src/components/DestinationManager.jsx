import { useState, useEffect } from 'react';
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

  const labelCls = "text-xs font-medium uppercase tracking-wider text-zinc-500 block mb-1.5";
  const inputCls = "w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-indigo-500 placeholder:text-zinc-600";

  return (
    <div className="space-y-6 w-full max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-medium tracking-tight text-zinc-50 flex items-center gap-2">
          <Shuffle className="h-6 w-6 text-indigo-400" />
          Destinations
        </h2>
        <p className="text-sm text-zinc-400 mt-1 leading-relaxed">
          Configure where leads are delivered. Define daily caps per destination to throttle volume.
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
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Buyer A CRM, Core Leads"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Target URL</label>
              <input
                type="url"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="https://your-destination.com/webhook"
                className={`${inputCls} font-mono`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div>
              <label className={labelCls}>Daily lead cap (0 = unlimited)</label>
              <input
                type="number"
                min="0"
                value={dailyCap}
                onChange={(e) => setDailyCap(e.target.value)}
                className={inputCls}
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !name || !targetUrl}
              className="flex items-center justify-center gap-2 rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed h-9 w-full"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Add destination
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
        <h3 className="text-lg font-medium text-zinc-100 mb-4 flex items-center gap-2">
          <Settings className="h-4 w-4 text-indigo-400" />
          Active destinations
        </h3>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-zinc-500">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
            <p className="text-xs">Loading destinations...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500">
                  <th className="pb-3 font-medium text-xs uppercase tracking-wider px-2">Status</th>
                  <th className="pb-3 font-medium text-xs uppercase tracking-wider px-2">Name</th>
                  <th className="pb-3 font-medium text-xs uppercase tracking-wider px-2">Target URL</th>
                  <th className="pb-3 font-medium text-xs uppercase tracking-wider px-2">Daily cap</th>
                  <th className="pb-3 font-medium text-xs uppercase tracking-wider text-right px-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 text-zinc-300">
                {destinations.map((dest) => (
                  <tr key={dest.id} className="transition-colors hover:bg-zinc-800/40">
                    <td className="py-3 px-2">
                      <button
                        onClick={() => handleToggleActive(dest)}
                        className={`rounded-md px-2 py-0.5 text-xs font-medium transition-colors duration-150 ${
                          dest.is_active
                            ? 'bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20'
                            : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'
                        }`}
                      >
                        {dest.is_active ? 'Active' : 'Disabled'}
                      </button>
                    </td>
                    <td className="py-3 px-2 font-medium text-zinc-100">{dest.name}</td>
                    <td className="py-3 px-2 font-mono text-xs text-zinc-400 max-w-[250px] truncate" title={dest.target_url}>
                      {dest.target_url}
                    </td>
                    <td className="py-3 px-2">
                      {dest.daily_cap === 0 ? (
                        <span className="text-zinc-500 italic">Unlimited</span>
                      ) : (
                        <span className="font-mono text-zinc-300">{dest.daily_cap} leads</span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-right">
                      <button
                        onClick={() => handleDelete(dest.id)}
                        disabled={deletingId === dest.id}
                        className="rounded-md p-1.5 text-rose-400 transition-colors duration-150 hover:bg-rose-500/10 disabled:opacity-50"
                        title="Delete destination"
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
                    <td colSpan="5" className="py-12">
                      <div className="flex flex-col items-center justify-center text-center">
                        <Shuffle className="h-8 w-8 text-zinc-700 mb-3" />
                        <h4 className="text-sm font-medium text-zinc-300 mb-1">No destinations yet</h4>
                        <p className="text-xs text-zinc-500">Add your first routing destination above.</p>
                      </div>
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
