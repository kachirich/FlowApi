import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Terminal } from 'lucide-react';
import DocsLayout from './DocsLayout';
import CopyBox from './CopyBox';

export const WEBHOOK_URL = 'https://api.flowgateway.dev/api/v1/leads';
export const HEADER_NAME = 'x-api-key';

/* Accent palette — matches the accents used in IntegrationsTab.jsx */
export const ACCENTS = {
  indigo: { text: 'text-indigo-400', border: 'border-indigo-500/60', badge: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
  violet: { text: 'text-violet-400', border: 'border-violet-500/60', badge: 'bg-violet-500/10 text-violet-400 border-violet-500/20' },
  cyan: { text: 'text-cyan-400', border: 'border-cyan-500/60', badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
  amber: { text: 'text-amber-400', border: 'border-amber-500/60', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  rose: { text: 'text-rose-400', border: 'border-rose-500/60', badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
  teal: { text: 'text-teal-400', border: 'border-teal-500/60', badge: 'bg-teal-500/10 text-teal-400 border-teal-500/20' },
};

const RESPONSE_EXAMPLE = `{
  "success": true,
  "lead_id": "uuid",
  "contact_id": "string",
  "score": 75,
  "queued": true
}`;

const CURL_EXAMPLE = `curl -X POST ${WEBHOOK_URL} \\
  -H "x-api-key: YOUR_KEY_HERE" \\
  -H "Content-Type: application/json" \\
  -d '{"email":"test@example.com","first_name":"Test"}'`;

function CodeBlock({ children }) {
  return (
    <pre className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 font-mono text-[12px] leading-relaxed text-zinc-300">
      <code>{children}</code>
    </pre>
  );
}

/**
 * PlatformDoc — the shared skeleton every per-platform docs page renders.
 *
 * Props:
 *   name         - platform display name (H1)
 *   accent       - key into ACCENTS
 *   subtitle     - one-sentence hero subtitle
 *   steps        - [{ step, detail }] setup steps (step text reused from
 *                  IntegrationsTab.jsx verbatim, detail adds one sentence)
 *   samplePayload- realistic JSON string this platform typically sends
 */
export default function PlatformDoc({ name, accent = 'indigo', subtitle, steps = [], samplePayload }) {
  const a = ACCENTS[accent] || ACCENTS.indigo;

  return (
    <DocsLayout>
      {/* 1. Breadcrumb */}
      <Link
        to="/docs"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> All integrations
      </Link>

      {/* 2. Hero */}
      <header className="mt-6 mb-10">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
          <span className={a.text}>{name}</span>
        </h1>
        <p className="mt-3 text-lg text-zinc-400 leading-relaxed max-w-2xl">{subtitle}</p>
      </header>

      {/* 3. Connection panel */}
      <section className="mb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CopyBox label="Webhook URL" value={WEBHOOK_URL} />
          <CopyBox label="Header name" value={HEADER_NAME} />
        </div>
        <p className="mt-3 text-sm text-zinc-500">
          Send any JSON payload — FlowGateway auto-extracts lead fields.
        </p>
      </section>

      {/* 4. Setup */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-5">Setup</h2>
        <ol className="space-y-4">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-4">
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${a.badge}`}>
                {i + 1}
              </span>
              <div className="pt-0.5">
                <p className="text-sm font-semibold text-zinc-100">{s.step}</p>
                <p className="mt-0.5 text-sm text-zinc-400 leading-relaxed">{s.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* 5. What we accept */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-3">What we accept</h2>
        <p className="text-sm text-zinc-400 leading-relaxed mb-4 max-w-2xl">
          Any JSON works — nested objects are fine. FlowGateway automatically pulls{' '}
          <code className="font-mono text-zinc-200">first_name</code>,{' '}
          <code className="font-mono text-zinc-200">last_name</code>,{' '}
          <code className="font-mono text-zinc-200">email</code>,{' '}
          <code className="font-mono text-zinc-200">phone</code>, and{' '}
          <code className="font-mono text-zinc-200">company</code> from wherever they appear.
          Here is a realistic example of what {name} typically sends:
        </p>
        <CodeBlock>{samplePayload}</CodeBlock>
      </section>

      {/* 6. Response */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-3">What you&apos;ll get back</h2>
        <CodeBlock>{RESPONSE_EXAMPLE}</CodeBlock>
      </section>

      {/* 7. Test it now */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-3 flex items-center gap-2">
          <Terminal className={`h-5 w-5 ${a.text}`} /> Test it now
        </h2>
        <p className="text-sm text-zinc-400 mb-4">
          Replace <code className="font-mono text-zinc-200">YOUR_KEY_HERE</code> with a key from your dashboard and run:
        </p>
        <CopyBox label="cURL" value={CURL_EXAMPLE} />
      </section>

      {/* 8. CTA */}
      <section className="rounded-2xl border border-indigo-500/30 bg-gradient-to-b from-indigo-500/[0.07] to-zinc-950 p-8 text-center shadow-[0_0_40px_-20px_rgba(99,102,241,0.5)]">
        <h3 className="text-xl font-bold mb-2">Don&apos;t have an API key yet?</h3>
        <p className="text-sm text-zinc-400 mb-6 max-w-md mx-auto">
          Create a free account and generate your first key in under a minute.
        </p>
        <Link
          to="/login"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)]"
        >
          Generate API Key <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </DocsLayout>
  );
}
