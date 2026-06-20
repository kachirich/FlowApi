import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Inbox, Workflow, Gauge, ArrowRight, Check, Plus, Minus, Zap, ShieldCheck, BarChart3 } from 'lucide-react';

const INTAKE_SOURCES = ['GHL', 'Tally', 'Typeform', 'Jotform', 'Zapier', 'n8n', 'Webflow', 'Make'];

const FEATURES = [
  {
    icon: Inbox,
    title: 'Universal intake',
    body: 'One endpoint accepts leads from any platform. The smart extractor pulls name, email, phone, and company from whatever JSON shape you send.',
  },
  {
    icon: Workflow,
    title: 'Flows you control',
    body: 'Group destinations into named flows — Realtor leads to one buyer, fitness leads to another. Round-robin or broadcast, your call.',
  },
  {
    icon: Gauge,
    title: 'Built for volume',
    body: 'Tier-based retries, daily caps per destination, audit logs for every dispatch. When a buyer pays per lead, every lead matters.',
  },
];

const STEPS = [
  { n: '01', title: 'INTAKE', body: 'Connect GHL, Tally, or anything that fires a webhook.' },
  { n: '02', title: 'ROUTE', body: 'Build flows that send leads to the right buyer or CRM.' },
  { n: '03', title: 'DISPATCH', body: 'Every lead delivered, logged, and counted in real time.' },
];

const VALUE_PROPS = [
  {
    icon: Zap,
    metric: '< 50ms',
    title: 'Capture to dispatch',
    body: 'From inbound webhook to outbound delivery in the same TCP heartbeat. Your buyers get fresh leads, not yesterday’s.',
  },
  {
    icon: ShieldCheck,
    metric: '100%',
    title: 'Audited deliveries',
    body: 'Every dispatch is logged with payload, response code, and latency. Disputes get settled in seconds, not screenshots.',
  },
  {
    icon: BarChart3,
    metric: '0 leaks',
    title: 'Caps enforced atomically',
    body: 'Redis-backed Lua scripts guarantee a buyer never gets a single lead over their daily cap — even at 10k req/s.',
  },
];

const FAQ = [
  {
    q: 'How is FlowGateway different from Zapier or Make?',
    a: 'Zapier and Make are general-purpose automation tools — they’re great at chaining steps but slow, expensive per task, and not designed for lead-broker economics. FlowGateway is purpose-built for lead routing: per-buyer daily caps, round-robin distribution, lead scoring, audit logs, and tiered retries. You pay a flat monthly rate, not per zap.',
  },
  {
    q: 'Can I self-host FlowGateway?',
    a: 'Yes. The entire stack — API gateway, dashboard, Postgres, Redis — ships with a single docker compose up. The source is on GitHub. Read the self-host guide in the docs for the full walkthrough.',
  },
  {
    q: 'Which platforms can send leads in?',
    a: 'Anything that can fire a webhook. We have first-class support for GoHighLevel, Tally, Typeform, Jotform, Webflow, Zapier, n8n, Make, and Facebook Lead Ads. The smart extractor handles arbitrarily nested JSON, so custom shapes work without any field mapping.',
  },
  {
    q: 'What happens if my buyer’s endpoint is down?',
    a: 'The job is retried automatically. Sandbox is one shot, Growth retries 3× with fixed backoff, Enterprise retries up to 100× with exponential backoff. Every attempt is logged. If all attempts fail, the lead is marked FAILED in the ledger so you can replay it manually.',
  },
  {
    q: 'How do you protect against SSRF and abusive destinations?',
    a: 'Two layers. Destination URLs are validated with Zod at save time — we reject HTTP, private ranges, .local, and cloud metadata IPs. Then at dispatch time we re-resolve the hostname and block any answer pointing to an internal IP. DNS rebinding cannot leak through.',
  },
  {
    q: 'Do you store the leads?',
    a: 'Yes — in your Lead Vault, with a quality score, source, and delivery status. You can purge it any time, and on account deletion every lead, log, and webhook is cascade-deleted (GDPR right to erasure).',
  },
  {
    q: 'How is billing handled?',
    a: 'Stripe. Plans are monthly, no contracts. You can upgrade or downgrade from the dashboard and the new quota takes effect immediately. Failed payments grace for 7 days before the plan downgrades to Sandbox.',
  },
  {
    q: 'Is there an API for everything in the dashboard?',
    a: 'Yes. Every button in the dashboard is a documented REST endpoint. Auth is either an HttpOnly JWT cookie (browser sessions) or an x-api-key header (server-to-server).',
  },
];

const SHOWCASE = [
  {
    title: 'Live Dashboard',
    body: 'A real-time view of inbound activity, vaulted leads, lead scores, and delivery status. Spam Shield and Tax Avoided counters show the dollar value FlowGateway is saving you in real time.',
    src: '/screenshots/dashboard.png',
    alt: 'FlowGateway live dashboard with recent inbound activity, lead ledger and active API keys',
  },
  {
    title: 'API Key & Flow Management',
    body: 'Generate scoped API keys, bind them to a routing flow, and revoke them in one click. Keys are SHA-256 hashed at rest — they’re shown once at creation and never again.',
    src: '/screenshots/api-keys.png',
    alt: 'Generate API key panel with active keys table and routing flow selector',
  },
  {
    title: 'Webhook Traffic Analytics',
    body: 'Every inbound and outbound request is timestamped, status-coded, and inspectable. Click any row to see the full JSON payload that came in or went out.',
    src: '/screenshots/analytics.png',
    alt: 'Webhook traffic analytics table with timestamps, methods, status codes and View JSON buttons',
  },
];

const BROKER_SPECS = [
  'Daily caps per buyer destination',
  'Round-robin and broadcast routing',
  'Retries scaled to your plan',
  'Full delivery audit log',
  'API keys scoped to specific flows',
];

const TIERS = [
  {
    name: 'Sandbox',
    price: '$0',
    blurb: 'Perfect for testing the pipe.',
    features: ['Up to 500 leads/day', '1 active destination', 'Standard rate limiting', 'No retry queue'],
    cta: 'Start free',
    highlight: false,
  },
  {
    name: 'Growth',
    price: '$99',
    blurb: 'For growing lead brokers.',
    features: ['Up to 10,000 leads/day', 'Up to 5 destinations', 'Edge authentication', 'Standard retry queue (3x)'],
    cta: 'Get started',
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: '$249',
    blurb: 'For high-volume agencies.',
    features: ['Up to 100,000 leads/day', 'Unlimited destinations', 'Exponential backoff retries', 'Dedicated throughput'],
    cta: 'Book setup call',
    highlight: false,
  },
];

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-zinc-900">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 py-5 text-left"
      >
        <span className="text-sm font-medium text-zinc-100">{q}</span>
        {open ? (
          <Minus className="h-4 w-4 shrink-0 text-zinc-500" />
        ) : (
          <Plus className="h-4 w-4 shrink-0 text-zinc-500" />
        )}
      </button>
      {open && (
        <p className="pb-5 pr-8 text-sm leading-relaxed text-zinc-400">{a}</p>
      )}
    </div>
  );
}

function Wordmark() {
  return (
    <div className="flex items-center gap-2">
      <span className="h-2 w-2 rounded-full bg-indigo-500" />
      <span className="text-base font-medium tracking-tight text-zinc-50">FlowGateway</span>
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const goToLogin = () => navigate('/login');
  const scrollToFeatures = () => {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans">
      {/* ── Top nav ───────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 w-full border-b border-zinc-900 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/"><Wordmark /></Link>
          <div className="hidden items-center gap-7 md:flex">
            <a href="#features" className="text-sm text-zinc-400 transition-colors hover:text-zinc-100">Features</a>
            <a href="#pricing" className="text-sm text-zinc-400 transition-colors hover:text-zinc-100">Pricing</a>
            <a href="#faq" className="text-sm text-zinc-400 transition-colors hover:text-zinc-100">FAQ</a>
            <Link to="/docs" className="text-sm text-zinc-400 transition-colors hover:text-zinc-100">Docs</Link>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={goToLogin}
              className="rounded-md px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
            >
              Log in
            </button>
            <button
              onClick={goToLogin}
              className="rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-400"
            >
              Get started
            </button>
          </div>
        </div>
      </nav>

      <main>
        {/* ── Hero ────────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-5xl px-6 py-24 text-center md:py-32">
          <p className="mb-6 text-xs font-medium uppercase tracking-widest text-indigo-300">
            For lead brokers and high-volume ops
          </p>
          <h1 className="mx-auto max-w-4xl text-5xl font-medium leading-tight tracking-tight text-zinc-50 md:text-6xl">
            Route every lead to the buyer who pays the most.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400">
            FlowGateway is the routing layer for lead brokers. Intake from any source — GHL, Tally,
            Typeform, your own forms — and dispatch in real time to your buyers, your CRMs, your automations.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              onClick={goToLogin}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-indigo-500 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-indigo-400 sm:w-auto"
            >
              Start routing leads <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={scrollToFeatures}
              className="inline-flex w-full items-center justify-center rounded-md px-5 py-3 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 sm:w-auto"
            >
              See how it works
            </button>
          </div>
        </section>

        {/* ── Trust strip ─────────────────────────────────────────────── */}
        <section className="border-y border-zinc-900 py-8">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-4 gap-y-2 px-6 text-xs uppercase tracking-widest text-zinc-600">
            <span>Intake from</span>
            {INTAKE_SOURCES.map((s, i) => (
              <span key={s} className="flex items-center gap-4">
                {i > 0 && <span className="text-zinc-700">·</span>}
                <span className="text-zinc-500">{s}</span>
              </span>
            ))}
          </div>
        </section>

        {/* ── Product showcase ────────────────────────────────────────── */}
        <section id="product" className="mx-auto max-w-6xl px-6 py-24">
          <div className="mb-14 max-w-2xl">
            <p className="mb-3 text-xs font-medium uppercase tracking-widest text-indigo-300">The dashboard</p>
            <h2 className="text-3xl font-medium tracking-tight text-zinc-50">
              Every lead, every dispatch, in one screen.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-zinc-400">
              No more cross-referencing CRMs and Zapier task histories. FlowGateway gives you a
              single pane of glass over every inbound webhook, every routing decision, and every
              outbound delivery — with the receipts to prove it.
            </p>
          </div>
          <div className="space-y-20">
            {SHOWCASE.map((s, i) => (
              <div
                key={s.title}
                className={`grid grid-cols-1 items-center gap-10 lg:grid-cols-2 ${
                  i % 2 === 1 ? 'lg:[&>*:first-child]:order-2' : ''
                }`}
              >
                <div>
                  <h3 className="text-xl font-medium tracking-tight text-zinc-50">{s.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-400">{s.body}</p>
                </div>
                <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 shadow-2xl shadow-indigo-500/5">
                  <img src={s.src} alt={s.alt} className="block h-auto w-full" loading="lazy" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Value props (metrics) ───────────────────────────────────── */}
        <section className="border-t border-zinc-900 py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mb-12 max-w-2xl">
              <h2 className="text-2xl font-medium tracking-tight text-zinc-50">
                Numbers your buyers actually trust.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                Lead brokering is a trust business. FlowGateway gives you the operational
                guarantees you need to charge premium per-lead rates without losing sleep.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              {VALUE_PROPS.map((v) => (
                <div key={v.title} className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
                  <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-md bg-indigo-500/10">
                    <v.icon className="h-5 w-5 text-indigo-400" />
                  </div>
                  <div className="font-mono text-3xl font-medium text-zinc-50">{v.metric}</div>
                  <h3 className="mt-2 text-sm font-medium uppercase tracking-wider text-zinc-300">{v.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-400">{v.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features ────────────────────────────────────────────────── */}
        <section id="features" className="mx-auto max-w-6xl px-6 py-24">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 transition-colors hover:border-zinc-700">
                <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-md bg-indigo-500/10">
                  <f.icon className="h-5 w-5 text-indigo-400" />
                </div>
                <h3 className="mb-2 text-base font-medium text-zinc-50">{f.title}</h3>
                <p className="text-sm leading-relaxed text-zinc-400">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── How it works ────────────────────────────────────────────── */}
        <section className="border-t border-zinc-900 py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
              {STEPS.map((s) => (
                <div key={s.n}>
                  <div className="font-mono text-4xl font-light text-zinc-700">{s.n}</div>
                  <h3 className="mt-4 text-sm font-medium uppercase tracking-wider text-zinc-50">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── For lead brokers ────────────────────────────────────────── */}
        <section className="border-t border-zinc-900 py-24">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-6 md:grid-cols-2">
            <div>
              <h2 className="text-2xl font-medium tracking-tight text-zinc-50">Built for the broker economy</h2>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-zinc-400">
                Your buyers have caps. Your sellers have volume. FlowGateway sits in the middle and makes
                sure every lead lands where it&apos;s worth the most.
              </p>
            </div>
            <ul className="space-y-3">
              {BROKER_SPECS.map((spec) => (
                <li key={spec} className="flex items-center gap-3 text-sm text-zinc-300">
                  <Check className="h-4 w-4 shrink-0 text-indigo-400" />
                  {spec}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── Pricing teaser ──────────────────────────────────────────── */}
        <section id="pricing" className="border-t border-zinc-900 py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mb-12 text-center">
              <h2 className="text-2xl font-medium tracking-tight text-zinc-50">Pricing that scales with volume</h2>
              <p className="mt-2 text-sm text-zinc-400">Start routing for free. Upgrade when the leads do.</p>
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              {TIERS.map((t) => (
                <div
                  key={t.name}
                  className={`flex flex-col rounded-lg border bg-zinc-900 p-6 ${
                    t.highlight ? 'border-indigo-500' : 'border-zinc-800'
                  }`}
                >
                  <h3 className="text-base font-medium text-zinc-50">{t.name}</h3>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="font-mono text-3xl font-medium text-zinc-50">{t.price}</span>
                    <span className="text-sm text-zinc-500">/mo</span>
                  </div>
                  <p className="mt-2 text-sm text-zinc-400">{t.blurb}</p>
                  <ul className="mt-6 flex-1 space-y-3">
                    {t.features.map((feat) => (
                      <li key={feat} className="flex items-center gap-2.5 text-sm text-zinc-300">
                        <Check className="h-4 w-4 shrink-0 text-indigo-400" />
                        {feat}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={goToLogin}
                    className={`mt-8 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                      t.highlight
                        ? 'bg-indigo-500 text-white hover:bg-indigo-400'
                        : 'border border-zinc-700 bg-zinc-800 text-zinc-100 hover:bg-zinc-700'
                    }`}
                  >
                    {t.cta}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ─────────────────────────────────────────────────────── */}
        <section id="faq" className="border-t border-zinc-900 py-24">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-6 md:grid-cols-3">
            <div className="md:col-span-1">
              <h2 className="text-2xl font-medium tracking-tight text-zinc-50">
                Frequently asked questions
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                Can&apos;t find what you&apos;re looking for? Reach out at{' '}
                <a href="mailto:support@flowgateway.dev" className="text-indigo-400 hover:text-indigo-300">
                  support@flowgateway.dev
                </a>
                .
              </p>
            </div>
            <div className="md:col-span-2">
              {FAQ.map((item) => (
                <FaqItem key={item.q} q={item.q} a={item.a} />
              ))}
            </div>
          </div>
        </section>

        {/* ── Final CTA ───────────────────────────────────────────────── */}
        <section className="border-t border-zinc-900 py-24">
          <div className="mx-auto max-w-3xl px-6 text-center">
            <h2 className="text-3xl font-medium tracking-tight text-zinc-50">
              Stop losing leads to bad routing.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-zinc-400">
              Set up takes ten minutes. Your first 500 leads are free. No credit card required, no
              sales call, no &quot;book a demo&quot; gauntlet — just an API key and a dashboard.
            </p>
            <button
              onClick={goToLogin}
              className="mt-8 inline-flex items-center justify-center gap-2 rounded-md bg-indigo-500 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-indigo-400"
            >
              Get your API key <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-900 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-xs text-zinc-500 sm:flex-row">
          <span>FlowGateway © 2026</span>
          <div className="flex items-center gap-6">
            <Link to="/terms" className="transition-colors hover:text-zinc-300">Terms</Link>
            <Link to="/privacy" className="transition-colors hover:text-zinc-300">Privacy</Link>
            <Link to="/docs" className="transition-colors hover:text-zinc-300">Docs</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
