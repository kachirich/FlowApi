import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import DocsLayout from '../../components/docs/DocsLayout';
import CopyBox from '../../components/docs/CopyBox';
import { WEBHOOK_URL, HEADER_NAME, ACCENTS } from '../../components/docs/PlatformDoc';

/* Descriptions reused verbatim from IntegrationsTab.jsx so dashboard + docs stay in sync */
const PLATFORMS = [
  { name: 'GoHighLevel', slug: 'ghl', accent: 'indigo', description: 'Send leads from GHL Workflows using the Webhook action.' },
  { name: 'Tally.so', slug: 'tally', accent: 'violet', description: 'Forward form submissions from Tally to FlowGateway.' },
  { name: 'Typeform', slug: 'typeform', accent: 'cyan', description: 'Route Typeform responses directly into your flows.' },
  { name: 'n8n', slug: 'n8n', accent: 'amber', description: 'Trigger FlowGateway from any n8n HTTP Request node.' },
  { name: 'Jotform', slug: 'jotform', accent: 'rose', description: 'Send Jotform submissions to FlowGateway automatically.' },
  { name: 'Zapier / Make', slug: 'zapier', accent: 'teal', description: "Use Webhooks by Zapier or Make's HTTP module to connect any app." },
];

export default function DocsIndex() {
  return (
    <DocsLayout>
      {/* Hero */}
      <header className="text-center max-w-2xl mx-auto mb-10">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
          Connect your tools to{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
            FlowGateway
          </span>
        </h1>
        <p className="text-lg text-zinc-400 leading-relaxed">
          Send leads from any platform into your FlowAPI pipeline in under 2 minutes.
        </p>
      </header>

      {/* Quick start */}
      <section className="mb-14">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CopyBox label="Webhook URL" value={WEBHOOK_URL} />
          <CopyBox label="Header" value={HEADER_NAME} />
        </div>
      </section>

      {/* Platform grid */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-5">
          Integration guides
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {PLATFORMS.map((p) => {
            const a = ACCENTS[p.accent] || ACCENTS.indigo;
            return (
              <Link
                key={p.slug}
                to={`/docs/integrations/${p.slug}`}
                className={`group flex flex-col rounded-2xl border border-zinc-800 border-l-2 ${a.border} bg-zinc-900/40 p-6 transition-all duration-200 hover:scale-[1.02] hover:border-zinc-700 hover:shadow-[0_0_30px_-10px_rgba(99,102,241,0.3)]`}
              >
                <h3 className="text-lg font-bold text-zinc-100 mb-2">{p.name}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed flex-1">{p.description}</p>
                <span className={`mt-4 inline-flex items-center gap-1.5 text-sm font-semibold ${a.text}`}>
                  View guide
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </DocsLayout>
  );
}
