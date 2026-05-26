import { BookOpen, Info, Sparkles, Code, ArrowUpCircle } from "lucide-react";

const TUTORIAL_STEPS = [
  {
    step: 1,
    title: "The Sandbox (Free)",
    accent: "cyan",
    description: "Generate a webhook, paste it into your third-party app (e.g., GoHighLevel), and use the 'Test Ping' lightning bolt button to verify the connection. FlowAPI operates as a zero-retention conduit on the Free tier.",
    tip: "You can run FlowAPI alongside Zapier during a transition period. Use the Sandbox to test payloads without affecting production.",
    hasUpgrade: false,
  },
  {
    step: 2,
    title: "Lead Ledger (Basic)",
    accent: "amber",
    description: "Upgrading to Basic unlocks the Lead Ledger. This gives you full visibility into the raw JSON payloads and tracks your 'Tax Avoided' ROI by visualizing exactly what FlowAPI catches and forwards.",
    tip: "With the Lead Ledger, you no longer have to guess what data is passing through. Inspect headers, payloads, and delivery status in real time.",
    hasUpgrade: true,
    upgradeTier: "Basic",
  },
  {
    step: 3,
    title: "Advanced Headers (Pro)",
    accent: "violet",
    description: "Pro architects gain access to the 'Advanced Headers' vault. Inject static tokens (e.g., Authorization: Bearer <token>) to connect directly to secure CRMs—the industry standard for agency routing.",
    tip: "By injecting tokens server-side, you keep your credentials out of client-side payloads, preventing credential leakage.",
    codeSnippet: '{\n  "Authorization": "Bearer YOUR_SECURE_TOKEN",\n  "X-Custom-Routing-Key": "agency_123"\n}',
    hasUpgrade: true,
    upgradeTier: "Pro",
  },
  {
    step: 4,
    title: "BullMQ Auto-Retry Engine (Plus)",
    accent: "emerald",
    description: "Plus users never lose leads. The system utilizes the Meta Handshake and a BullMQ Auto-Retry Engine with exponential backoff to fight through CRM outages and guarantee delivery.",
    tip: "If a downstream webhook returns a 500 error, FlowAPI queues the job and retries automatically. Your data is resilient against external downtime.",
    hasUpgrade: true,
    upgradeTier: "Plus",
  },
];

const tutorialAccents = {
  cyan: {
    border: "border-cyan-500/30",
    bg: "bg-cyan-500/[0.06]",
    text: "text-cyan-400",
    num: "bg-cyan-500/15 text-cyan-400",
    tipBorder: "border-cyan-500/20",
    tipBg: "bg-cyan-500/[0.03]",
  },
  amber: {
    border: "border-amber-500/30",
    bg: "bg-amber-500/[0.06]",
    text: "text-amber-400",
    num: "bg-amber-500/15 text-amber-400",
    tipBorder: "border-amber-500/20",
    tipBg: "bg-amber-500/[0.03]",
  },
  violet: {
    border: "border-violet-500/30",
    bg: "bg-violet-500/[0.06]",
    text: "text-violet-400",
    num: "bg-violet-500/15 text-violet-400",
    tipBorder: "border-violet-500/20",
    tipBg: "bg-violet-500/[0.03]",
  },
  emerald: {
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/[0.06]",
    text: "text-emerald-400",
    num: "bg-emerald-500/15 text-emerald-400",
    tipBorder: "border-emerald-500/20",
    tipBg: "bg-emerald-500/[0.03]",
  },
};

export default function SetupTutorial({ onOpenFeatures, setActiveTab }) {
  return (
    <section className="space-y-6 animate-fade-in w-full max-w-4xl mx-auto">
      {/* Section header */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-slate-500" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">
              Setup & Quick Start
            </h2>
          </div>
          <button 
            onClick={onOpenFeatures}
            className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-400 transition-opacity hover:opacity-80"
          >
            <Info className="h-3.5 w-3.5" />
            System Features
          </button>
        </div>
        <p className="text-sm text-slate-400 leading-relaxed max-w-2xl">
          Route your GoHighLevel leads through FlowAPI’s zero-retention scoring engine. Follow these progressive tiers to unlock enterprise routing capabilities.
        </p>
      </div>

      {/* Steps */}
      <div className="space-y-6">
        {TUTORIAL_STEPS.map((item) => {
          const a = tutorialAccents[item.accent];
          return (
            <div
              key={item.step}
              className={`group rounded-2xl border ${a.border} ${a.bg} p-6 transition-all duration-300 shadow-sm`}
            >
              <div className="flex flex-col md:flex-row gap-5">
                {/* Step number */}
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${a.num} font-mono text-xl font-extrabold`}>
                    {item.step}
                  </div>
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col md:flex-row md:items-center justify-between mb-3 gap-2">
                    <h3 className={`text-lg font-bold ${a.text}`}>
                      {item.title}
                    </h3>
                    
                    {item.hasUpgrade && (
                      <button 
                        onClick={() => setActiveTab && setActiveTab("pricing")}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${a.border} text-xs font-semibold ${a.text} hover:bg-white/5 transition-colors shrink-0`}
                      >
                        <ArrowUpCircle className="w-3.5 h-3.5" />
                        Upgrade Workspace
                      </button>
                    )}
                  </div>
                  
                  <div className="prose prose-invert prose-sm max-w-none text-slate-300 leading-relaxed mb-4">
                    <p>{item.description}</p>
                  </div>

                  {item.codeSnippet && (
                    <div className="mb-4 rounded-xl border border-slate-700/50 bg-slate-900/80 p-4 relative overflow-hidden">
                      <div className="absolute top-0 right-0 px-3 py-1 bg-slate-800/50 border-b border-l border-slate-700/50 rounded-bl-lg text-[10px] text-slate-400 font-mono">
                        JSON
                      </div>
                      <Code className={`h-4 w-4 absolute top-4 left-4 ${a.text} opacity-50`} />
                      <pre className="text-xs font-mono text-slate-300 ml-6 overflow-x-auto">
                        <code>{item.codeSnippet}</code>
                      </pre>
                    </div>
                  )}

                  {/* Pro tip */}
                  <div className={`rounded-xl border ${a.tipBorder} ${a.tipBg} px-4 py-3 mt-4`}>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Sparkles className={`h-3.5 w-3.5 ${a.text}`} />
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${a.text} opacity-80`}>
                        Platform Strategy
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-400">
                      {item.tip}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom CTA */}
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-6 text-center mt-8">
        <p className="text-sm font-semibold text-emerald-400 mb-2">
          Ready to deploy?
        </p>
        <p className="text-xs text-slate-400 mb-4">
          Switch to your Billing console to unlock advanced routing, or head to the Dashboard to create a sandbox webhook.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => setActiveTab && setActiveTab("pricing")} className="px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/20 transition-colors">
            View Tiers
          </button>
          <button onClick={() => setActiveTab && setActiveTab("dashboard")} className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition-colors">
            Go to Dashboard
          </button>
        </div>
      </div>
    </section>
  );
}
