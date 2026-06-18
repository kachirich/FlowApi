import { Link, useNavigate } from 'react-router-dom';
import { Inbox, Workflow, Gauge, ArrowRight, Check } from 'lucide-react';

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
            <a href="#pricing" className="text-sm text-zinc-400 transition-colors hover:text-zinc-100">Pricing</a>
            <Link to="/docs" className="text-sm text-zinc-400 transition-colors hover:text-zinc-100">Integrations</Link>
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

        {/* ── Final CTA ───────────────────────────────────────────────── */}
        <section className="border-t border-zinc-900 py-24">
          <div className="mx-auto max-w-3xl px-6 text-center">
            <h2 className="text-3xl font-medium tracking-tight text-zinc-50">
              Stop losing leads to bad routing.
            </h2>
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
