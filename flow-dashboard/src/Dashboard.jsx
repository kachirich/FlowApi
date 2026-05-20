import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Terminal,
  Zap,
  Database,
  Server,
  BrainCircuit,
  Loader2,
  CheckCircle2,
  GitBranch,
  Mail,
  Phone,
  LogOut,
  Shield,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  X,
  Webhook,
  Key,
  Copy,
  ClipboardCheck,
  DollarSign,
  Link2,
  Plus,
  BookOpen,
  LayoutDashboard,
  ChevronDown,
  ShieldAlert,
  Ban,
  ExternalLink,
  Save,
  Info,
  AlertTriangle,
  FlaskConical,
  Send,
  Play,
  ChevronLeft,
  ChevronRight,
  Trash2,
  ChevronsUpDown,
  ChevronsDownUp,
} from "lucide-react";

const GATEWAY_URL = "http://localhost:3001";
const STATUS_URL = `${GATEWAY_URL}/api/auth/guest/status`;
const API_BASE = `${GATEWAY_URL}/api/admin`;
const POLL_INTERVAL = 3000;
const STATS_POLL_INTERVAL = 10000;

/* ═══════════════════════════════════════════════════════════════════════════
   Standard GoHighLevel JSON reference payload (for clipboard + Test Sandbox)
   ═══════════════════════════════════════════════════════════════════════════ */
const GHL_STANDARD_SCHEMA = {
  contact_id: "abc123-ghl-contact-id",
  first_name: "Enterprise",
  last_name: "Test",
  email: "ceo@acmecorp.com",
  phone: "+1234567890",
  tags: ["new_lead", "website"],
  source: "FlowAPI Dashboard Test",
  companyName: "Acme Corporation",
  date_added: new Date().toISOString(),
  custom_fields: {
    company: "Acme Corporation",
    deal_value: "5000",
    lead_status: "new",
  },
  location_id: "loc_abc123",
  assigned_to: "user_xyz789",
};

const tourSteps = [
  {
    title: "Welcome to the Gateway",
    copy: "Welcome to the Gateway. This is your central command for routing leads, bypassing Zapier taxes, and protecting your CRM."
  },
  {
    title: "Your Arsenal",
    copy: "Your Arsenal. Generate highly secure, custom endpoints here. Note: 2FA must be enabled to unlock this feature."
  },
  {
    title: "The Testing Ground",
    copy: "The Testing Ground. Map your custom fields and fire live data tests directly into your CRM before going live."
  },
  {
    title: "The Vault",
    copy: "The Vault. Every lead caught by the engine is instantly scored, deduplicated, and logged here for total transparency."
  },
  {
    title: "The Scoreboard",
    copy: "The Scoreboard. Watch your Zapier savings grow and malicious bots get blocked in real-time. You are now live."
  }
];

/* ═══════════════════════════════════════════════════════════════════════════
   Top Panel — Live Pipeline Terminal
   ═══════════════════════════════════════════════════════════════════════════ */

function LivePipeline({ session, polling, stats, isSandbox = false, sandboxStatus = "idle", sandboxScore = null }) {
  const hasMessage = !!session?.ai_welcome_message;
  const hasScore = session?.lead_score != null;

  if (isSandbox) {
    return (
      <section className="overflow-hidden rounded-2xl border border-slate-800/60 bg-surface-raised shadow-xl shadow-black/20 animate-fade-in">
        {/* Terminal title bar */}
        <div className="flex items-center gap-2 border-b border-slate-800/60 bg-surface px-5 py-3">
          <span className="h-3 w-3 rounded-full bg-rose-500/80" />
          <span className="h-3 w-3 rounded-full bg-amber-500/80" />
          <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
          <span className="ml-3 font-mono text-xs text-slate-500">
            pipeline_output — sandbox
          </span>
          {sandboxStatus === "loading" && (
            <span className="ml-auto flex items-center gap-1.5 text-[11px] text-amber-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
              </span>
              processing
            </span>
          )}
          {sandboxStatus === "success" && (
            <span className="ml-auto flex items-center gap-1.5 text-[11px] text-emerald-400">
              <CheckCircle2 className="h-3 w-3" />
              complete
            </span>
          )}
          {sandboxStatus === "error" && (
            <span className="ml-auto flex items-center gap-1.5 text-[11px] text-rose-400">
              <X className="h-3 w-3" />
              failed
            </span>
          )}
        </div>

        {/* Terminal body */}
        <div className="min-h-[180px] p-6 font-mono text-sm leading-relaxed flex flex-col justify-center">
          {sandboxStatus === "idle" && (
            <div className="flex items-start gap-2.5 text-slate-400 animate-fade-in">
              <span className="text-emerald-400 font-bold">$</span>
              <span>[SYSTEM] Sandbox environment ready. Awaiting test payload execution.</span>
              <span className="animate-pulse text-emerald-400">▌</span>
            </div>
          )}

          {sandboxStatus === "loading" && (
            <div className="flex items-center gap-3 text-amber-300 animate-fade-in">
              <div className="relative h-4 w-4 shrink-0">
                <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-amber-400" />
              </div>
              <span>Routing payload and calculating algorithmic score...</span>
            </div>
          )}

          {sandboxStatus === "success" && (
            <div className="space-y-3 animate-slide-up">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                    Sandbox Execution Status
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-emerald-100">
                  [SUCCESS] Payload routed. Algorithmic Lead Score: <span className="text-emerald-400 font-bold font-mono text-base">{sandboxScore}/100</span>
                </p>
              </div>
            </div>
          )}

          {sandboxStatus === "error" && (
            <div className="space-y-3 animate-slide-up">
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.04] p-4">
                <div className="mb-2 flex items-center gap-2">
                  <X className="h-4 w-4 text-rose-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-rose-400">
                    Execution Error
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-rose-300">
                  [ERROR] Payload routing failed. Please check backend connection.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-800/60 bg-surface-raised shadow-xl shadow-black/20">
      {/* Terminal title bar */}
      <div className="flex items-center gap-2 border-b border-slate-800/60 bg-surface px-5 py-3">
        <span className="h-3 w-3 rounded-full bg-rose-500/80" />
        <span className="h-3 w-3 rounded-full bg-amber-500/80" />
        <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
        <span className="ml-3 font-mono text-xs text-slate-500">
          pipeline_output — live
        </span>
        {polling && !hasMessage && (
          <span className="ml-auto flex items-center gap-1.5 text-[11px] text-amber-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
            </span>
            polling
          </span>
        )}
        {hasMessage && (
          <span className="ml-auto flex items-center gap-1.5 text-[11px] text-emerald-400">
            <CheckCircle2 className="h-3 w-3" />
            complete
          </span>
        )}
      </div>

      {/* Terminal body */}
      <div className="min-h-[180px] p-6 font-mono text-sm leading-relaxed">
        {!session && stats.totalLeads === 0 && stats.botsBlocked === 0 ? (
          <div className="flex text-slate-500">
            <span className="text-emerald-400 mr-2">$</span> <span className="animate-pulse">_</span>
          </div>
        ) : (
          <>
            {session && (
              <>
                <div className="mb-3 text-slate-500">
                  <span className="text-emerald-400">$</span> session.status()
                </div>
              </>
            )}

        {session && !hasMessage && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-slate-400">
              <span className="text-cyan-400">→</span> session_id:{" "}
              <span className="text-slate-300">
                {session.session_id?.slice(0, 16)}…
              </span>
              <button
                title="Copy Session ID"
                onClick={() => navigator.clipboard.writeText(session.session_id)}
                className="ml-1 text-slate-600 transition-colors hover:text-cyan-400"
              >
                <Copy className="h-3 w-3" />
              </button>
            </div>
            <div className="text-slate-400">
              <span className="text-cyan-400">→</span> lead_score:{" "}
              <span className="text-slate-500 italic">null</span>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <div className="relative h-5 w-5">
                <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-violet-400" />
              </div>
              <span className="text-violet-300">
                Waiting for AI enrichment…
              </span>
              <span className="animate-pulse text-violet-400">▌</span>
            </div>
          </div>
        )}

        {session && hasMessage && (
          <div className="space-y-3 animate-slide-up">
            <div className="flex items-center gap-1.5 text-slate-400">
              <span className="text-cyan-400">→</span> session_id:{" "}
              <span className="text-slate-300">
                {session.session_id?.slice(0, 16)}…
              </span>
              <button
                title="Copy Session ID"
                onClick={() => navigator.clipboard.writeText(session.session_id)}
                className="ml-1 text-slate-600 transition-colors hover:text-cyan-400"
              >
                <Copy className="h-3 w-3" />
              </button>
            </div>
            {hasScore && (
              <div className="text-slate-400">
                <span className="text-cyan-400">→</span> lead_score:{" "}
                <span className="text-emerald-400 font-semibold">
                  {session.lead_score}
                </span>
              </div>
            )}
            <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
              <div className="mb-2 flex items-center gap-2">
                <Terminal className="h-4 w-4 text-emerald-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                  System Status
                </span>
              </div>
              <p className="text-sm leading-relaxed text-emerald-100">
                [SYSTEM] FlowAPI Gateway active. Listening for payloads...
              </p>
            </div>
          </div>
        )}

        {/* ── Dual-State Live Logs ─────────────────────────────────────── */}
        {(stats.totalLeads > 0 || stats.botsBlocked > 0) && (
          <div className={`space-y-1.5 ${session ? "mt-5 border-t border-slate-800/40 pt-4" : ""}`}>
            <div className="text-slate-600 text-[10px] font-semibold uppercase tracking-widest mb-2">
              Recent Activity
            </div>

            {/* Success entries */}
            {stats.totalLeads > 0 && (
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-emerald-400">[200 OK]</span>
                <span className="text-xs text-emerald-300/80">Lead Vaulted</span>
                <span className="text-slate-600">|</span>
                <span className="text-xs text-emerald-400/60">Payload routed to destination</span>
                <span className="text-slate-600">|</span>
                <span className="text-xs text-emerald-400/60">Zapier Tax Avoided: $0.05</span>
              </div>
            )}
            {stats.totalLeads > 1 && (
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-emerald-400">[200 OK]</span>
                <span className="text-xs text-emerald-300/80">Lead Vaulted</span>
                <span className="text-slate-600">|</span>
                <span className="text-xs text-emerald-400/60">Payload routed to destination</span>
                <span className="text-slate-600">|</span>
                <span className="text-xs text-emerald-400/60">Zapier Tax Avoided: $0.05</span>
              </div>
            )}

            {/* Blocked entries */}
            {stats.botsBlocked > 0 && (
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-rose-400">[429 BLOCKED]</span>
                <span className="text-xs text-rose-300/80">Spam Shield Triggered</span>
                <span className="text-slate-600">|</span>
                <span className="text-xs text-rose-400/60">Malicious IP Dropped</span>
              </div>
            )}
          </div>
        )}
          </>
        )}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Deep Dive Modal Content — "Techniques Behind the Build"
   ═══════════════════════════════════════════════════════════════════════════ */

const DEEP_DIVE_CONTENT = {
  auth: {
    title: "Secure Lead Vault — Deep Dive",
    subtitle: "How It Protects Your Data",
    bullets: [
      "Emails are one-way hashed with industry-standard encryption before storage — the raw address is never persisted, mitigating PII exposure on breach.",
      "Session IDs are 64-byte hex strings derived from cryptographic random generators, providing 256 bits of entropy per token.",
      "Auth tokens are signed with HS256 using a 256-bit secret rotated via environment variables. Tokens embed the session_id as the sole claim, keeping payloads small.",
      "The lead vault stores guest sessions with a UNIQUE constraint on session_id and a B-Tree index for O(log n) lookups during polling.",
      "Connection pooling (max 10, idle timeout 30s) prevents connection exhaustion under concurrent guest registrations.",
      "All database mutations are wrapped in try/catch with centralized error logging — failures return a generic 500 to avoid leaking schema details.",
    ],
  },
  gateway: {
    title: "High-Speed API Gateway — Deep Dive",
    subtitle: "How It Protects Your Data",
    bullets: [
      "A layered middleware stack processes every request: Security Headers → CORS → Rate Limiter → JSON Parser → Routes.",
      "11 security headers are set by default including Content-Security-Policy, Strict-Transport-Security, and X-Content-Type-Options.",
      "Rate limiting uses a sliding window algorithm (configurable via env vars): default 100 req/15 min per IP, with IETF draft-7 standard headers.",
      "CORS is configured to whitelist only authorized origins, with explicit methods and headers — no wildcard origins in production.",
      "JWT authentication middleware intercepts protected routes, verifies token signatures, and injects the decoded session_id for downstream handlers.",
      "Centralized 404 catch-all returns structured JSON errors with the original HTTP method and path for easier client-side debugging.",
    ],
  },
  ghl: {
    title: "GoHighLevel Integration — Deep Dive",
    subtitle: "How It Protects Your Data",
    bullets: [
      "The webhook endpoint receives GoHighLevel CRM data, accepting { first_name, last_name, email } payloads over JSON.",
      "Incoming payloads are validated field-by-field — missing any required field returns a 400 with explicit messaging about which fields are absent.",
      "Dynamic rate limiting is applied at the gateway layer, enforcing per-IP throttling for real-world webhook flood protection.",
      "The endpoint sits behind API key authentication middleware, ensuring only authorized services can push lead data.",
      "Payload structure mirrors GHL's Contact webhook schema to enable a seamless swap to the real GHL API in production without refactoring.",
      "High-visibility logging provides immediate terminal feedback during local development and demos.",
    ],
  },
  agentic: {
    title: "Intelligent Routing Engine — Deep Dive",
    subtitle: "How It Protects Your Data",
    bullets: [
      "The routing engine receives leads via an inbound webhook trigger, parsing the JSON body and passing it through a multi-node enrichment pipeline.",
      "AI is prompted with a structured system instruction to produce a lead score (0-100) and a personalized welcome message in a single API call.",
      "The AI response is parsed and written back to the Secure Lead Vault, updating the guest session matching the session_id.",
      "The dashboard polls for status every 3 seconds using the stored auth token. Once the AI message is ready, polling stops and the message types out.",
      "Error boundaries in the workflow catch AI provider failures and write a fallback message, ensuring the dashboard never hangs indefinitely.",
      "The entire loop — from guest registration to AI response displayed — completes in under 8 seconds on average, demonstrating real-time orchestration.",
    ],
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   Deep Dive Modal Component
   ═══════════════════════════════════════════════════════════════════════════ */

function DeepDiveModal({ cardId, accent, onClose }) {
  const content = DEEP_DIVE_CONTENT[cardId];
  const accentStyles = cardAccents[accent];

  // Close on Escape key
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!content) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" />

      {/* Modal */}
      <div
        className="relative z-10 w-full max-w-2xl animate-modal-in overflow-hidden rounded-2xl border border-slate-700/60 bg-surface-raised shadow-2xl shadow-black/40"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800/60 p-6 pb-4">
          <div>
            <p className={`mb-1 text-[10px] font-bold uppercase tracking-widest ${accentStyles.iconText}`}>
              {content.subtitle}
            </p>
            <h3 className="text-lg font-bold text-slate-100">
              {content.title}
            </h3>
          </div>
          <button
            id={`modal-close-${cardId}`}
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto p-6">
          <ul className="space-y-4">
            {content.bullets.map((bullet, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed">
                <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${accentStyles.iconBg} ring-2 ${accentStyles.iconText.replace('text-', 'ring-')}/30`} />
                <span className="text-slate-300">{bullet}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800/60 px-6 py-4">
          <button
            onClick={onClose}
            className={`w-full rounded-xl py-2.5 text-sm font-semibold transition-all duration-200 ${accentStyles.iconBg} ${accentStyles.iconText} hover:brightness-125`}
          >
            Close Deep Dive
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Middle Panel — The Stack (Architecture Cards) — 4 Card Grid
   ═══════════════════════════════════════════════════════════════════════════ */

const STACK_CARDS = [
  {
    id: "auth",
    icon: Database,
    title: "Secure Lead Vault",
    accent: "emerald",
    description:
      "Encrypted guest session management with one-way email hashing, cryptographic session IDs, and persistent lead storage.",
    tags: ["encryption", "vault", "sessions"],
  },
  {
    id: "gateway",
    icon: Server,
    title: "High-Speed API Gateway",
    accent: "cyan",
    description:
      "Enterprise API gateway with hardened security headers, rate limiting, token-based authentication, and centralized request logging.",
    tags: ["gateway", "auth", "security"],
  },
  {
    id: "ghl",
    icon: Webhook,
    title: "GoHighLevel Integration",
    accent: "amber",
    description:
      "Live CRM webhook receiver with dynamic rate limiting, payload validation, and automatic lead vaulting.",
    tags: ["webhooks", "CRM", "validation"],
  },
  {
    id: "agentic",
    icon: BrainCircuit,
    title: "Intelligent Routing Engine",
    accent: "violet",
    description:
      "Event-driven workflows triggered via webhook, orchestrating AI for real-time lead scoring and personalized welcome messages.",
    tags: ["AI", "routing", "webhooks"],
  },
];

const cardAccents = {
  emerald: {
    iconBg: "bg-emerald-500/10",
    iconText: "text-emerald-400",
    border: "hover:border-emerald-500/30",
    tagBg: "bg-emerald-500/10",
    tagText: "text-emerald-400/80",
    glow: "hover:shadow-[0_0_30px_-8px_rgba(16,185,129,0.15)]",
  },
  cyan: {
    iconBg: "bg-cyan-500/10",
    iconText: "text-cyan-400",
    border: "hover:border-cyan-500/30",
    tagBg: "bg-cyan-500/10",
    tagText: "text-cyan-400/80",
    glow: "hover:shadow-[0_0_30px_-8px_rgba(6,182,212,0.15)]",
  },
  amber: {
    iconBg: "bg-amber-500/10",
    iconText: "text-amber-400",
    border: "hover:border-amber-500/30",
    tagBg: "bg-amber-500/10",
    tagText: "text-amber-400/80",
    glow: "hover:shadow-[0_0_30px_-8px_rgba(245,158,11,0.15)]",
  },
  violet: {
    iconBg: "bg-violet-500/10",
    iconText: "text-violet-400",
    border: "hover:border-violet-500/30",
    tagBg: "bg-violet-500/10",
    tagText: "text-violet-400/80",
    glow: "hover:shadow-[0_0_30px_-8px_rgba(139,92,246,0.15)]",
  },
};

function StackCards({ onCardClick }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section>
      <button
        id="toggle-stack-accordion"
        onClick={() => setExpanded((prev) => !prev)}
        className="mb-4 flex w-full items-center justify-between rounded-xl border border-slate-800/60 bg-surface-raised px-5 py-3.5 transition-all duration-200 hover:border-slate-700/80 hover:bg-surface-overlay group"
      >
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-slate-500" />
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            View Advanced Infrastructure
          </h2>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-slate-500 transition-transform duration-300 ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>

      <div
        className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 overflow-hidden transition-all duration-400 ease-in-out ${
          expanded ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        {STACK_CARDS.map((card) => {
          const a = cardAccents[card.accent];
          return (
            <button
              key={card.id}
              id={`stack-card-${card.id}`}
              onClick={() => onCardClick(card)}
              className={`group cursor-pointer rounded-2xl border border-slate-800/60 bg-surface-raised p-6 text-left transition-all duration-300 ${a.border} ${a.glow}`}
            >
              <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${a.iconBg} transition-transform duration-300 group-hover:scale-110`}>
                <card.icon className={`h-5 w-5 ${a.iconText}`} />
              </div>
              <h3 className="mb-2 text-sm font-semibold text-slate-100">
                {card.title}
              </h3>
              <p className="mb-4 text-xs leading-relaxed text-slate-400">
                {card.description}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {card.tags.map((tag) => (
                  <span
                    key={tag}
                    className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-medium ${a.tagBg} ${a.tagText}`}
                  >
                    {tag}
                  </span>
                ))}
              </div>
              {/* Deep Dive hint */}
              <div className={`mt-4 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest ${a.iconText} opacity-0 transition-opacity duration-300 group-hover:opacity-100`}>
                <span>Deep Dive</span>
                <ArrowRight className="h-3 w-3" />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Webhook Tools Panel — Generator, Zapier Counter, Schema Export
   ═══════════════════════════════════════════════════════════════════════════ */

function DashboardTopActions({ stats, onGenerateWebhook, generatedWebhook, generating, toast, destinationUrl, onDestinationChange, onSaveDestination, savingDestination, onRefreshStats, refreshingStats, onFireTestPayload, hasWebhook }) {
  const [schemaOpen, setSchemaOpen] = useState(false);
  const [webhookOpen, setWebhookOpen] = useState(false);
  const [schemaCopied, setSchemaCopied] = useState(false);
  const [webhookCopied, setWebhookCopied] = useState(false);

  const handleCopySchema = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(GHL_STANDARD_SCHEMA, null, 2));
      setSchemaCopied(true);
      setTimeout(() => setSchemaCopied(false), 2000);
    } catch { /* noop */ }
  };

  const handleCopyWebhook = async () => {
    if (!generatedWebhook) return;
    try {
      await navigator.clipboard.writeText(generatedWebhook.webhookUrl);
      setWebhookCopied(true);
      setTimeout(() => setWebhookCopied(false), 2000);
    } catch { /* noop */ }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-slate-100">Quick Actions</h3>
      </div>

      {/* Interactive Action Elements */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Webhook Action */}
        <div id="tour-webhook-generator" className="relative">
          <button
            onClick={() => { setWebhookOpen(!webhookOpen); setSchemaOpen(false); }}
            className={`w-full flex items-center justify-between rounded-xl border px-5 py-3.5 transition-all duration-200 ${
              webhookOpen ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-400" : "border-slate-700/50 bg-surface-raised hover:border-cyan-500/30 hover:bg-surface-overlay text-slate-200"
            }`}
          >
            <div className="flex items-center gap-3">
              <Link2 className={`h-4 w-4 ${webhookOpen ? "text-cyan-400" : "text-slate-400"}`} />
              <span className="text-sm font-semibold">Webhook Generator</span>
            </div>
            <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${webhookOpen ? "rotate-180" : ""}`} />
          </button>
          
          {/* Dropdown Content */}
          <div className={`overflow-hidden transition-all duration-300 ${webhookOpen ? "max-h-[500px] mt-2 opacity-100" : "max-h-0 opacity-0"}`}>
            <div className="rounded-xl border border-cyan-500/20 bg-surface-raised p-5 shadow-xl">
              <button
                onClick={onGenerateWebhook}
                disabled={generating}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 py-2.5 text-xs font-semibold text-cyan-400 hover:bg-cyan-500/20 transition-colors disabled:opacity-50"
              >
                {generating ? <><Loader2 className="h-3.5 w-3.5 animate-spin"/> Generating...</> : <><Plus className="h-3.5 w-3.5" /> Generate Secure Webhook</>}
              </button>

              {generatedWebhook && (
                <div className="mt-4 space-y-3 animate-fade-in">
                  <div className="rounded border border-rose-500/20 bg-rose-500/10 p-3 flex gap-2">
                    <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-rose-300 leading-relaxed">Save this API key immediately. For security, it will not be displayed again.</p>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1 text-[10px] uppercase text-slate-500 font-semibold tracking-widest">
                      <span>Webhook URL</span>
                      <button onClick={handleCopyWebhook} className="hover:text-cyan-400 flex items-center gap-1">{webhookCopied ? <ClipboardCheck className="h-3 w-3 text-emerald-400"/> : <Copy className="h-3 w-3"/>}</button>
                    </div>
                    <code className="block w-full rounded border border-slate-700/50 bg-slate-900 p-2 font-mono text-[10px] text-slate-300 truncate">
                      {generatedWebhook.webhookUrl}
                    </code>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase text-slate-500 font-semibold tracking-widest mb-1 block">Forward Data To</label>
                    <div className="flex gap-2">
                      <input type="url" value={destinationUrl} onChange={(e) => onDestinationChange(e.target.value)} placeholder="https://..." className="flex-1 rounded border border-slate-700/50 bg-slate-900 px-2 py-1.5 font-mono text-[10px] text-slate-300 outline-none focus:border-cyan-500/40" />
                      <button onClick={onSaveDestination} disabled={savingDestination || !destinationUrl} className="rounded bg-cyan-500/20 px-3 border border-cyan-500/30 text-[10px] font-semibold text-cyan-400 hover:bg-cyan-500/30 disabled:opacity-50">
                        {savingDestination ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Schema Action */}
        <div className="relative">
          <button
            onClick={() => { setSchemaOpen(!schemaOpen); setWebhookOpen(false); }}
            className={`w-full flex items-center justify-between rounded-xl border px-5 py-3.5 transition-all duration-200 ${
              schemaOpen ? "border-violet-500/40 bg-violet-500/10 text-violet-400" : "border-slate-700/50 bg-surface-raised hover:border-violet-500/30 hover:bg-surface-overlay text-slate-200"
            }`}
          >
            <div className="flex items-center gap-3">
              <Webhook className={`h-4 w-4 ${schemaOpen ? "text-violet-400" : "text-slate-400"}`} />
              <span className="text-sm font-semibold">Standard JSON Schema</span>
            </div>
            <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${schemaOpen ? "rotate-180" : ""}`} />
          </button>

          {/* Dropdown Content */}
          <div className={`overflow-hidden transition-all duration-300 ${schemaOpen ? "max-h-[550px] mt-2 opacity-100" : "max-h-0 opacity-0"}`}>
            <div className="rounded-xl border border-violet-500/20 bg-surface-raised p-5 shadow-xl space-y-4">
              <div className="flex gap-3">
                <button
                  onClick={handleCopySchema}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-lg border py-2.5 text-xs font-semibold transition-colors ${schemaCopied ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-violet-500/10 border-violet-500/30 text-violet-400 hover:bg-violet-500/20"}`}
                >
                  {schemaCopied ? <><ClipboardCheck className="h-3.5 w-3.5"/> Copied!</> : <><Copy className="h-3.5 w-3.5" /> Copy Schema</>}
                </button>
                
                <button
                  onClick={onFireTestPayload}
                  disabled={!hasWebhook}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-lg border py-2.5 text-xs font-semibold transition-all ${
                    hasWebhook 
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 animate-pulse" 
                      : "bg-slate-800/40 border-slate-800 text-slate-500 cursor-not-allowed"
                  }`}
                  title={hasWebhook ? "Send simulated lead payload to active webhook" : "Generate a secure webhook first to test"}
                >
                  <Play className="h-3.5 w-3.5" /> Send Test Lead
                </button>
              </div>

              <div className="max-h-[180px] overflow-y-auto rounded border border-slate-700/50 bg-slate-900 p-3">
                <pre className="font-mono text-[10px] text-slate-400 leading-relaxed">
                  {JSON.stringify(GHL_STANDARD_SCHEMA, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border px-5 py-3.5 shadow-xl shadow-black/30 ${
          toast.type === "success" ? "border-emerald-500/30 bg-surface-raised text-emerald-400" : "border-rose-500/30 bg-surface-raised text-rose-400"
        } ${toast.leaving ? "animate-toast-out" : "animate-toast-in"}`}>
          {toast.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <X className="h-4 w-4" />}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   System Features Modal
   ═══════════════════════════════════════════════════════════════════════════ */

const FEATURES = [
  {
    title: "Zero-Retention Privacy",
    accent: "emerald",
    icon: ShieldCheck,
    description:
      "We process your data in memory and instantly drop it. No PII is ever stored on our servers.",
  },
  {
    title: "Algorithmic Lead Scoring",
    accent: "cyan",
    icon: BrainCircuit,
    description:
      "Every lead is instantly graded (0–100) based on domain authority and data completeness.",
  },
  {
    title: "Spam Shield",
    accent: "amber",
    icon: Ban,
    description:
      "Memory-cached rate limiting blocks malicious bot traffic before it hits your CRM.",
  },
  {
    title: "Zapier Tax Bypass",
    accent: "violet",
    icon: DollarSign,
    description:
      "Direct webhook routing saves you per-task automation fees. Keep your margins.",
  },
];

const featureAccents = {
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
  cyan:    { bg: "bg-cyan-500/10",    text: "text-cyan-400",    border: "border-cyan-500/20" },
  amber:   { bg: "bg-amber-500/10",   text: "text-amber-400",   border: "border-amber-500/20" },
  violet:  { bg: "bg-violet-500/10",  text: "text-violet-400",  border: "border-violet-500/20" },
};

function FeaturesModal({ onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" />
      <div
        className="relative z-10 w-full max-w-lg animate-modal-in overflow-hidden rounded-2xl border border-slate-700/60 bg-surface-raised shadow-2xl shadow-black/40"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800/60 p-6 pb-4">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-emerald-400">
              Why FlowAPI
            </p>
            <h3 className="text-lg font-bold text-slate-100">
              System Features
            </h3>
          </div>
          <button
            id="features-modal-close"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Feature cards */}
        <div className="space-y-3 p-6">
          {FEATURES.map((f) => {
            const a = featureAccents[f.accent];
            return (
              <div key={f.title} className={`flex gap-4 rounded-xl border ${a.border} ${a.bg} p-4`}>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${a.bg}`}>
                  <f.icon className={`h-5 w-5 ${a.text}`} />
                </div>
                <div>
                  <h4 className={`text-sm font-semibold ${a.text}`}>{f.title}</h4>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{f.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800/60 px-6 py-4">
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-emerald-500/10 py-2.5 text-sm font-semibold text-emerald-400 transition-all duration-200 hover:brightness-125"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Setup Tutorial — 3-Step Onboarding Guide
   ═══════════════════════════════════════════════════════════════════════════ */

const TUTORIAL_STEPS = [
  {
    step: 1,
    title: "Configure Destination",
    accent: "cyan",
    description:
      'Paste your downstream webhook URL into FlowAPI and click "Generate Webhook". FlowAPI creates a unique, secure ingest URL with a 32-character API key baked in.',
    tip: "FlowAPI uses zero-retention architecture — your lead data is processed in memory and never stored on our servers.",
  },
  {
    step: 2,
    title: "Reroute GoHighLevel",
    accent: "amber",
    description:
      'In your GHL workflow, replace your old Zapier webhook with your new secure FlowAPI URL. All leads will now flow through FlowAPI\'s Spam Shield and Lead Scoring Engine before reaching your destination.',
    tip: "You can run FlowAPI alongside Zapier during a transition period. Once validated, remove Zapier and keep your margins.",
  },
  {
    step: 3,
    title: "Catch & Map",
    accent: "violet",
    description:
      'FlowAPI will intercept the lead, block bots via the Spam Shield, append an AI_Lead_Score (0–100), and instantly forward the clean, enriched payload to your destination webhook.',
    tip: "The enriched payload includes the original GHL fields plus AI_Lead_Score and scored_at timestamp — map them directly in your downstream tool.",
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

function SetupTutorial({ onOpenFeatures }) {
  return (
    <section className="space-y-6 animate-fade-in">
      {/* Section header */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-slate-500" />
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Setup Tutorial
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
          Route your GoHighLevel leads through FlowAPI’s zero-retention scoring engine
          in three simple steps. No data stored, no Zapier fees.
        </p>
      </div>

      {/* Steps */}
      <div className="space-y-4">
        {TUTORIAL_STEPS.map((item) => {
          const a = tutorialAccents[item.accent];
          return (
            <div
              key={item.step}
              className={`group rounded-2xl border ${a.border} ${a.bg} p-6 transition-all duration-300`}
            >
              <div className="flex gap-5">
                {/* Step number */}
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${a.num} font-mono text-lg font-extrabold`}>
                  {item.step}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <h3 className={`mb-2 text-base font-bold ${a.text}`}>
                    {item.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-300">
                    {item.description}
                  </p>

                  {/* Pro tip */}
                  <div className={`mt-4 rounded-xl border ${a.tipBorder} ${a.tipBg} px-4 py-3`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Sparkles className={`h-3 w-3 ${a.text}`} />
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${a.text} opacity-70`}>
                        Pro Tip
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
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-6 text-center">
        <p className="text-sm font-semibold text-emerald-400 mb-1">
          Ready to go?
        </p>
        <p className="text-xs text-slate-400">
          Switch to the Live Dashboard tab to generate your first webhook and start capturing leads.
        </p>
      </div>
    </section>
  );
}



/* ═══════════════════════════════════════════════════════════════════════════
   One-Time Secret Modal
   ═══════════════════════════════════════════════════════════════════════════ */

function OneTimeSecretModal({ webhook, onClose }) {
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const copyKey = async () => {
    await navigator.clipboard.writeText(webhook.apiKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const copyUrl = async () => {
    await navigator.clipboard.writeText(webhook.webhookUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-surface p-6 shadow-2xl shadow-rose-500/10 animate-slide-up">
        <div className="mb-4 flex items-center gap-3 border-b border-slate-800/60 pb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-500/10">
            <AlertTriangle className="h-5 w-5 text-rose-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">Secret Generated</h2>
            <p className="text-xs text-rose-400 font-semibold mt-0.5">
              ⚠️ Save this API Key now. For your security, it will never be shown again.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                Raw API Key
              </label>
              <button onClick={copyKey} className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-cyan-400">
                {copiedKey ? <><ClipboardCheck className="h-3 w-3 text-emerald-400" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
              </button>
            </div>
            <code className="block w-full rounded-lg border border-rose-500/20 bg-rose-500/[0.02] p-3 font-mono text-[11px] text-rose-300 break-all">
              {webhook.apiKey}
            </code>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                Webhook URL
              </label>
              <button onClick={copyUrl} className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-cyan-400">
                {copiedUrl ? <><ClipboardCheck className="h-3 w-3 text-emerald-400" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
              </button>
            </div>
            <code className="block w-full rounded-lg border border-slate-700/50 bg-surface p-3 font-mono text-[11px] text-slate-300 break-all">
              {webhook.webhookUrl}
            </code>
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-slate-800 py-3 text-sm font-semibold text-slate-200 transition-colors hover:bg-slate-700"
          >
            I have saved my key
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Webhooks Table Component (Smart List)
   ═══════════════════════════════════════════════════════════════════════════ */

function WebhooksTable({ webhooks, onRevoke, isCollapsed, onToggleCollapse, onDeleteAll }) {
  const [expanded, setExpanded] = useState(false);
  const displayWebhooks = expanded ? webhooks : webhooks.slice(0, 5);

  return (
    <div className="rounded-2xl border border-slate-800/60 bg-surface p-6 animate-fade-in mb-6">
      <div className="mb-4 flex items-center justify-between border-b border-slate-800/60 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleCollapse}
            className="p-1 text-slate-500 hover:text-slate-200 transition-colors rounded hover:bg-slate-800"
            title={isCollapsed ? "Expand Webhooks" : "Collapse Webhooks"}
          >
            <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${isCollapsed ? "-rotate-90" : ""}`} />
          </button>
          <h3 className="text-sm font-semibold text-slate-100">
            Active Webhooks & Analytics
          </h3>
        </div>
        <div className="flex items-center gap-3">
          {webhooks.length > 0 && (
            <button
              onClick={onDeleteAll}
              className="flex items-center gap-1 rounded bg-rose-500/10 px-2.5 py-1 text-[10px] font-bold text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-colors"
            >
              <Trash2 className="h-3 w-3" /> Clear Webhooks
            </button>
          )}
          {webhooks.length > 5 && !isCollapsed && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1.5 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              {expanded ? "View Less" : `View All (${webhooks.length})`}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-300 ${expanded ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>
      </div>
      <div className={`overflow-x-auto transition-all duration-300 ${isCollapsed ? "max-h-0 opacity-0" : "max-h-[800px] opacity-100"}`}>
        <table className="w-full text-left text-xs whitespace-nowrap">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400">
              <th className="pb-3 font-semibold px-2">Webhook ID (Masked)</th>
              <th className="pb-3 font-semibold px-2">Destination URL</th>
              <th className="pb-3 font-semibold text-emerald-400 px-2">Clean Leads (Success)</th>
              <th className="pb-3 font-semibold text-rose-400 px-2">Bots Blocked (Failed)</th>
              <th className="pb-3 font-semibold text-right px-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {displayWebhooks.map((wh) => (
              <tr key={wh.id} className="transition-colors hover:bg-slate-800/20">
                <td className="py-3 px-2 font-mono text-[11px] text-amber-400/70">{wh.masked_key}</td>
                <td className="py-3 px-2 font-mono text-[11px] max-w-[200px] truncate" title={wh.destination_url}>{wh.destination_url || "—"}</td>
                <td className="py-3 px-2 text-emerald-400/90 font-medium">{wh.total_success}</td>
                <td className="py-3 px-2 text-rose-400/90 font-medium">{wh.total_blocked}</td>
                <td className="py-3 px-2 text-right">
                  <button
                    onClick={() => onRevoke(wh.id)}
                    className="rounded bg-rose-500/10 px-2 py-1 text-[10px] font-semibold text-rose-400 transition-colors hover:bg-rose-500/20"
                  >
                    Revoke
                  </button>
                </td>
              </tr>
            ))}
            {webhooks.length === 0 && (
              <tr>
                <td colSpan="5" className="py-8 text-center text-slate-500 italic">
                  No active webhooks. Generate one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Lead Ledger Component
   ═══════════════════════════════════════════════════════════════════════════ */

function LeadLedger({ leads, isCollapsed, onToggleCollapse, onDeleteAll, onRefire }) {
  return (
    <div id="tour-lead-ledger" className="rounded-2xl border border-slate-800/60 bg-surface p-6 animate-fade-in">
      <div className="mb-4 flex items-center justify-between border-b border-slate-800/60 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleCollapse}
            className="p-1 text-slate-500 hover:text-slate-200 transition-colors rounded hover:bg-slate-800"
            title={isCollapsed ? "Expand Ledger" : "Collapse Ledger"}
          >
            <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${isCollapsed ? "-rotate-90" : ""}`} />
          </button>
          <h3 className="text-sm font-semibold text-slate-100">
            Lead Ledger (Vaulted Records)
          </h3>
        </div>
        {leads.length > 0 && (
          <button
            onClick={onDeleteAll}
            className="flex items-center gap-1 rounded bg-rose-500/10 px-2.5 py-1 text-[10px] font-bold text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-colors"
          >
            <Trash2 className="h-3 w-3" /> Clear Ledger
          </button>
        )}
      </div>
      <div className={`overflow-x-auto transition-all duration-300 ${isCollapsed ? "max-h-0 opacity-0" : "max-h-[800px] opacity-100"}`}>
        <table className="w-full text-left text-xs whitespace-nowrap">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400">
              <th className="pb-3 font-semibold px-2">Timestamp</th>
              <th className="pb-3 font-semibold px-2">Lead Email</th>
              <th className="pb-3 font-semibold px-2">Source Webhook</th>
              <th className="pb-3 font-semibold px-2">Score</th>
              <th className="pb-3 font-semibold px-2">Delivery Status</th>
              <th className="pb-3 font-semibold text-right px-2">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {leads.map((lead) => {
              const score = lead.lead_score ?? 0;
              let badgeColor = "bg-rose-500/10 text-rose-400 border-rose-500/20";
              if (score >= 80) badgeColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
              else if (score >= 50) badgeColor = "bg-amber-500/10 text-amber-400 border-amber-500/20";
              
              const deliveryStatus = lead.deliveryStatus || 'PENDING';
              let deliveryBadgeColor = "";
              if (deliveryStatus === 'DELIVERED') {
                deliveryBadgeColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-glow";
              } else if (deliveryStatus === 'FAILED') {
                deliveryBadgeColor = "bg-rose-500/10 text-rose-450 border-rose-500/20 shadow-glow-rose";
              } else {
                deliveryBadgeColor = "bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-glow-amber";
              }

              return (
                <tr key={lead.id} className="transition-colors hover:bg-slate-800/20">
                  <td className="py-3 px-2 font-mono text-[11px] text-slate-500">
                    {new Date(lead.created_at).toLocaleString()}
                  </td>
                  <td className="py-3 px-2 font-medium">
                    {lead.email || "—"}
                  </td>
                  <td className="py-3 px-2 font-mono text-[11px] text-slate-400">
                    {lead.source_webhook || "Direct API / System"}
                  </td>
                  <td className="py-3 px-2">
                    <span className={`inline-flex items-center justify-center rounded-md border px-2 py-0.5 font-mono text-[10px] font-bold ${badgeColor}`}>
                      {score}/100
                    </span>
                  </td>
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-flex items-center justify-center rounded-md border px-2 py-0.5 font-mono text-[10px] font-bold ${deliveryBadgeColor}`}>
                        {deliveryStatus}
                      </span>
                      {deliveryStatus === 'FAILED' && lead.lastDeliveryError && (
                        <span 
                          className="text-rose-400 hover:text-rose-350 cursor-help"
                          title={lead.lastDeliveryError}
                        >
                          <Info className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-2 text-right">
                    {deliveryStatus === 'FAILED' ? (
                      <button
                        onClick={() => onRefire && onRefire(lead.id)}
                        className="inline-flex items-center gap-1 rounded bg-amber-500/10 border border-amber-500/25 text-amber-400 hover:bg-amber-500/20 px-2 py-1 text-[9px] font-bold uppercase transition"
                        title="Manually re-fire webhook"
                      >
                        <RefreshCw className="h-2.5 w-2.5" /> Re-fire
                      </button>
                    ) : (
                      <span className="text-slate-600 text-[10px]">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {leads.length === 0 && (
              <tr>
                <td colSpan="6" className="py-8 text-center text-slate-500 italic">
                  No vaulted leads yet. Waiting for incoming data.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Test Sandbox — Isolated Payload Testing Environment
   ═══════════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════════
   Destination Sandbox & Egress Test Engine
   ═══════════════════════════════════════════════════════════════════════════ */

function EgressTester({ leads }) {
  const [destinationUrl, setDestinationUrl] = useState("https://services.leadconnectorhq.com/hooks/flow_egress_test");
  const [mappings, setMappings] = useState({
    firstName: "first_name",
    lastName: "last_name",
    email: "email",
    phone: "phone",
  });
  const [sending, setSending] = useState(false);
  const [log, setLog] = useState(null);
  const [showRawTraceDrawer, setShowRawTraceDrawer] = useState(false);

  // Auto-dismiss the raw trace pop-up drawer after 10 seconds
  useEffect(() => {
    let timer;
    if (showRawTraceDrawer) {
      timer = setTimeout(() => {
        setShowRawTraceDrawer(false);
      }, 10000);
    }
    return () => clearTimeout(timer);
  }, [showRawTraceDrawer]);

  // Aggregate and format raw destination error/trace logs
  const getRawTraceString = () => {
    if (!log) return "";
    if (log.responseText) {
      try {
        return JSON.stringify(JSON.parse(log.responseText), null, 2);
      } catch {
        return log.responseText;
      }
    }
    if (log.error) {
      return JSON.stringify({ error: log.error }, null, 2);
    }
    return JSON.stringify({ message: "Unknown dispatch error" }, null, 2);
  };

  // Translates HTTP status codes into user-friendly actionable messages
  const getTranslationMessage = (log) => {
    if (!log || log.success) return null;
    const status = log.statusCode;
    if (status === 404) {
      return "Destination URL not found. Please verify you pasted the exact GoHighLevel webhook link and that it is currently active.";
    }
    if (status === 400) {
      return "The destination rejected the payload. Check your JSON mapping to ensure all required fields match their expectations.";
    }
    if (status === 401 || status === 403) {
      return "Access denied by destination. Check if your target URL requires a specific API key or authentication header.";
    }
    if (status >= 500) {
      return "The destination server is currently failing to process requests. This is an issue on their end.";
    }
    return "Dispatch failed. Review the raw response log below for details.";
  };

  // Grab the most recently vaulted lead or a fallback dummy lead
  const activeLead = leads.length > 0 ? leads[0] : {
    first_name: "Antigravity",
    last_name: "Test",
    email: "antigravity@testcompany.com",
    phone: "+1234567890",
  };

  // Dynamically compute the mapped egress payload preview
  const egressPayload = {
    [mappings.firstName]: activeLead.first_name || activeLead.firstName || "",
    [mappings.lastName]: activeLead.last_name || activeLead.lastName || "",
    [mappings.email]: activeLead.email || "",
    [mappings.phone]: activeLead.phone || "",
  };

  const handleFireEgress = async () => {
    if (!destinationUrl) {
      alert("Please provide a Destination URL.");
      return;
    }
    setSending(true);
    setLog(null);

    const token = localStorage.getItem("flow_token");
    try {
      const res = await fetch(`${API_BASE}/egress-test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          destinationUrl,
          payload: egressPayload,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setLog(data);
      } else {
        setLog({
          success: false,
          error: data.message || `Outbound HTTP error status: ${res.status}`,
        });
      }
    } catch (err) {
      setLog({
        success: false,
        error: err.message || "Network error firing egress payload",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-2">
        <FlaskConical className="h-4 w-4 text-amber-400" />
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Destination Sandbox & Egress Tester
        </h2>
      </div>

      <p className="text-sm text-slate-400 leading-relaxed max-w-3xl">
        Map FlowAPI internal schema properties to your destination's expected keys and test outbound synchronization. 
        Local sandbox executions are secure and bypass CORS restrictions.
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left Column: Destination Configuration */}
        <div className="space-y-5 rounded-2xl border border-slate-800 bg-surface-raised p-5 shadow-xl">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Downstream Integration Setup
          </h3>

          {/* Destination URL Field */}
          <div className="space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Destination Webhook URL (e.g. GoHighLevel)
            </label>
            <input
              type="url"
              value={destinationUrl}
              onChange={(e) => setDestinationUrl(e.target.value)}
              placeholder="https://services.leadconnectorhq.com/hooks/..."
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 font-mono text-xs text-slate-200 focus:border-amber-500 focus:outline-none transition"
            />
          </div>

          {/* Key-Value Mapper */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">FlowAPI Property</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Destination JSON Key</span>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center gap-4">
                <span className="flex-1 font-mono text-xs text-slate-300">firstName</span>
                <input
                  type="text"
                  value={mappings.firstName}
                  onChange={(e) => setMappings({ ...mappings, firstName: e.target.value })}
                  className="w-44 rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 font-mono text-xs text-amber-400 focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-4">
                <span className="flex-1 font-mono text-xs text-slate-300">lastName</span>
                <input
                  type="text"
                  value={mappings.lastName}
                  onChange={(e) => setMappings({ ...mappings, lastName: e.target.value })}
                  className="w-44 rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 font-mono text-xs text-amber-400 focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-4">
                <span className="flex-1 font-mono text-xs text-slate-300">email</span>
                <input
                  type="text"
                  value={mappings.email}
                  onChange={(e) => setMappings({ ...mappings, email: e.target.value })}
                  className="w-44 rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 font-mono text-xs text-amber-400 focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-4">
                <span className="flex-1 font-mono text-xs text-slate-300">phone</span>
                <input
                  type="text"
                  value={mappings.phone}
                  onChange={(e) => setMappings({ ...mappings, phone: e.target.value })}
                  className="w-44 rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 font-mono text-xs text-amber-400 focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Action Trigger */}
          <button
            onClick={handleFireEgress}
            disabled={sending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-950 hover:bg-amber-400 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-500/10"
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
                Executing Egress Synchronization...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 text-slate-950" />
                Fire Test to Destination
              </>
            )}
          </button>
        </div>

        {/* Right Column: Outgoing Payload and Egress Logs */}
        <div className="flex flex-col gap-5">
          {/* Payload Preview Card */}
          <div className="rounded-2xl border border-slate-800 bg-surface-raised overflow-hidden">
            <div className="flex items-center gap-2 border-b border-slate-800/60 bg-surface px-5 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
              <span className="ml-2 font-mono text-[11px] text-slate-500">outgoing_payload.json</span>
              <span className="ml-auto rounded bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] text-cyan-400 uppercase">
                {leads.length > 0 ? "LEDGER SOURCE" : "DUMMY SOURCE"}
              </span>
            </div>
            <pre className="p-5 font-mono text-[11px] leading-relaxed text-emerald-300 overflow-auto max-h-[160px]">
              {JSON.stringify(egressPayload, null, 2)}
            </pre>
          </div>

          {/* Response log panel */}
          <div className="flex-1 rounded-2xl border border-slate-800 bg-surface overflow-hidden min-h-[220px] flex flex-col">
            <div className="flex items-center gap-2 border-b border-slate-800/60 bg-surface/50 px-5 py-3">
              <span className="font-mono text-[10px] text-slate-500">
                {log && !log.success ? "egress_user_message" : "egress_response_log"}
              </span>
              {log && (
                <span className={`ml-auto rounded px-2 py-0.5 font-mono text-[10px] ${log.success ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                  {log.statusCode ? `STATUS: ${log.statusCode}` : "FAILED"}
                </span>
              )}
            </div>

            <div className="flex-1 p-5 font-mono text-[11px] leading-relaxed text-slate-300 overflow-auto max-h-[300px]">
              {!log && !sending && (
                <div className="text-slate-600">
                  <span>$ egress --await-trigger</span>
                  <span className="animate-pulse ml-1">_</span>
                </div>
              )}

              {sending && (
                <div className="flex items-center gap-3 text-amber-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Outgoing payload dispatched to Gateway routing engine...</span>
                </div>
              )}

              {log && log.success && (
                <div className="space-y-3 animate-fade-in">
                  <div className="text-slate-500">
                    <p className="text-slate-400 font-bold">✔ EGRESS DISPATCH SUCCESS</p>
                    <p className="mt-1">Duration: {log.durationMs || 0}ms</p>
                  </div>

                  {log.responseText !== undefined && (
                    <div className="space-y-1">
                      <span className="text-slate-500 font-bold block text-[10px] uppercase">Destination Response Body:</span>
                      <pre className="rounded-lg bg-slate-900/80 p-3 text-slate-100 overflow-x-auto whitespace-pre-wrap font-mono">
                        {log.responseText || "(Empty body)"}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {log && !log.success && (
                <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-4 text-amber-300 animate-fade-in">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                      <span className="font-bold text-[10px] uppercase tracking-wider text-amber-400">User Message</span>
                    </div>
                    <button
                      onClick={() => setShowRawTraceDrawer(true)}
                      className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800/80 hover:bg-slate-700 px-2 py-1.5 text-[9px] font-semibold text-slate-350 transition-colors shadow-sm"
                      title="View raw destination trace"
                    >
                      <Info className="h-3.5 w-3.5 text-cyan-400" />
                      View Raw Trace
                    </button>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-300">
                    {getTranslationMessage(log)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom-anchored Raw Trace Drawer */}
      {showRawTraceDrawer && log && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md w-full rounded-2xl border border-rose-500/30 bg-slate-950 p-5 shadow-2xl shadow-rose-950/20 animate-slide-up">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-rose-400" />
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-rose-450">
                System Error Trace
              </span>
            </div>
            <button
              onClick={() => setShowRawTraceDrawer(false)}
              className="rounded-lg p-1 text-slate-500 hover:bg-slate-900 hover:text-slate-350 transition"
              title="Close trace drawer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          
          <pre className="font-mono text-[10.5px] leading-relaxed text-rose-500 overflow-auto max-h-[200px] bg-rose-950/[0.04] border border-rose-500/10 rounded-lg p-3 scrollbar-thin scrollbar-thumb-rose-950/50">
            {getRawTraceString()}
          </pre>
        </div>
      )}
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Dashboard (Main Export)
   ═══════════════════════════════════════════════════════════════════════════ */

export default function Dashboard() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [polling, setPolling] = useState(true);
  const [sandboxStatus, setSandboxStatus] = useState("idle"); // "idle" | "loading" | "success" | "error"
  const [sandboxScore, setSandboxScore] = useState(null);
  const [activeModal, setActiveModal] = useState(null); // { id, accent }
  const [activeTab, setActiveTab] = useState(() => {
    if (localStorage.getItem("just_registered") === "true") {
      return "tutorial";
    }
    return "dashboard";
  });

  useEffect(() => {
    if (localStorage.getItem("just_registered") === "true") {
      localStorage.removeItem("just_registered");
    }
  }, []);
  const [stats, setStats] = useState({ totalLeads: 0, totalWebhooks: 0, botsBlocked: 0, zapierTaxAvoided: "0.00" });
  const [generatedWebhook, setGeneratedWebhook] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState(null);
  const [destinationUrl, setDestinationUrl] = useState("");
  const [savingDestination, setSavingDestination] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);
  const [leads, setLeads] = useState([]);
  const [webhooks, setWebhooks] = useState([]);
  const [showSecretModal, setShowSecretModal] = useState(false);

  // Enterprise Security & 2FA / Danger Zone states
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [showDangerModal, setShowDangerModal] = useState(false);
  const [twoFactorDetails, setTwoFactorDetails] = useState(null);
  const [twoFactorToken, setTwoFactorToken] = useState("");
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [refreshingStats, setRefreshingStats] = useState(false);
  const [clearingLogs, setClearingLogs] = useState(false);

  // Guided Onboarding & 2FA Gate States
  const [mfaGateInterception, setMfaGateInterception] = useState(false);
  const [tourActive, setTourActive] = useState(false);
  const [currentTourStep, setCurrentTourStep] = useState(0);

  const handleCompleteOnboarding = async () => {
    setTourActive(false);
    setStats((prev) => ({ ...prev, hasCompletedOnboarding: true }));
    const token = localStorage.getItem("flow_token");
    if (!token) return;
    try {
      await fetch(`${API_BASE}/onboarding/complete`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
    } catch { /* noop */ }
  };

  // Advanced UX States
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [webhooksCollapsed, setWebhooksCollapsed] = useState(false);
  const [leadsCollapsed, setLeadsCollapsed] = useState(false);
  const [wipeModal, setWipeModal] = useState(null); // null | 'webhooks' | 'leads'

  /** Show a temporary toast notification. */
  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type, leaving: false });
    setTimeout(() => {
      setToast((prev) => prev && { ...prev, leaving: true });
      setTimeout(() => setToast(null), 300);
    }, 2500);
  }, []);

  /** Poll for guest session status. */
  const fetchStatus = useCallback(async () => {
    const token = localStorage.getItem("flow_token");
    if (!token) return;

    try {
      const res = await fetch(STATUS_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem("flow_token");
          navigate("/login", { replace: true });
        }
        return;
      }

      const data = await res.json();
      setSession(data.session);

      // Stop polling once AI has responded
      if (data.session?.ai_welcome_message) {
        setPolling(false);
      }
    } catch {
      // Silently retry on network errors
    }
  }, [navigate]);

  useEffect(() => {
    fetchStatus(); // initial fetch
    if (!polling) return;

    const interval = setInterval(fetchStatus, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchStatus, polling]);

  /** Fetch admin stats (lead count for Zapier counter). */
  const fetchStats = useCallback(async () => {
    const token = localStorage.getItem("flow_token");
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStats((prev) => ({
          ...data,
          hasCompletedOnboarding: prev?.hasCompletedOnboarding === false ? false : data.hasCompletedOnboarding,
        }));
      }
    } catch { /* retry silently */ }
  }, []);

  /** Dynamic refresh of gateway metrics */
  const handleRefreshStats = useCallback(async () => {
    setRefreshingStats(true);
    try {
      const token = localStorage.getItem("flow_token");
      if (!token) return;

      const res = await fetch(`${API_BASE}/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setStats((prev) => ({
          ...data,
          hasCompletedOnboarding: prev?.hasCompletedOnboarding === false ? false : data.hasCompletedOnboarding,
        }));
        showToast("Gateway metrics updated successfully", "success");
      } else {
        showToast(data.message || "Failed to update metrics", "error");
      }
    } catch {
      showToast("Network error: failed to refresh metrics", "error");
    } finally {
      setRefreshingStats(false);
    }
  }, [showToast]);

  /** Generate 2FA Secret and QR Code Data URL */
  const handleGenerate2FA = async () => {
    setTwoFactorLoading(true);
    try {
      const token = localStorage.getItem("flow_token");
      const res = await fetch(`${GATEWAY_URL}/api/auth/2fa/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok) {
        setTwoFactorDetails({
          qrCodeUrl: data.qrCodeUrl,
          secret: data.secret,
        });
        showToast("2FA Secret key successfully generated", "success");
      } else {
        showToast(data.message || "Failed to generate 2FA key", "error");
      }
    } catch {
      showToast("Network error: failed to generate 2FA key", "error");
    } finally {
      setTwoFactorLoading(false);
    }
  };

  /** Verify and officially activate 2FA for the account */
  const handleEnable2FA = async () => {
    if (!twoFactorToken) {
      showToast("Please enter verification token", "error");
      return;
    }
    setTwoFactorLoading(true);
    try {
      const token = localStorage.getItem("flow_token");
      const res = await fetch(`${GATEWAY_URL}/api/auth/2fa/enable`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ token: twoFactorToken }),
      });
      const data = await res.json();
      if (res.ok) {
        setStats((prev) => ({ ...prev, twoFactorEnabled: true }));
        setTwoFactorDetails(null);
        setTwoFactorToken("");
        showToast("2FA is now fully active for this account", "success");
        if (mfaGateInterception) {
          setShowSecurityModal(false);
          setMfaGateInterception(false);
          handleGenerateWebhook(true);
        }
      } else {
        showToast(data.message || "Invalid validation token", "error");
      }
    } catch {
      showToast("Network error: failed to enable 2FA", "error");
    } finally {
      setTwoFactorLoading(false);
    }
  };

  /** Close the 2FA / Security modal and reset temporary security flow states */
  const handleCloseSecurityModal = useCallback(() => {
    setShowSecurityModal(false);
    setTwoFactorDetails(null);
    setTwoFactorToken("");
    setMfaGateInterception(false);
  }, []);

  /** Reset onboarding state and relaunch the setup tour */
  const handleRelaunchTour = useCallback(() => {
    setStats((prev) => ({ ...prev, hasCompletedOnboarding: false }));
    setActiveTab("dashboard");
    setTourActive(true);
    setCurrentTourStep(0);
  }, []);

  // Get logged in user's email from JWT token
  const userEmail = useMemo(() => {
    const token = localStorage.getItem("flow_token");
    if (!token) return "";
    try {
      const base64Url = token.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
      return JSON.parse(jsonPayload).email || "";
    } catch {
      return "";
    }
  }, []);

  // Handle Escape key press to dismiss the security modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && showSecurityModal) {
        handleCloseSecurityModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showSecurityModal, handleCloseSecurityModal]);

  /** Clear all routing leads and gateway history */
  const handleClearLogs = async () => {
    setClearingLogs(true);
    try {
      const token = localStorage.getItem("flow_token");
      const res = await fetch(`${API_BASE}/logs`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok) {
        setStats((prev) => ({
          ...prev,
          totalLeads: 0,
          botsBlocked: 0,
          zapierTaxAvoided: "0.00",
        }));
        showToast("Gateway analytics logs successfully reset", "success");
        setShowDangerModal(false);
        handleCloseSecurityModal();
      } else {
        showToast(data.message || "Failed to reset stats", "error");
      }
    } catch {
      showToast("Network error: failed to reset gateway statistics", "error");
    } finally {
      setClearingLogs(false);
    }
  };

  /** Wipe all webhooks */
  const handleWipeAllWebhooks = async () => {
    const token = localStorage.getItem("flow_token");
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/webhooks`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showToast("All active webhooks deleted successfully", "success");
        setWebhooks([]);
        setGeneratedWebhook(null);
        fetchStats();
      } else {
        showToast("Failed to delete webhooks", "error");
      }
    } catch {
      showToast("Network error deleting webhooks", "error");
    } finally {
      setWipeModal(null);
    }
  };

  /** Wipe all leads */
  const handleWipeAllLeads = async () => {
    const token = localStorage.getItem("flow_token");
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/leads`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showToast("All Lead Ledger records wiped successfully", "success");
        setLeads([]);
        fetchStats();
      } else {
        showToast("Failed to wipe leads", "error");
      }
    } catch {
      showToast("Network error wiping leads", "error");
    } finally {
      setWipeModal(null);
    }
  };

  /** Manually re-fire a failed lead */
  const handleRefireLead = async (leadId) => {
    const token = localStorage.getItem("flow_token");
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/leads/${leadId}/refire`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "Lead successfully re-queued for delivery", "success");
        fetchLeads();
        fetchStats();
      } else {
        showToast(data.message || "Failed to re-fire lead", "error");
      }
    } catch {
      showToast("Network error re-firing lead", "error");
    }
  };

  /** Fire simulated GoHighLevel schema payload */
  const handleFireTestPayload = async () => {
    let targetWebhookUrl = null;
    if (generatedWebhook?.webhookUrl) {
      targetWebhookUrl = generatedWebhook.webhookUrl;
    }

    if (!targetWebhookUrl) {
      showToast("Please generate a new secure webhook key first to test.", "error");
      return;
    }

    try {
      const res = await fetch(targetWebhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(GHL_STANDARD_SCHEMA),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast("Simulated lead routed & vaulted successfully!", "success");
        fetchLeads();
        fetchStats();
      } else {
        showToast(data.message || "Failed to route test payload", "error");
      }
    } catch {
      showToast("Network error executing in-app webhook test", "error");
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, STATS_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const fetchLeads = useCallback(async () => {
    const token = localStorage.getItem("flow_token");
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/leads`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads || []);
      } else {
        console.error("[fetchLeads] Error:", res.status, await res.text());
      }
    } catch (err) {
      console.error("[fetchLeads] Network Error:", err);
    }
  }, []);

  const fetchWebhooks = useCallback(async () => {
    const token = localStorage.getItem("flow_token");
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/webhooks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setWebhooks(data.webhooks);
      }
    } catch { /* retry silently */ }
  }, []);

  useEffect(() => {
    fetchLeads();
    fetchWebhooks();
    const interval = setInterval(() => {
      fetchLeads();
      fetchWebhooks();
    }, STATS_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchLeads, fetchWebhooks]);

  // Guided tour trigger and view synchronization
  useEffect(() => {
    if (activeTab === "dashboard" && stats.hasCompletedOnboarding === false && !tourActive) {
      setTourActive(true);
      setCurrentTourStep(0);
    }
  }, [activeTab, stats.hasCompletedOnboarding, tourActive]);

  useEffect(() => {
    if (tourActive) {
      setSidebarCollapsed(false);
    }
  }, [tourActive]);

  useEffect(() => {
    if (!tourActive) return;
    const targets = [
      "tour-control-panel",
      "tour-webhook-generator",
      "tour-destination-sandbox",
      "tour-lead-ledger",
      "tour-metrics-panel"
    ];
    const targetId = targets[currentTourStep];
    const element = document.getElementById(targetId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [tourActive, currentTourStep]);

  /** Generate a new webhook key + URL. */
  const handleGenerateWebhook = async (bypass2faCheck = false) => {
    if (bypass2faCheck !== true && !stats.twoFactorEnabled) {
      setMfaGateInterception(true);
      setShowSecurityModal(true);
      if (!twoFactorDetails) {
        handleGenerate2FA();
      }
      return;
    }
    const token = localStorage.getItem("flow_token");
    if (!token) return;
    setGenerating(true);
    try {
      const res = await fetch(`${API_BASE}/generate-webhook`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedWebhook(data);
        setShowSecretModal(true);
        setDestinationUrl(""); // clear on new generation
        showToast("Webhook generated successfully");
        // Refresh stats
        fetchStats();
        fetchLeads();
        fetchWebhooks();
      } else {
        showToast(data.message || "Failed to generate webhook", "error");
      }
    } catch {
      showToast("Network error — is the API running?", "error");
    } finally {
      setGenerating(false);
    }
  };

  /** Save the destination URL for the generated webhook key. */
  const handleSaveDestination = async () => {
    const token = localStorage.getItem("flow_token");
    if (!token || !generatedWebhook?.id || !destinationUrl) return;
    setSavingDestination(true);
    try {
      const res = await fetch(`${API_BASE}/destination`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: generatedWebhook.id,
          destinationUrl,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("Destination saved — leads will be forwarded");
        fetchLeads();
        fetchWebhooks();
      } else {
        showToast(data.message || "Failed to save destination", "error");
      }
    } catch {
      showToast("Network error — is the API running?", "error");
    } finally {
      setSavingDestination(false);
    }
  };

  const handleRevokeWebhook = async (id) => {
    if (!confirm("Are you sure you want to revoke this webhook?")) return;
    const token = localStorage.getItem("flow_token");
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/webhooks/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        showToast("Webhook revoked successfully");
        fetchLeads();
        fetchWebhooks();
        fetchStats();
      }
    } catch {
      showToast("Failed to revoke webhook", "error");
    }
  };

  // Lock body scroll when modals are open
  useEffect(() => {
    if (activeModal || showSecurityModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [activeModal, showSecurityModal]);

  const handleLogout = () => {
    localStorage.removeItem("flow_token");
    navigate("/login", { replace: true });
  };

  const handleCardClick = (card) => {
    setActiveModal({ id: card.id, accent: card.accent });
  };

  const handleCloseModal = () => {
    setActiveModal(null);
  };

  return (
    <div className="relative min-h-screen bg-surface flex flex-col md:flex-row">
      {/* ── Ambient background ───────────────────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -left-40 top-20 h-[500px] w-[500px] rounded-full bg-emerald-500/[0.02] blur-[140px]" />
        <div className="absolute -right-40 bottom-20 h-[500px] w-[500px] rounded-full bg-violet-500/[0.03] blur-[120px]" />
      </div>

      {/* ── Left Sidebar (Desktop) ───────────────────────────────────── */}
      <aside className={`hidden md:flex flex-col border-r border-slate-800/60 bg-surface/80 backdrop-blur-xl h-screen sticky top-0 z-40 transition-all duration-300 ${sidebarCollapsed ? "w-20" : "w-64"}`}>
        <div className={`p-6 flex items-center justify-between border-b border-slate-800/60 ${sidebarCollapsed ? "flex-col gap-3 px-2 py-6" : ""}`}>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15">
              <Zap className="h-4 w-4 text-emerald-400" />
            </div>
            {!sidebarCollapsed && (
              <div>
                <h1 className="text-sm font-bold tracking-wide text-slate-100">FLOW GATEWAY</h1>
                <p className="text-[9px] font-medium uppercase tracking-widest text-slate-500">Enterprise Lead Router</p>
              </div>
            )}
          </div>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1 text-slate-500 hover:text-emerald-400 hover:bg-slate-800/50 rounded-md transition"
            title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <button onClick={() => setActiveTab("dashboard")} className={`w-full flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition-all duration-200 ${sidebarCollapsed ? "justify-center px-2" : ""} ${activeTab === "dashboard" ? "bg-emerald-500/15 text-emerald-400" : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"}`} title={sidebarCollapsed ? "Live Dashboard" : ""}>
            <LayoutDashboard className="h-4 w-4" /> {!sidebarCollapsed && "Live Dashboard"}
          </button>
          <button id="tour-destination-sandbox" onClick={() => setActiveTab("sandbox")} className={`w-full flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition-all duration-200 ${sidebarCollapsed ? "justify-center px-2" : ""} ${activeTab === "sandbox" ? "bg-amber-500/15 text-amber-400" : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"}`} title={sidebarCollapsed ? "Destination Sandbox" : ""}>
            <FlaskConical className="h-4 w-4" /> {!sidebarCollapsed && "Destination Sandbox"}
          </button>
          <button onClick={() => setActiveTab("tutorial")} className={`w-full flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition-all duration-200 ${sidebarCollapsed ? "justify-center px-2" : ""} ${activeTab === "tutorial" ? "bg-violet-500/15 text-violet-400" : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"}`} title={sidebarCollapsed ? "Setup Tutorial" : ""}>
            <BookOpen className="h-4 w-4" /> {!sidebarCollapsed && "Setup Tutorial"}
          </button>
        </nav>

        <div className="p-4 border-t border-slate-800/60 mt-auto space-y-2">
          <button
            onClick={handleRelaunchTour}
            className={`flex w-full items-center justify-center gap-2 rounded-lg border border-slate-800 bg-surface px-4 py-2.5 text-xs font-semibold text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200 ${sidebarCollapsed ? "px-2" : ""}`}
            title={sidebarCollapsed ? "Relaunch Setup Tour" : ""}
          >
            <Play className="h-4 w-4 text-emerald-400" /> {!sidebarCollapsed && "Relaunch Setup Tour"}
          </button>

          <a
            href={`mailto:support.flowapi@gmail.com?subject=FlowAPI%20Support%20Request%20-%20${encodeURIComponent(userEmail)}`}
            className={`flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700/50 bg-surface-raised px-4 py-2.5 text-xs font-semibold text-slate-300 transition-colors hover:bg-slate-800 hover:text-white ${sidebarCollapsed ? "px-2" : ""}`}
            title={sidebarCollapsed ? "Contact Support" : ""}
          >
            <Mail className="h-4 w-4 text-cyan-400" /> {!sidebarCollapsed && "Contact Support"}
          </a>
        </div>
      </aside>

      {/* ── Main Content Container ───────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-screen relative z-10 overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-800/60 bg-surface/80 px-4 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15">
              <Zap className="h-4 w-4 text-emerald-400" />
            </div>
            <h1 className="text-sm font-bold tracking-wide text-slate-100">FLOW GATEWAY</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowSecurityModal(true)} className="p-2 text-slate-500 hover:text-emerald-400"><Shield className="h-4 w-4" /></button>
            <button onClick={handleLogout} className="p-2 text-slate-500 hover:text-rose-400"><LogOut className="h-4 w-4" /></button>
          </div>
        </header>

        {/* Mobile Navigation (Simple Pill Menu below header) */}
        <nav className="md:hidden flex overflow-x-auto border-b border-slate-800/60 bg-surface px-4 py-2 gap-2 hide-scrollbar">
          <button onClick={() => setActiveTab("dashboard")} className={`whitespace-nowrap flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-semibold ${activeTab === "dashboard" ? "bg-emerald-500/15 text-emerald-400" : "text-slate-500"}`}>Dashboard</button>
          <button onClick={() => setActiveTab("sandbox")} className={`whitespace-nowrap flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-semibold ${activeTab === "sandbox" ? "bg-amber-500/15 text-amber-400" : "text-slate-500"}`}>Sandbox</button>
          <button onClick={() => setActiveTab("tutorial")} className={`whitespace-nowrap flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-semibold ${activeTab === "tutorial" ? "bg-violet-500/15 text-violet-400" : "text-slate-500"}`}>Tutorial</button>
        </nav>

        {/* Desktop Header (Top right tools) */}
        <header className="hidden md:flex sticky top-0 z-30 h-14 items-center justify-end border-b border-slate-800/60 bg-surface/80 px-8 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <button onClick={() => setShowSecurityModal(true)} title="Security & 2FA Settings" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors duration-200 hover:bg-emerald-500/10 hover:text-emerald-400">
              <Shield className="h-4 w-4" />
            </button>
            <button onClick={handleLogout} title="End session" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors duration-200 hover:bg-rose-500/10 hover:text-rose-400">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 flex flex-col lg:flex-row w-full max-w-[90rem] mx-auto relative">
          <main className="flex-1 w-full space-y-6 px-4 py-8 md:px-8">
          {activeTab === "dashboard" ? (
            <>
              {/* Control Panel Header with Global Collapse Button */}
              <div id="tour-control-panel" className="flex items-center justify-between mb-4 border-b border-slate-800/40 pb-3">
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-emerald-400 animate-pulse" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-100">Live Control Panel</h2>
                </div>
                <button
                  onClick={() => {
                    const nextVal = !(webhooksCollapsed && leadsCollapsed);
                    setWebhooksCollapsed(nextVal);
                    setLeadsCollapsed(nextVal);
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-750 bg-slate-900/60 px-3 py-1.5 text-[11px] font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white"
                >
                  {webhooksCollapsed && leadsCollapsed ? (
                    <>
                      <ChevronsUpDown className="h-3.5 w-3.5 text-cyan-400" /> Expand Data
                    </>
                  ) : (
                    <>
                      <ChevronsDownUp className="h-3.5 w-3.5 text-cyan-400" /> Collapse Data
                    </>
                  )}
                </button>
              </div>

              {/* Dashboard Top Actions & Stats */}
              <DashboardTopActions
                stats={stats}
                onGenerateWebhook={handleGenerateWebhook}
                generatedWebhook={generatedWebhook}
                generating={generating}
                toast={toast}
                destinationUrl={destinationUrl}
                onDestinationChange={setDestinationUrl}
                onSaveDestination={handleSaveDestination}
                savingDestination={savingDestination}
                onRefreshStats={handleRefreshStats}
                refreshingStats={refreshingStats}
                onFireTestPayload={handleFireTestPayload}
                hasWebhook={!!generatedWebhook}
              />

              {/* Active Webhooks Table (Smart List) */}
              <WebhooksTable 
                webhooks={webhooks} 
                onRevoke={handleRevokeWebhook} 
                isCollapsed={webhooksCollapsed}
                onToggleCollapse={() => setWebhooksCollapsed(!webhooksCollapsed)}
                onDeleteAll={() => setWipeModal("webhooks")}
              />

              {/* Lead Ledger Table */}
              <LeadLedger 
                leads={leads} 
                isCollapsed={leadsCollapsed}
                onToggleCollapse={() => setLeadsCollapsed(!leadsCollapsed)}
                onDeleteAll={() => setWipeModal("leads")}
                onRefire={handleRefireLead}
              />
            </>
          ) : activeTab === "sandbox" ? (
            <EgressTester leads={leads} />
          ) : (
            <SetupTutorial onOpenFeatures={() => setShowFeatures(true)} />
          )}
        </main>

        {/* Right-Side Metrics Column */}
        {activeTab === "dashboard" && (
          <aside id="tour-metrics-panel" className="w-full lg:w-96 shrink-0 border-t lg:border-t-0 lg:border-l border-slate-800/60 bg-surface/30 backdrop-blur-xl p-6 lg:py-8 lg:px-8 space-y-6 lg:h-[calc(100vh-3.5rem)] lg:sticky lg:top-14 overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-emerald-400" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Live Metrics</h3>
              </div>
              <button
                onClick={fetchStats}
                disabled={refreshingStats}
                className="p-1.5 text-slate-500 hover:text-emerald-400 transition-colors disabled:opacity-50 rounded-md hover:bg-emerald-500/10"
                title="Refresh Metrics"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshingStats ? "animate-spin" : ""}`} />
              </button>
            </div>

            <div className="space-y-4 w-full">
              {/* Zapier Tax Avoided */}
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.02] p-5 w-full">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                    <DollarSign className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400/60 leading-none">Zapier Tax Avoided</p>
                    <p className="text-[9px] text-slate-500 mt-1">{stats.totalLeads} leads × $0.05</p>
                  </div>
                </div>
                <div className="font-mono text-2xl font-extrabold text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                  ${stats.zapierTaxAvoided}
                </div>
              </div>

              {/* Spam Shield */}
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.02] p-5 w-full">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-500/10">
                    <Ban className="h-4 w-4 text-rose-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-rose-400/60 leading-none">Spam Shield</p>
                    <p className="text-[9px] text-slate-500 mt-1">Malicious Requests Blocked</p>
                  </div>
                </div>
                <div className="font-mono text-2xl font-extrabold text-rose-400 drop-shadow-[0_0_10px_rgba(244,63,94,0.3)]">
                  {stats.botsBlocked}
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>

      {/* ── Deep Dive Modal ──────────────────────────────────────────── */}
      {activeModal && (
        <DeepDiveModal
          cardId={activeModal.id}
          accent={activeModal.accent}
          onClose={handleCloseModal}
        />
      )}

      {/* ── System Features Modal ────────────────────────────────────── */}
      {showFeatures && <FeaturesModal onClose={() => setShowFeatures(false)} />}
      
      {/* ── One-Time Secret Modal ────────────────────────────────────── */}
      {showSecretModal && generatedWebhook?.apiKey && (
        <OneTimeSecretModal
          webhook={generatedWebhook}
          onClose={() => {
            setShowSecretModal(false);
            // Clear the raw key from state, keeping only the ID for destination routing
            setGeneratedWebhook(prev => prev ? { id: prev.id } : null);
          }}
        />
      )}

      {/* ── Guided Onboarding Tour ── */}
      {tourActive && (
        <>
          {/* Spotlight Stacking Context Hack */}
          <style>{`
            #${[
              "tour-control-panel",
              "tour-webhook-generator",
              "tour-destination-sandbox",
              "tour-lead-ledger",
              "tour-metrics-panel"
            ][currentTourStep]} {
              position: relative !important;
              z-index: 50 !important;
              box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.75), 0 0 20px 4px rgba(6, 182, 212, 0.5) !important;
              pointer-events: none !important;
              transition: box-shadow 0.3s ease !important;
            }
          `}</style>

          {/* Tooltip Card Overlay */}
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none">
            <div className="pointer-events-auto w-full max-w-sm overflow-hidden rounded-2xl border border-cyan-500/30 bg-slate-950/95 p-6 shadow-2xl backdrop-blur-md animate-modal-in">
              <div className="pointer-events-none absolute -right-20 -top-20 h-44 w-44 rounded-full bg-cyan-500/[0.04] blur-3xl" />
              
              {/* Header */}
              <div className="relative mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-cyan-400 animate-pulse" />
                  <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-cyan-400">
                    System Tour &middot; Step {currentTourStep + 1} of 5
                  </span>
                </div>
              </div>

              {/* Body */}
              <p className="text-xs font-medium text-slate-200 leading-relaxed mb-6">
                {tourSteps[currentTourStep].copy}
              </p>

              {/* Progress dots */}
              <div className="flex items-center justify-between">
                <div className="flex gap-1.5">
                  {tourSteps.map((_, idx) => (
                    <span
                      key={idx}
                      className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${
                        idx === currentTourStep ? "w-4 bg-cyan-400" : "bg-slate-700"
                      }`}
                    />
                  ))}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleCompleteOnboarding}
                    className="rounded-lg bg-slate-900/60 border border-slate-800 px-3 py-1.5 text-[11px] font-bold text-slate-400 hover:bg-slate-900 hover:text-slate-200 transition"
                  >
                    Skip Tutorial
                  </button>
                  <button
                    onClick={() => {
                      if (currentTourStep < 4) {
                        setCurrentTourStep(currentTourStep + 1);
                      } else {
                        handleCompleteOnboarding();
                      }
                    }}
                    className="flex items-center gap-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 px-4 py-1.5 text-[11px] font-bold text-cyan-400 hover:bg-cyan-500/20 transition"
                  >
                    {currentTourStep < 4 ? "Next" : "Finish"} <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Security & 2FA Modal ────────────────────────────────────── */}
      {showSecurityModal && (
        <div
          onClick={handleCloseSecurityModal}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-800 bg-surface-raised p-6 shadow-2xl shadow-black/80"
          >
            {/* Ambient glows inside modal */}
            <div className="pointer-events-none absolute -left-20 -top-20 h-44 w-44 rounded-full bg-emerald-500/[0.04] blur-3xl" />
            <div className="pointer-events-none absolute -right-20 -bottom-20 h-44 w-44 rounded-full bg-rose-500/[0.04] blur-3xl" />

            {/* Absolute close button */}
            <button
              onClick={handleCloseSecurityModal}
              className="absolute top-4 right-4 z-10 rounded-lg p-1.5 text-slate-500 hover:bg-slate-850 hover:text-slate-350 transition-colors duration-200"
              title="Close modal"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Header */}
            <div className="relative mb-6 flex items-center justify-between border-b border-slate-800 pb-4 pr-8">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">
                    Security Control Center
                  </h3>
                  <p className="font-mono text-[9px] text-slate-500">
                    gateway_security_handshake()
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="relative space-y-6">
              {/* Card 1: Two-Factor Authentication */}
              <div className="rounded-xl border border-slate-800/60 bg-surface p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Two-Factor Authentication (2FA)
                  </h4>
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                    stats.twoFactorEnabled
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "bg-rose-500/15 text-rose-400"
                  }`}>
                    {stats.twoFactorEnabled ? "Active" : "Disabled"}
                  </span>
                </div>

                {stats.twoFactorEnabled ? (
                  <div className="flex items-start gap-3 rounded-lg border border-emerald-500/10 bg-emerald-500/[0.03] p-4.5">
                    <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-400 mt-0.5 animate-pulse-slow" />
                    <div>
                      <p className="text-xs font-semibold text-emerald-300">
                        Enterprise Shield Enabled
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500 leading-normal">
                        Your account requires a 6-digit Authenticator app code to complete access on every login session. Your credentials are fully locked down.
                      </p>
                    </div>
                  </div>
                ) : twoFactorDetails ? (
                  /* 2FA Setup Flow */
                  <div className="space-y-4">
                    {mfaGateInterception && (
                      <div className="rounded-lg bg-rose-500/10 border border-rose-500/25 p-3 text-center">
                        <p className="text-xs font-bold text-rose-400">
                          Security Clearance Required to Generate Webhooks.
                        </p>
                      </div>
                    )}
                    <div className="rounded-lg bg-surface-raised p-3 text-center">
                      <p className="text-xs font-medium text-slate-300">
                        Step 1: Scan the QR code using Google Authenticator, Duo, or similar.
                      </p>
                      <div className="my-4 flex justify-center rounded-xl bg-white p-3.5 max-w-[170px] mx-auto ring-1 ring-slate-700/30">
                        <img
                          src={twoFactorDetails.qrCodeUrl}
                          alt="2FA QR Code"
                          className="h-[140px] w-[140px]"
                        />
                      </div>
                      <p className="text-[10px] text-slate-500">
                        Alternatively, input secret key manually:
                      </p>
                      <div className="mt-2 flex items-center justify-center gap-1.5 rounded bg-surface px-2.5 py-1.5 font-mono text-xs font-bold text-slate-300 border border-slate-700/40">
                        <span>{twoFactorDetails.secret}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                        Step 2: Enter Verification Token
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          maxLength={6}
                          placeholder="000000"
                          value={twoFactorToken}
                          onChange={(e) => setTwoFactorToken(e.target.value.replace(/\D/g, ""))}
                          className="flex-1 rounded-lg border border-slate-700 bg-surface px-4.5 py-2.5 text-center font-mono text-sm tracking-[0.2em] font-semibold text-slate-200 outline-none transition focus:border-emerald-500/40"
                        />
                        <button
                          onClick={handleEnable2FA}
                          disabled={twoFactorLoading}
                          className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50 transition"
                        >
                          {twoFactorLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            "Activate 2FA"
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* 2FA Start Flow */
                  <div className="space-y-4">
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Add a strong cryptographic layer of security to your admin account by locking down access with an MFA authenticator device.
                    </p>
                    <button
                      onClick={handleGenerate2FA}
                      disabled={twoFactorLoading}
                      className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-4 py-2.5 text-xs font-bold text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 transition w-full"
                    >
                      {twoFactorLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>
                          <ShieldCheck className="h-4 w-4" />
                          Configure Two-Factor Authentication
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Card 2: Danger Zone */}
              <div className="rounded-xl border border-rose-500/10 bg-rose-500/[0.02] p-5">
                <div className="mb-2.5 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-500 animate-pulse-slow" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-rose-400">
                    Danger Zone
                  </h4>
                </div>
                <p className="text-[11px] text-slate-500 leading-normal mb-4">
                  Permanently erase all GoHighLevel leads vault, HTTP requests analytics, and reset threat neutralization history immediately. This action is irreversible.
                </p>
                <button
                  onClick={() => setShowDangerModal(true)}
                  className="rounded-lg bg-rose-600/10 border border-rose-500/30 px-4 py-2.5 text-xs font-bold text-rose-400 hover:bg-rose-600 hover:text-white transition w-full"
                >
                  Clear Analytics Logs & Reset Stats
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Danger Zone Confirmation Modal ────────────────────────────── */}
      {showDangerModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md rounded-2xl border border-rose-900/40 bg-surface-raised p-6 shadow-2xl shadow-rose-950/20">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-400 mx-auto border border-rose-500/20 animate-shake">
              <AlertTriangle className="h-6 w-6" />
            </div>

            <h3 className="text-center text-base font-bold text-slate-100">
              Are you sure?
            </h3>
            <p className="mt-2.5 text-center text-xs text-slate-400 leading-normal">
              This will permanently reset your analytics dashboard, clear all stored lead records, and purge all API gateway request traffic records.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <button
                disabled={clearingLogs}
                onClick={handleClearLogs}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 py-2.5 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-50 transition shadow-lg shadow-rose-500/20"
              >
                {clearingLogs ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Yes, Permanently Clear All Stats"
                )}
              </button>
              <button
                disabled={clearingLogs}
                onClick={() => setShowDangerModal(false)}
                className="rounded-lg bg-slate-800 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-700 transition"
              >
                Cancel, Keep Stats
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Wipe Modal Confirmation Dialog ────────────────────────────── */}
      {wipeModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md rounded-2xl border border-rose-900/40 bg-surface-raised p-6 shadow-2xl shadow-rose-950/20">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-400 mx-auto border border-rose-500/20 animate-shake">
              <AlertTriangle className="h-6 w-6" />
            </div>

            <h3 className="text-center text-base font-bold text-slate-100">
              Clear all {wipeModal === "webhooks" ? "Active Webhooks" : "Vaulted Leads"}?
            </h3>
            <p className="mt-2.5 text-center text-xs text-slate-400 leading-normal">
              {wipeModal === "webhooks"
                ? "This will permanently revoke and delete all generated active webhooks. Any incoming data sent to these webhook endpoints will be rejected."
                : "This will permanently delete all vaulted lead records from the dashboard ledger. This action cannot be undone."}
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <button
                onClick={wipeModal === "webhooks" ? handleWipeAllWebhooks : handleWipeAllLeads}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 py-2.5 text-xs font-bold text-white hover:bg-rose-500 transition shadow-lg shadow-rose-500/20"
              >
                Yes, Permanently Clear Data
              </button>
              <button
                onClick={() => setWipeModal(null)}
                className="rounded-lg bg-slate-800 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-700 transition"
              >
                Cancel, Keep Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
