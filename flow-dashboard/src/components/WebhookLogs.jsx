import { useState, useEffect } from "react";
import { Activity, X, FileJson, Loader2, AlertCircle, Lock } from "lucide-react";
import apiClient from "../utils/api";

export default function WebhookLogs({ tier, setUpgradeModal }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activePayload, setActivePayload] = useState(null);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const res = await apiClient.get("/api/webhooks/logs");
        if (res.data && res.data.success) {
          setLogs(res.data.data || []);
        } else {
          setError(res.data?.message || "Failed to fetch logs");
        }
      } catch (err) {
        setError(err.response?.data?.message || err.response?.data?.error || "Network error fetching logs");
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

  const getStatusBadge = (status) => {
    if (status >= 200 && status < 300) {
      return <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">{status} OK</span>;
    }
    if (status >= 400 && status < 500) {
      return <span className="rounded bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-400 border border-amber-500/20">{status} ERR</span>;
    }
    if (status >= 500) {
      return <span className="rounded bg-rose-500/10 px-2 py-0.5 text-xs font-semibold text-rose-400 border border-rose-500/20">{status} ERR</span>;
    }
    return <span className="rounded bg-slate-500/10 px-2 py-0.5 text-xs font-semibold text-slate-400 border border-slate-500/20">{status}</span>;
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between mb-4 border-b border-slate-800/40 pb-3">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-cyan-400" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-100">Webhook Traffic Analytics</h2>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-surface-raised overflow-hidden">
        {loading ? (
          <div className="p-8 flex flex-col items-center justify-center space-y-4 animate-pulse">
            <Loader2 className="h-8 w-8 text-cyan-500 animate-spin opacity-50" />
            <div className="h-4 w-48 bg-slate-800 rounded"></div>
            <div className="h-4 w-64 bg-slate-800 rounded"></div>
            <div className="h-4 w-56 bg-slate-800 rounded"></div>
          </div>
        ) : error ? (
          <div className="p-8 flex flex-col items-center justify-center text-rose-400 gap-3">
            <AlertCircle className="h-8 w-8 opacity-80" />
            <p className="text-sm font-semibold">{error}</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No webhook logs found. Send some traffic to see it appear here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-400">
              <thead className="bg-slate-900/50 text-xs uppercase text-slate-500 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4 font-semibold tracking-wider">Date/Time</th>
                  <th className="px-6 py-4 font-semibold tracking-wider">Method</th>
                  <th className="px-6 py-4 font-semibold tracking-wider">Status</th>
                  <th className="px-6 py-4 font-semibold tracking-wider text-right">Payload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-surface">
                {logs.map((log) => (
                  <tr key={log.id} className="transition-colors hover:bg-slate-800/30">
                    <td className="whitespace-nowrap px-6 py-4 font-mono text-[11px] text-slate-300">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs font-semibold text-slate-300">
                      {log.method || 'POST'}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(log.status_code)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {tier === 'enterprise' ? (
                        <button
                          onClick={() => setActivePayload(log)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-[11px] font-semibold text-cyan-400 hover:bg-slate-700 hover:text-cyan-300 transition-colors shadow-sm"
                        >
                          <FileJson className="h-3.5 w-3.5" />
                          View JSON
                        </button>
                      ) : (
                        <button
                          onClick={() => setUpgradeModal({ isOpen: true, feature: 'Raw JSON Inspection', tier: 'Plus' })}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-1.5 text-[11px] font-semibold text-slate-500 hover:bg-slate-800 hover:text-slate-400 transition-colors shadow-sm"
                        >
                          <Lock className="h-3 w-3" />
                          View JSON
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payload JSON Modal */}
      {activePayload && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-fade-in" onClick={() => setActivePayload(null)}>
          <div 
            className="relative w-full max-w-2xl rounded-2xl border border-slate-700/60 bg-surface-raised p-6 shadow-2xl shadow-black/80 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <FileJson className="h-5 w-5 text-cyan-400" />
                  Payload Details
                </h3>
                <p className="font-mono text-[10px] text-slate-500 mt-1">
                  Log ID: {activePayload.id}
                </p>
              </div>
              <button
                onClick={() => setActivePayload(null)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-850 hover:text-slate-350 transition-colors duration-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="overflow-y-auto flex-1 rounded border border-slate-700/50 bg-slate-900 p-4 custom-scrollbar">
              {activePayload.request_payload ? (
                <pre className="font-mono text-[11px] leading-relaxed text-emerald-300">
                  {JSON.stringify(activePayload.request_payload, null, 2)}
                </pre>
              ) : (
                <div className="space-y-3">
                  <p className="text-[11px] font-semibold text-amber-400">
                    No request payload was captured for this log entry.
                  </p>
                  <pre className="font-mono text-[11px] leading-relaxed text-slate-400">
                    {JSON.stringify({
                      method: activePayload.method,
                      status_code: activePayload.status_code,
                      destination_id: activePayload.destination_id,
                      webhook_id: activePayload.webhook_id,
                      is_test: activePayload.is_test,
                      created_at: activePayload.created_at,
                    }, null, 2)}
                  </pre>
                </div>
              )}
              {activePayload.response_error && (
                <div className="mt-4 border-t border-rose-500/20 pt-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-rose-500 mb-2">Error Trace</div>
                  <pre className="font-mono text-[11px] leading-relaxed text-rose-400">
                    {activePayload.response_error}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
