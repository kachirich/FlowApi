import { useState, useEffect, useMemo } from "react";
import { FlaskConical, Webhook, ChevronDown, Lock, Loader2, Send, AlertTriangle, Info, Terminal, X, Database } from "lucide-react";
import { API_BASE_URL } from "../utils/apiConfig";
import { webhookDestinationSchema, jsonKeyMappingSchema } from "../utils/validators";
import { GHL_STANDARD_SCHEMA, egressStatusHelp } from "../constants/sandboxSchema";

/**
 * Destination Sandbox — fire a test payload at a destination and inspect the
 * response, without going through lead ingestion.
 *
 * Two payload modes:
 *   - mapped: reshape GHL_STANDARD_SCHEMA via per-field key mappings (+ optional
 *     pass-through of unmapped keys).
 *   - raw:    send a free-text JSON body verbatim.
 *
 * Two delivery modes (auto-detected from the chosen destination):
 *   - token destination (destination_type !== 'webhook'): fired server-side by
 *     id so the stored encrypted token + the provider's real auth scheme
 *     (NocoDB → xc-token, generic/n8n → Bearer) are applied by the backend.
 *   - manual URL / webhook: fired to a pasted URL with no stored credential.
 *
 * The actual HTTP call + auth happen in POST /api/admin/egress-test; this
 * component only builds the request and renders the result.
 */

const SCHEMA_KEYS = Object.keys(GHL_STANDARD_SCHEMA);
const EGRESS_ENDPOINT = `${API_BASE_URL}/api/admin/egress-test`;

const inputBase =
  "w-full rounded-xl border bg-slate-900 px-4 py-3 text-xs text-slate-200 focus:outline-none transition";

export default function DestinationSandbox({ destinations = [] }) {
  // ── Target ────────────────────────────────────────────────────────────────
  const [selectedDestId, setSelectedDestId] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("https://services.leadconnectorhq.com/hooks/flow_egress_test");
  const [method, setMethod] = useState("POST");

  // ── Payload ─────────────────────────────────────────────────────────────--
  const [payloadMode, setPayloadMode] = useState("mapped"); // 'mapped' | 'raw'
  const [passThrough, setPassThrough] = useState(true);
  const [mappings, setMappings] = useState(() =>
    SCHEMA_KEYS.reduce((acc, key) => ({ ...acc, [key]: key }), {})
  );
  const [rawPayloadText, setRawPayloadText] = useState(() => JSON.stringify(GHL_STANDARD_SCHEMA, null, 2));

  // ── UI / result ─────────────────────────────────────────────────────────--
  const [schemaOpen, setSchemaOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [log, setLog] = useState(null);
  const [showRawTraceDrawer, setShowRawTraceDrawer] = useState(false);
  const [urlError, setUrlError] = useState("");
  const [mappingErrors, setMappingErrors] = useState({});
  // NocoDB column diff: null | {loading} | {error} | {missing, present}
  const [columnCheck, setColumnCheck] = useState(null);

  const selectedDest = useMemo(
    () => destinations.find((d) => String(d.id) === String(selectedDestId)) || null,
    [destinations, selectedDestId]
  );
  const isTokenBased = !!selectedDest && selectedDest.destination_type && selectedDest.destination_type !== "webhook";

  // A token destination whose stored URL is just a host (no path) was saved
  // before its records URL resolved — fired as-is it 404s ("Cannot POST /").
  const targetUrlIncomplete = useMemo(() => {
    if (!isTokenBased) return false;
    try {
      return new URL(selectedDest.target_url).pathname.replace(/\/+$/, "") === "";
    } catch {
      return false;
    }
  }, [isTokenBased, selectedDest]);

  const handleSelectDestination = (id) => {
    setSelectedDestId(id);
    setColumnCheck(null); // result is per-destination
    const dest = destinations.find((d) => String(d.id) === String(id));
    if (dest) {
      setDestinationUrl(dest.target_url || "");
      setMethod(dest.http_method || dest.method || "POST");
    }
  };

  // Read the NocoDB table's columns and diff against the current payload keys so
  // the user knows exactly which columns to add (NocoDB silently drops unknown
  // keys, and tokens can't create columns). Exact, case-sensitive match.
  const handleCheckColumns = async () => {
    if (!selectedDestId) return;
    setColumnCheck({ loading: true });
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/destination-columns`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destinationId: selectedDestId }),
      });
      const data = await res.json().catch(() => ({ success: false, message: "Invalid response from server" }));
      if (!res.ok || !data.success) {
        setColumnCheck({ error: data.message || `Error ${res.status}` });
        return;
      }
      const columns = data.columns || [];
      const colSet = new Set(columns);
      const missing = Object.keys(egressPayload).filter((k) => !colSet.has(k));
      setColumnCheck({ missing, present: columns });
    } catch (err) {
      setColumnCheck({ error: err.message || "Network error" });
    }
  };

  // ── Validation ──────────────────────────────────────────────────────────--
  // URL: skipped for token destinations (resolved + read-only server-side).
  useEffect(() => {
    if (isTokenBased || !destinationUrl) return setUrlError("");
    const result = webhookDestinationSchema.safeParse(destinationUrl);
    setUrlError(result.success ? "" : result.error.issues[0].message);
  }, [destinationUrl, isTokenBased]);

  // Mappings: required when pass-through is off; otherwise format-checked.
  useEffect(() => {
    if (payloadMode !== "mapped") return setMappingErrors({});
    const errors = {};
    for (const key of SCHEMA_KEYS) {
      const value = mappings[key]?.trim();
      if (!passThrough && !value) {
        errors[key] = "Required when pass-through is off";
      } else if (value) {
        const result = jsonKeyMappingSchema.safeParse(value);
        if (!result.success) errors[key] = result.error.issues[0].message;
      }
    }
    setMappingErrors(errors);
  }, [mappings, passThrough, payloadMode]);

  // ── Payload assembly ──────────────────────────────────────────────────────
  const { egressPayload, rawError } = useMemo(() => {
    if (payloadMode === "raw") {
      try {
        const parsed = JSON.parse(rawPayloadText);
        if (parsed === null || typeof parsed !== "object") {
          return { egressPayload: {}, rawError: "Payload must be a JSON object or array." };
        }
        return { egressPayload: parsed, rawError: "" };
      } catch (e) {
        return { egressPayload: {}, rawError: `Invalid JSON: ${e.message}` };
      }
    }
    const payload = {};
    for (const sourceKey of SCHEMA_KEYS) {
      const destKey = mappings[sourceKey]?.trim();
      if (destKey) payload[destKey] = GHL_STANDARD_SCHEMA[sourceKey];
      else if (passThrough) payload[sourceKey] = GHL_STANDARD_SCHEMA[sourceKey];
    }
    return { egressPayload: payload, rawError: "" };
  }, [payloadMode, rawPayloadText, mappings, passThrough]);

  const hasMappingErrors = Object.values(mappingErrors).some(Boolean);
  const hasMappings = Object.values(mappings).some((v) => v && v.trim() !== "");
  const payloadReady =
    payloadMode === "raw" ? !rawError : (hasMappings || passThrough) && !hasMappingErrors;
  const canFire = payloadReady && (isTokenBased ? true : !urlError && !!destinationUrl.trim());

  // ── Auto-dismiss the raw-trace drawer ──────────────────────────────────────
  useEffect(() => {
    if (!showRawTraceDrawer) return;
    const t = setTimeout(() => setShowRawTraceDrawer(false), 10000);
    return () => clearTimeout(t);
  }, [showRawTraceDrawer]);

  const rawTraceString = useMemo(() => {
    if (!log) return "";
    if (log.responseText) {
      try { return JSON.stringify(JSON.parse(log.responseText), null, 2); } catch { return log.responseText; }
    }
    return JSON.stringify({ error: log.error || "Unknown dispatch error" }, null, 2);
  }, [log]);

  // ── Fire ────────────────────────────────────────────────────────────────--
  const handleFire = async () => {
    if (!canFire) return;
    setSending(true);
    setLog(null);
    try {
      const body = isTokenBased
        ? { destinationId: selectedDestId, payload: egressPayload }
        : { destinationUrl, method, payload: egressPayload };
      const res = await fetch(EGRESS_ENDPOINT, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({ success: false, error: "Invalid response from server (possible 502)" }));
      setLog(res.ok ? data : { success: false, error: data.error || data.message || `Server error ${res.status}` });
    } catch (err) {
      setLog({ success: false, error: err.message || "Network error firing egress payload" });
    } finally {
      setSending(false);
    }
  };

  const formatRaw = () => {
    try { setRawPayloadText(JSON.stringify(JSON.parse(rawPayloadText), null, 2)); } catch { /* leave as-is */ }
  };

  return (
    <section className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-2">
        <FlaskConical className="h-4 w-4 text-amber-400" />
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Destination Sandbox &amp; Egress Tester</h2>
      </div>
      <p className="max-w-3xl text-sm leading-relaxed text-slate-400">
        Fire a test payload straight at a destination and inspect the response. Token destinations use their stored
        encrypted token and the provider's real auth scheme; runs are server-side and bypass CORS.
      </p>

      <div className="flex flex-col gap-4">
        {/* Sample schema — collapsible reference */}
        <div className="w-full overflow-hidden rounded-2xl border border-slate-800 bg-surface-raised">
          <button
            onClick={() => setSchemaOpen((p) => !p)}
            className="flex w-full items-center gap-2 border-b border-slate-800/60 bg-surface px-5 py-3 transition hover:bg-surface-overlay"
          >
            <Webhook className="h-4 w-4 text-violet-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">Standard JSON Schema</h3>
            <ChevronDown className={`ml-auto h-4 w-4 text-slate-500 transition-transform duration-300 ${schemaOpen ? "rotate-180" : ""}`} />
          </button>
          {schemaOpen && (
            <pre className="max-h-[260px] overflow-y-auto bg-slate-900/50 p-5 font-mono text-[10px] leading-relaxed text-violet-300">
              {JSON.stringify(GHL_STANDARD_SCHEMA, null, 2)}
            </pre>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* ── Left: setup ──────────────────────────────────────────────── */}
          <div className="flex flex-col space-y-5 rounded-2xl border border-slate-800 bg-surface-raised p-5 shadow-xl">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">Downstream Integration Setup</h3>

            {/* Saved destination */}
            <div className="space-y-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Saved Destination</label>
              <select value={selectedDestId} onChange={(e) => handleSelectDestination(e.target.value)} className={`${inputBase} border-slate-700 focus:border-amber-500`}>
                <option value="">-- Manual Entry --</option>
                {destinations.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            {/* Target URL */}
            <div className="space-y-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Destination URL</label>
              {isTokenBased ? (
                <>
                  <input type="text" value={selectedDest?.target_url || ""} readOnly className={`${inputBase} cursor-not-allowed border-slate-700 bg-slate-950 font-mono text-slate-400`} />
                  <p className="flex items-center gap-1.5 text-[10px] font-medium text-violet-300/90">
                    <Lock className="h-3 w-3" /> Uses the saved encrypted token + provider auth automatically.
                  </p>
                  {targetUrlIncomplete && (
                    <p className="flex items-start gap-1.5 text-[10px] font-medium text-amber-400">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                      This URL is just a host with no path — it will 404. Recreate the destination through the picker so the full records URL is stored.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <input
                    type="url"
                    value={destinationUrl}
                    onChange={(e) => setDestinationUrl(e.target.value)}
                    placeholder="https://services.leadconnectorhq.com/hooks/..."
                    className={`${inputBase} font-mono ${urlError ? "border-rose-500/50 focus:border-rose-500" : "border-slate-700 focus:border-amber-500"}`}
                  />
                  {urlError && <p className="animate-fade-in text-[10px] font-medium text-rose-500">{urlError}</p>}
                </>
              )}
            </div>

            {/* HTTP method — manual/webhook only */}
            {!isTokenBased && (
              <div className="space-y-2">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">HTTP Method</label>
                <select value={method} onChange={(e) => setMethod(e.target.value)} className={`${inputBase} border-slate-700 font-mono focus:border-amber-500`}>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="PATCH">PATCH</option>
                </select>
              </div>
            )}

            {/* Payload mode */}
            <div className="space-y-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Payload Mode</label>
              <div className="flex gap-1.5 rounded-xl border border-slate-800 bg-slate-900/50 p-1">
                {[{ id: "mapped", label: "Mapped" }, { id: "raw", label: "Raw JSON" }].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPayloadMode(m.id)}
                    className={`flex-1 rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition ${payloadMode === m.id ? "bg-amber-500 text-slate-950" : "text-slate-400 hover:text-slate-200"}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <p className="text-[9px] text-slate-500">
                {payloadMode === "raw" ? "Sends exactly what you type below — ignores the schema + mappings." : "Builds the body from the standard schema reshaped by your key mappings."}
              </p>
            </div>

            {payloadMode === "mapped" ? (
              <>
                {/* Pass-through */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Pass-Through Unmapped Keys</label>
                    <p className="text-[9px] text-slate-500">{passThrough ? "ON: Unmapped keys included as-is" : "OFF: Only mapped keys included"}</p>
                  </div>
                  <button
                    onClick={() => setPassThrough((p) => !p)}
                    className={`relative h-6 w-11 rounded-full border-2 transition-all ${passThrough ? "border-emerald-500/40 bg-emerald-500/10" : "border-slate-700/40 bg-slate-900/50"}`}
                  >
                    <div className={`absolute top-0.5 h-5 w-5 rounded-full transition-transform ${passThrough ? "translate-x-5 bg-emerald-500/80" : "translate-x-0.5 bg-slate-600/60"}`} />
                  </button>
                </div>

                {/* Key mapper */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">FlowAPI Property</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Destination JSON Key</span>
                  </div>
                  <div className="max-h-[320px] space-y-3.5 overflow-y-auto pr-2">
                    {SCHEMA_KEYS.map((sourceKey) => (
                      <div key={sourceKey} className="flex flex-col gap-1">
                        <div className="flex items-center gap-4">
                          <span className="flex-1 truncate font-mono text-xs text-slate-300">{sourceKey}</span>
                          <input
                            type="text"
                            value={mappings[sourceKey] || ""}
                            onChange={(e) => setMappings({ ...mappings, [sourceKey]: e.target.value })}
                            placeholder={passThrough ? "(optional)" : "(required)"}
                            className={`w-44 rounded-lg border bg-slate-950 px-3 py-1.5 font-mono text-xs focus:outline-none ${mappingErrors[sourceKey] ? "border-rose-500/50 text-rose-400 focus:border-rose-500" : "border-slate-800 text-amber-400 focus:border-amber-500"}`}
                          />
                        </div>
                        {mappingErrors[sourceKey] && <span className="text-right text-[10px] text-rose-500">{mappingErrors[sourceKey]}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              /* Raw JSON editor */
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Raw JSON Body</label>
                  <button type="button" onClick={formatRaw} className="text-[10px] font-medium text-slate-500 transition hover:text-slate-300">Format</button>
                </div>
                <textarea
                  value={rawPayloadText}
                  onChange={(e) => setRawPayloadText(e.target.value)}
                  spellCheck={false}
                  rows={14}
                  placeholder='{ "Title": "Acme Corporation", "email": "ceo@acmecorp.com" }'
                  className={`w-full resize-y rounded-xl border bg-slate-950 px-4 py-3 font-mono text-xs leading-relaxed focus:outline-none transition ${rawError ? "border-rose-500/50 text-rose-300 focus:border-rose-500" : "border-slate-800 text-emerald-300 focus:border-amber-500"}`}
                />
                {rawError
                  ? <p className="animate-fade-in text-[10px] font-medium text-rose-500">{rawError}</p>
                  : <p className="text-[9px] text-slate-500">Valid JSON object or array. Sent exactly as written.</p>}
              </div>
            )}

            {/* NocoDB column diff — NocoDB silently drops keys with no matching
                column, and tokens can't create columns, so surface the gap. */}
            {selectedDest?.provider === "nocodb" && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleCheckColumns}
                  disabled={columnCheck?.loading}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-[11px] font-semibold text-slate-200 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {columnCheck?.loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Database className="h-3.5 w-3.5" />}
                  Check columns
                </button>
                {columnCheck && !columnCheck.loading && (
                  columnCheck.error ? (
                    <p className="text-[10px] font-medium text-rose-400">{columnCheck.error}</p>
                  ) : (
                    <div className="space-y-1.5 rounded-lg border border-slate-800 bg-slate-950 p-3 text-[10px]">
                      {columnCheck.missing.length > 0 ? (
                        <>
                          <p className="font-bold uppercase tracking-wider text-amber-400">Missing columns ({columnCheck.missing.length})</p>
                          <p className="break-words font-mono text-amber-300">{columnCheck.missing.join(", ")}</p>
                          <p className="text-slate-500">Add these in NocoDB → Fields (exact, case-sensitive), then re-fire. Unmatched keys are silently dropped.</p>
                        </>
                      ) : (
                        <p className="font-bold uppercase tracking-wider text-emerald-400">✓ All payload keys exist as columns</p>
                      )}
                      <p className="text-slate-600">Present: <span className="font-mono">{columnCheck.present.join(", ")}</span></p>
                    </div>
                  )
                )}
              </div>
            )}

            <button
              onClick={handleFire}
              disabled={sending || !canFire}
              className="mt-auto flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-950 shadow-lg shadow-amber-500/10 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? <><Loader2 className="h-4 w-4 animate-spin text-slate-950" /> Executing...</> : <><Send className="h-4 w-4 text-slate-950" /> Fire Test to Destination</>}
            </button>
          </div>

          {/* ── Right: preview + response ──────────────────────────────────── */}
          <div className="flex flex-col gap-5">
            {/* Outgoing payload */}
            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-surface-raised">
              <div className="flex items-center gap-2 border-b border-slate-800/60 bg-surface px-5 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                <span className="ml-2 font-mono text-[11px] text-slate-500">outgoing_payload.json</span>
                <span className={`ml-auto rounded px-2 py-0.5 font-mono text-[10px] uppercase ${payloadMode === "raw" ? "bg-amber-500/10 text-amber-400" : passThrough ? "bg-emerald-500/10 text-emerald-400" : "bg-cyan-500/10 text-cyan-400"}`}>
                  {payloadMode === "raw" ? "RAW JSON" : passThrough ? "MAPPED + PASS-THROUGH" : "MAPPED PREVIEW"}
                </span>
              </div>
              <pre className="max-h-[160px] overflow-auto p-5 font-mono text-[11px] leading-relaxed text-emerald-300">
                {JSON.stringify(egressPayload, null, 2)}
              </pre>
            </div>

            {/* Response log */}
            <div className="flex min-h-[220px] flex-1 flex-col overflow-hidden rounded-2xl border border-slate-800 bg-surface">
              <div className="flex items-center gap-2 border-b border-slate-800/60 bg-surface/50 px-5 py-3">
                <span className="font-mono text-[10px] text-slate-500">{log && !log.success ? "egress_user_message" : "egress_response_log"}</span>
                {log && (
                  <span className={`ml-auto rounded px-2 py-0.5 font-mono text-[10px] ${log.success ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                    {log.statusCode ? `STATUS: ${log.statusCode}` : "FAILED"}
                  </span>
                )}
              </div>
              <div className="max-h-[300px] flex-1 overflow-auto p-5 font-mono text-[11px] leading-relaxed text-slate-300">
                {!log && !sending && (
                  <div className="text-slate-600"><span>$ egress --await-trigger</span><span className="ml-1 animate-pulse">_</span></div>
                )}
                {sending && (
                  <div className="flex items-center gap-3 text-amber-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /><span>Dispatching outgoing payload…</span></div>
                )}
                {log && log.success && (
                  <div className="animate-fade-in space-y-3">
                    <div className="text-slate-500">
                      <p className="font-bold text-slate-400">✔ EGRESS DISPATCH SUCCESS</p>
                      <p className="mt-1">Duration: {log.durationMs || 0}ms</p>
                    </div>
                    {log.responseText !== undefined && (
                      <div className="space-y-1">
                        <span className="block text-[10px] font-bold uppercase text-slate-500">Destination Response Body:</span>
                        <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-slate-900/80 p-3 font-mono text-slate-100">{log.responseText || "(Empty body)"}</pre>
                      </div>
                    )}
                  </div>
                )}
                {log && !log.success && (
                  <div className="animate-fade-in rounded-lg border border-amber-500/25 bg-amber-500/5 p-4 text-amber-300">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">User Message</span>
                      </div>
                      <button onClick={() => setShowRawTraceDrawer(true)} className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800/80 px-2 py-1.5 text-[9px] font-semibold text-slate-300 shadow-sm transition-colors hover:bg-slate-700" title="View raw destination trace">
                        <Info className="h-3.5 w-3.5 text-cyan-400" /> View Raw Trace
                      </button>
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-300">{log.statusCode ? egressStatusHelp(log.statusCode) : (log.error || "Dispatch failed.")}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Raw trace drawer */}
      {showRawTraceDrawer && log && (
        <div className="animate-slide-up fixed bottom-6 right-6 z-50 w-full max-w-md rounded-2xl border border-white/20 bg-black p-5 shadow-2xl shadow-black/50">
          <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-white" />
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-white">System Error Trace</span>
            </div>
            <button onClick={() => setShowRawTraceDrawer(false)} className="rounded-lg p-1 text-white/60 transition hover:bg-white/10 hover:text-white" title="Close trace drawer">
              <X className="h-4 w-4" />
            </button>
          </div>
          <pre className="max-h-[200px] overflow-auto rounded-lg border border-white/10 bg-black p-3 font-mono text-[10.5px] leading-relaxed text-white">{rawTraceString}</pre>
        </div>
      )}
    </section>
  );
}
