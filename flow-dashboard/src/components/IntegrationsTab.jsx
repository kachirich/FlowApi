import { useState } from 'react';
import { Plug, Copy, ClipboardCheck, ArrowRight, Webhook, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';

const WEBHOOK_URL = 'https://api.flowgateway.dev/api/v1/leads';
const HEADER_NAME = 'x-api-key';

// Single indigo accent across every integration — platforms are differentiated
// by name + badge only (no per-platform color stripes).
const INTEGRATIONS = [
  {
    name: 'GoHighLevel',
    tag: 'GHL',
    description: 'Send leads from GHL Workflows using the Webhook action.',
    steps: ['Open a GHL Workflow', 'Add a Webhook action', 'Paste the URL above', 'Add header: x-api-key → your key'],
  },
  {
    name: 'Tally.so',
    tag: 'Tally',
    description: 'Forward form submissions from Tally to FlowGateway.',
    steps: ['Open your Tally form', 'Go to Integrations → Webhooks', 'Paste the URL above', 'Add custom header: x-api-key'],
  },
  {
    name: 'Typeform',
    tag: 'Type',
    description: 'Route Typeform responses directly into your flows.',
    steps: ['Open your Typeform', 'Connect → Webhooks', 'Paste the URL above', 'Add header in advanced settings'],
  },
  {
    name: 'n8n',
    tag: 'n8n',
    description: 'Trigger FlowGateway from any n8n HTTP Request node.',
    steps: ['Add an HTTP Request node', 'Set method: POST', 'Paste URL above', 'Add Header: x-api-key'],
  },
  {
    name: 'Jotform',
    tag: 'Jot',
    description: 'Send Jotform submissions to FlowGateway automatically.',
    steps: ['Open your form settings', 'Integrations → Webhooks', 'Paste the URL above', 'Note: add key as URL param ?api_key=... if headers unsupported'],
  },
  {
    name: 'Zapier / Make',
    tag: 'Zap',
    description: "Use Webhooks by Zapier or Make's HTTP module to connect any app.",
    steps: ['Create a new Zap/Scenario', 'Choose Webhooks / HTTP module', 'POST to the URL above', 'Add x-api-key as a request header'],
  },
  {
    name: 'Webflow',
    tag: 'WF',
    description: 'Forward Webflow form submissions to FlowGateway via Logic or a webhook integration.',
    steps: ['Open your Webflow project', 'Go to Logic → Form submission trigger', 'Add an HTTP Request action', 'POST to the URL above with x-api-key header'],
  },
  {
    name: 'Facebook Lead Ads',
    tag: 'FB',
    description: 'Route Facebook Lead Ads into FlowGateway via GoHighLevel, Zapier, or Make — no extra setup required.',
    steps: ['Connect Facebook Lead Ads to GHL (or Zapier/Make)', 'Use the GHL Workflow webhook action (or Zapier HTTP step)', 'POST to the URL above', 'Add x-api-key as a request header'],
  },
];

function CopyButton({ value, label = 'Copy', iconOnly = false }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Failed to copy');
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      title={`Copy ${label}`}
      className="flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-300 transition-colors duration-150 hover:bg-zinc-700 hover:text-zinc-100"
    >
      {copied ? <ClipboardCheck className="h-3 w-3 text-indigo-400" /> : <Copy className="h-3 w-3" />}
      {!iconOnly && (copied ? 'Copied' : label)}
    </button>
  );
}

export default function IntegrationsTab({ setActiveTab }) {
  return (
    <div className="w-full max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-medium tracking-tight text-zinc-50 flex items-center gap-2">
          <Plug className="h-6 w-6 text-indigo-400" />
          Integrations
        </h2>
        <p className="mt-1 text-sm text-zinc-400 leading-relaxed">
          Connect your forms, CRMs and automation tools to FlowGateway. Point any of them at your inbound
          endpoint and authenticate with your API key.
        </p>
      </div>

      {/* Your Connection Details */}
      <section>
        <h3 className="mb-3 flex items-center gap-2 text-lg font-medium text-zinc-100">
          <Webhook className="h-4 w-4 text-indigo-400" />
          Your connection details
        </h3>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <div className="space-y-4">
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">Webhook URL</label>
                <CopyButton value={WEBHOOK_URL} label="Copy URL" />
              </div>
              <code className="block w-full break-all rounded-md border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs text-indigo-300">
                {WEBHOOK_URL}
              </code>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">Auth header</label>
                <CopyButton value={HEADER_NAME} label="Copy header" />
              </div>
              <code className="block w-full break-all rounded-md border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs text-zinc-300">
                {HEADER_NAME}
              </code>
            </div>

            <button
              onClick={() => setActiveTab && setActiveTab('dashboard')}
              className="group flex items-center gap-1.5 text-sm font-medium text-indigo-300 transition-colors hover:text-indigo-200"
            >
              <KeyRound className="h-3.5 w-3.5" />
              Generate API key
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </section>

      {/* Connect Your Tools */}
      <section>
        <h3 className="mb-3 flex items-center gap-2 text-lg font-medium text-zinc-100">
          <Plug className="h-4 w-4 text-indigo-400" />
          Connect your tools
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {INTEGRATIONS.map((tool) => (
            <div
              key={tool.name}
              className="rounded-lg border border-zinc-800 border-l-2 border-l-indigo-500 bg-zinc-900 p-6 transition-colors duration-150 hover:border-zinc-700 hover:border-l-indigo-500"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="inline-flex shrink-0 items-center justify-center rounded-md border border-indigo-500/20 bg-indigo-500/10 px-2 py-1 font-mono text-xs font-medium text-indigo-300">
                    {tool.tag}
                  </span>
                  <h4 className="truncate text-base font-medium text-zinc-50">{tool.name}</h4>
                </div>
                <CopyButton value={WEBHOOK_URL} label="Copy URL" iconOnly />
              </div>

              <p className="mb-4 text-sm leading-relaxed text-zinc-400">{tool.description}</p>

              <ol className="space-y-1.5">
                {tool.steps.map((step, i) => (
                  <li key={i} className="flex gap-2 text-xs leading-relaxed text-zinc-500">
                    <span className="shrink-0 font-mono font-medium text-indigo-400">{i + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
