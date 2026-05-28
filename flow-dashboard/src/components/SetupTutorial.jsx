import { BookOpen, Info, Sparkles, Code, ArrowUpCircle } from "lucide-react";

const TUTORIAL_STEPS = [
  {
    step: 1,
    title: "1. Forge Your API Key",
    accent: "cyan",
    description: "Generate a cryptographically secure flow_live_ API key. This is your authentication token. You will provide this key to your lead source (or enter it into your inbound sending system) to authorize traffic into the gateway.",
    tip: "Keep your keys vaulted. All inbound POST requests to /api/v1/leads/inbound must include this token in the Authorization: Bearer header.",
    hasUpgrade: false,
  },
  {
    step: 2,
    title: "2. Map Your Destinations",
    accent: "amber",
    description: "Tell the Smart Dispatcher where to route your data. Navigate to the Destinations tab to lock in the target webhook URLs (e.g., your buyer's CRM).",
    tip: "You can apply Daily Caps to throttle ingestion, and our system automatically filters out invalid URLs to prevent SSRF attacks.",
    hasUpgrade: false,
  },
  {
    step: 3,
    title: "3. Fire Webhooks & Monitor the Ledger",
    accent: "violet",
    description: "Once your source and destination are connected, start sending traffic. The gateway will automatically authenticate, rate-limit, and dispatch the payloads.",
    tip: "Use the Live Dashboard and Analytics tabs to inspect raw JSON payloads, monitor delivery statuses, and track your active Redis queues in real-time.",
    hasUpgrade: false,
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
          Route your inbound leads through FlowAPI's secure, low-latency API gateway. Follow these three steps to establish authorization and dispatch rules.
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
          Head to the API Keys tab to generate your authorization tokens, or map your first destination to start routing leads.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => setActiveTab && setActiveTab("sandbox")} className="px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/20 transition-colors">
            Manage API Keys
          </button>
          <button onClick={() => setActiveTab && setActiveTab("destinations")} className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition-colors">
            Manage Destinations
          </button>
        </div>
      </div>
    </section>
  );
}
