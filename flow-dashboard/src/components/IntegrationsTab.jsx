import { useState } from 'react';
import { Plug, Copy, ClipboardCheck, ArrowRight, Webhook, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';

const WEBHOOK_URL = 'https://api.flowgateway.dev/api/v1/leads';
const HEADER_NAME = 'x-api-key';

/* ═══════════════════════════════════════════════════════════════════════════
   Accent palette per partner
   ═══════════════════════════════════════════════════════════════════════════ */
const ACCENTS = {
  indigo: { stripe: 'border-indigo-500/60', text: 'text-indigo-400', badge: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
  violet: { stripe: 'border-violet-500/60', text: 'text-violet-400', badge: 'bg-violet-500/10 text-violet-400 border-violet-500/20' },
  cyan: { stripe: 'border-cyan-500/60', text: 'text-cyan-400', badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
  amber: { stripe: 'border-amber-500/60', text: 'text-amber-400', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  rose: { stripe: 'border-rose-500/60', text: 'text-rose-400', badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
  teal: { stripe: 'border-teal-500/60', text: 'text-teal-400', badge: 'bg-teal-500/10 text-teal-400 border-teal-500/20' },
};

const INTEGRATIONS = [
  {
    name: 'GoHighLevel',
    tag: 'GHL',
    accent: 'indigo',
    description: 'Send leads from GHL Workflows using the Webhook action.',
    steps: ['Open a GHL Workflow', 'Add a Webhook action', 'Paste the URL above', 'Add header: x-api-key → your key'],
  },
  {
    name: 'Tally.so',
    tag: 'Tally',
    accent: 'violet',
    description: 'Forward form submissions from Tally to FlowGateway.',
    steps: ['Open your Tally form', 'Go to Integrations → Webhooks', 'Paste the URL above', 'Add custom header: x-api-key'],
  },
  {
    name: 'Typeform',
    tag: 'Type',
    accent: 'cyan',
    description: 'Route Typeform responses directly into your flows.',
    steps: ['Open your Typeform', 'Connect → Webhooks', 'Paste the URL above', 'Add header in advanced settings'],
  },
  {
    name: 'n8n',
    tag: 'n8n',
    accent: 'amber',
    description: 'Trigger FlowGateway from any n8n HTTP Request node.',
    steps: ['Add an HTTP Request node', 'Set method: POST', 'Paste URL above', 'Add Header: x-api-key'],
  },
  {
    name: 'Jotform',
    tag: 'Jot',
    accent: 'rose',
    description: 'Send Jotform submissions to FlowGateway automatically.',
    steps: ['Open your form settings', 'Integrations → Webhooks', 'Paste the URL above', 'Note: add key as URL param ?api_key=... if headers unsupported'],
  },
  {
    name: 'Zapier / Make',
    tag: 'Zap',
    accent: 'teal',
    description: "Use Webhooks by Zapier or Make's HTTP module to connect any app.",
    steps: ['Create a new Zap/Scenario', 'Choose Webhooks / HTTP module', 'POST to the URL above', 'Add x-api-key as a request header'],
  },
];

function CopyButton({ value, label = 'Copy', iconOnly = false }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      title={`Copy ${label}`}
      className="flex items-center gap-1.5 rounded-md border border-slate-700/60 bg-slate-900/60 px-2 py-1 text-[10px] font-semibold text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
    >
      {copied ? <ClipboardCheck className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
      {!iconOnly && (copied ? 'Copied' : label)}
    </button>
  );
}

export default function IntegrationsTab({ setActiveTab }) {
  return (
    <div className="space-y-8 w-full max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-xl font-extrabold text-slate-100 flex items-center gap-2">
          <Plug className="h-6 w-6 text-cyan-400" />
          Integrations
        </h2>
        <p className="text-xs text-slate-400 mt-1 leading-normal">
          Connect your forms, CRMs and automation tools to FlowGateway. Point any of them at your inbound endpoint and authenticate with your API key.
        </p>
      </div>

      {/* ── Your Connection Details ─────────────────────────────────────── */}
      <section>
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
          <Webhook className="h-4 w-4 text-cyan-400" />
          Your Connection Details
        </h3>
        <div className="relative overflow-hidden rounded-2xl border border-cyan-500/20 bg-slate-900/40 backdrop-blur-xl p-5 shadow-xl shadow-cyan-500/[0.04]">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />

          <div className="space-y-4">
            {/* Webhook URL */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 font-mono">
                  Webhook URL
                </label>
                <CopyButton value={WEBHOOK_URL} label="Copy URL" />
              </div>
              <code className="block w-full rounded-lg border border-slate-700/50 bg-slate-950 p-3 font-mono text-[11px] text-cyan-300 break-all">
                {WEBHOOK_URL}
              </code>
            </div>

            {/* Header name */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 font-mono">
                  Auth Header
                </label>
                <CopyButton value={HEADER_NAME} label="Copy Header" />
              </div>
              <code className="block w-full rounded-lg border border-slate-700/50 bg-slate-950 p-3 font-mono text-[11px] text-slate-300 break-all">
                {HEADER_NAME}
              </code>
            </div>

            {/* Generate key link */}
            <button
              onClick={() => setActiveTab && setActiveTab('dashboard')}
              className="group flex items-center gap-1.5 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              <KeyRound className="h-3.5 w-3.5" />
              Generate API Key
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </section>

      {/* ── Connect Your Tools ──────────────────────────────────────────── */}
      <section>
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
          <Plug className="h-4 w-4 text-cyan-400" />
          Connect Your Tools
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {INTEGRATIONS.map((tool) => {
            const a = ACCENTS[tool.accent];
            return (
              <div
                key={tool.name}
                className={`rounded-2xl border border-slate-800/60 border-l-2 ${a.stripe} bg-slate-900/40 backdrop-blur-xl p-5 shadow-xl transition-colors hover:border-slate-700/80`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`inline-flex shrink-0 items-center justify-center rounded-md border px-2 py-1 font-mono text-[10px] font-bold ${a.badge}`}>
                      {tool.tag}
                    </span>
                    <h4 className="text-sm font-bold text-slate-100 truncate">{tool.name}</h4>
                  </div>
                  <CopyButton value={WEBHOOK_URL} label="Copy URL" iconOnly />
                </div>

                <p className="text-xs text-slate-400 leading-relaxed mb-4">{tool.description}</p>

                <ol className="space-y-1.5">
                  {tool.steps.map((step, i) => (
                    <li key={i} className="flex gap-2 text-[11px] leading-relaxed text-slate-500">
                      <span className={`shrink-0 font-mono font-bold ${a.text}`}>{i + 1}.</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
