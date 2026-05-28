import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, Activity, Webhook, Zap, Shield, Sliders, CheckCircle2, ArrowRight } from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();

  const handleCtaClick = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans selection:bg-indigo-500/30">
      {/* Sticky Navigation */}
      <nav className="sticky top-0 z-50 w-full border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">FlowAPI</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleCtaClick}
              className="text-sm font-medium text-zinc-400 hover:text-white transition-colors"
            >
              Sign In
            </button>
            <button
              onClick={handleCtaClick}
              className="px-4 py-2 text-sm font-medium bg-zinc-100 text-zinc-900 rounded-md hover:bg-white transition-colors"
            >
              Dashboard
            </button>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero Section */}
        <section className="relative pt-32 pb-20 px-6 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-zinc-950 to-zinc-950"></div>
          
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-sm font-medium mb-8 border border-indigo-500/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
              </span>
              v2.0 Routing Engine Now Live
            </div>
            
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight">
              Stop chasing stale lists. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
                Route live leads in milliseconds.
              </span>
            </h1>
            
            <p className="text-xl text-zinc-400 mb-10 max-w-2xl mx-auto leading-relaxed">
              The enterprise-grade webhook routing engine for lead brokers. Deliver exclusive data to your buyers' CRMs instantly without manual uploads.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={handleCtaClick}
                className="w-full sm:w-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium text-lg transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)]"
              >
                Generate API Key <ArrowRight className="w-5 h-5" />
              </button>
              <button className="w-full sm:w-auto px-8 py-4 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white rounded-lg font-medium text-lg transition-all">
                View Documentation
              </button>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="py-24 px-6 bg-zinc-900/30 border-y border-zinc-800/50">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold mb-4">The Routing Flow</h2>
              <p className="text-zinc-400 max-w-2xl mx-auto">From capture to CRM in under 50ms. A fully transparent, reliable pipeline for your data.</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8 relative">
              {/* Desktop connecting lines */}
              <div className="hidden md:block absolute top-1/2 left-[16%] right-[16%] h-[2px] bg-gradient-to-r from-indigo-500/20 via-indigo-500/50 to-indigo-500/20 -translate-y-1/2 z-0"></div>
              
              <div className="relative z-10 bg-zinc-950 p-8 rounded-2xl border border-zinc-800 shadow-xl flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center mb-6 shadow-inner">
                  <Database className="w-8 h-8 text-indigo-400" />
                </div>
                <h3 className="text-xl font-semibold mb-3">1. Inbound Capture</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  You capture the lead via your forms or affiliates, and push the JSON payload to our secure vault using your API Key.
                </p>
              </div>

              <div className="relative z-10 bg-zinc-950 p-8 rounded-2xl border border-indigo-500/30 shadow-[0_0_30px_rgba(79,70,229,0.1)] flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-indigo-900/50 border border-indigo-500/50 flex items-center justify-center mb-6 shadow-inner">
                  <Activity className="w-8 h-8 text-indigo-400" />
                </div>
                <h3 className="text-xl font-semibold mb-3">2. The Routing Engine</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  We instantly filter the payload, enforce buyer lead caps, and apply intelligent rate limits to ensure compliance.
                </p>
              </div>

              <div className="relative z-10 bg-zinc-950 p-8 rounded-2xl border border-zinc-800 shadow-xl flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center mb-6 shadow-inner">
                  <Webhook className="w-8 h-8 text-indigo-400" />
                </div>
                <h3 className="text-xl font-semibold mb-3">3. Outbound Delivery</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Instant delivery to your buyer's GoHighLevel, Salesforce, or custom webhook endpoint with automatic retries on failure.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-24 px-6">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-3xl font-bold mb-12 text-center">Engineered for Scale</h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="p-8 rounded-2xl bg-gradient-to-b from-zinc-900/50 to-zinc-950 border border-zinc-800 hover:border-zinc-700 transition-colors">
                <Zap className="w-10 h-10 text-cyan-400 mb-6" />
                <h3 className="text-lg font-semibold mb-3">Zero-Latency Delivery</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Built on a high-performance Node.js architecture with Redis caching to ensure leads are routed the millisecond they are received.
                </p>
              </div>
              
              <div className="p-8 rounded-2xl bg-gradient-to-b from-zinc-900/50 to-zinc-950 border border-zinc-800 hover:border-zinc-700 transition-colors">
                <Sliders className="w-10 h-10 text-indigo-400 mb-6" />
                <h3 className="text-lg font-semibold mb-3">Smart Buyer Lead Caps</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Never oversell a campaign. Set daily, weekly, or lifetime limits per buyer endpoint, and let our engine handle the math.
                </p>
              </div>

              <div className="p-8 rounded-2xl bg-gradient-to-b from-zinc-900/50 to-zinc-950 border border-zinc-800 hover:border-zinc-700 transition-colors">
                <Shield className="w-10 h-10 text-emerald-400 mb-6" />
                <h3 className="text-lg font-semibold mb-3">Cryptographic API Security</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Bank-grade security. We use SHA-256 hashing for all API keys, ensuring your inbound data pipes cannot be compromised.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section className="py-24 px-6 bg-zinc-900/30 border-y border-zinc-800/50">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold mb-4">Transparent Pricing</h2>
              <p className="text-zinc-400">Start routing for free. Scale when you need to.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {/* Sandbox */}
              <div className="p-8 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-col">
                <h3 className="text-xl font-semibold mb-2">Sandbox</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-bold">Free</span>
                </div>
                <p className="text-zinc-400 text-sm mb-8">Perfect for testing integrations and small campaigns.</p>
                
                <ul className="space-y-4 mb-8 flex-1">
                  <li className="flex items-center gap-3 text-sm text-zinc-300">
                    <CheckCircle2 className="w-5 h-5 text-indigo-500" />
                    100 leads / month
                  </li>
                  <li className="flex items-center gap-3 text-sm text-zinc-300">
                    <CheckCircle2 className="w-5 h-5 text-indigo-500" />
                    Basic routing engine
                  </li>
                  <li className="flex items-center gap-3 text-sm text-zinc-300">
                    <CheckCircle2 className="w-5 h-5 text-indigo-500" />
                    Standard support
                  </li>
                </ul>
                <button
                  onClick={handleCtaClick}
                  className="w-full py-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-medium transition-colors border border-zinc-700"
                >
                  Start Building
                </button>
              </div>

              {/* Pro */}
              <div className="p-8 rounded-2xl bg-zinc-950 border-2 border-indigo-500 relative transform md:-translate-y-4 shadow-2xl flex flex-col">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-indigo-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                  Most Popular
                </div>
                <h3 className="text-xl font-semibold mb-2 text-indigo-400">Pro Broker</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-bold">$99</span>
                  <span className="text-zinc-500">/mo</span>
                </div>
                <p className="text-zinc-400 text-sm mb-8">For established brokers moving serious volume.</p>
                
                <ul className="space-y-4 mb-8 flex-1">
                  <li className="flex items-center gap-3 text-sm text-zinc-300">
                    <CheckCircle2 className="w-5 h-5 text-indigo-500" />
                    10,000 leads / month
                  </li>
                  <li className="flex items-center gap-3 text-sm text-zinc-300">
                    <CheckCircle2 className="w-5 h-5 text-indigo-500" />
                    Priority webhook queues
                  </li>
                  <li className="flex items-center gap-3 text-sm text-zinc-300">
                    <CheckCircle2 className="w-5 h-5 text-indigo-500" />
                    Custom JSON mapping
                  </li>
                </ul>
                <button
                  onClick={handleCtaClick}
                  className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors shadow-[0_0_15px_rgba(79,70,229,0.4)]"
                >
                  Get Started
                </button>
              </div>

              {/* Enterprise */}
              <div className="p-8 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-col">
                <h3 className="text-xl font-semibold mb-2">Enterprise Network</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-bold">Custom</span>
                </div>
                <p className="text-zinc-400 text-sm mb-8">For high-throughput affiliate networks.</p>
                
                <ul className="space-y-4 mb-8 flex-1">
                  <li className="flex items-center gap-3 text-sm text-zinc-300">
                    <CheckCircle2 className="w-5 h-5 text-indigo-500" />
                    Unlimited routing
                  </li>
                  <li className="flex items-center gap-3 text-sm text-zinc-300">
                    <CheckCircle2 className="w-5 h-5 text-indigo-500" />
                    Dedicated connection pools
                  </li>
                  <li className="flex items-center gap-3 text-sm text-zinc-300">
                    <CheckCircle2 className="w-5 h-5 text-indigo-500" />
                    White-glove setup & SLA
                  </li>
                </ul>
                <button className="w-full py-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-medium transition-colors border border-zinc-700">
                  Contact Sales
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-zinc-900 text-center text-zinc-500 text-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-zinc-600" />
            <span>© 2026 FlowAPI. All rights reserved.</span>
          </div>
          <div className="flex gap-6">
            <a href="/terms" className="hover:text-zinc-300 transition-colors">Terms</a>
            <a href="/privacy" className="hover:text-zinc-300 transition-colors">Privacy</a>
            <a href="/docs" className="hover:text-zinc-300 transition-colors">Docs</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
