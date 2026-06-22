import { useState, useEffect, useRef } from 'react';
import apiClient from '../utils/api';
import { Plus, Trash2, Loader2, Shuffle, Edit2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const fmtNum = (n) => (n ?? 0).toLocaleString();

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

  // Inline cap edit
  const [editingCapId, setEditingCapId] = useState(null);
  const [updatingCapId, setUpdatingCapId] = useState(null);

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
      });
      if (res.data && res.data.success) {
        toast.success('Destination created successfully');
        setName('');
        setTargetUrl('');
        setDailyCap(0);
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
              <div>
                <label className={labelCls}>Daily lead cap (0 = unlimited)</label>
                <CapChipSelector value={dailyCap} onChange={setDailyCap} />
              </div>
              <button
                type="submit"
                disabled={submitting || !name || !targetUrl}
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

                <button
                  onClick={() => handleDelete(dest.id)}
                  disabled={deletingId === dest.id}
                  className="rounded-md p-2 text-rose-400 transition-colors duration-150 hover:bg-rose-500/10 disabled:opacity-50"
                  title="Delete destination"
                >
                  {deletingId === dest.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </button>
              </div>

              {/* lead metering disabled — re-enable when backend is stable */}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
