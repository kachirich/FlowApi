import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import {
  Terminal,
  Zap,
  Database,
  Server,
  BrainCircuit,
  Loader2,
  CheckCircle2,
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
  PhoneCall,
  CreditCard,
  Activity,
  Settings,
  Lock,
  Shuffle,
  Workflow,
  Plug,
} from "lucide-react";

import BookingWidget from "./components/BookingWidget";
import Pricing from "./components/Pricing";
import WebhookLogs from "./components/WebhookLogs";
import UpgradeModal from "./components/UpgradeModal";
import WebhookConfig from "./components/WebhookConfig";
import SetupTutorial from "./components/SetupTutorial";
import CheckoutSuccessModal from "./components/CheckoutSuccessModal";
import DestinationManager from "./components/DestinationManager";
import FlowManager from "./components/FlowManager";
import IntegrationsTab from "./components/IntegrationsTab";
import NotificationPreferences from "./components/NotificationPreferences";
import apiClient from "./utils/api";
import { useAuth } from "./context/AuthContext";
import { API_BASE_URL } from "./utils/apiConfig";
import { webhookDestinationSchema, jsonKeyMappingSchema } from "./utils/validators";

const GATEWAY_URL = API_BASE_URL;
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
    deal_value: 5000,
    lead_status: "new",
  },
  location_id: "loc_abc123",
  assigned_to: "user_xyz789",
};

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
                <span className="text-xs text-emerald-400/60">Tax Avoided: $0.05</span>
              </div>
            )}
            {stats.totalLeads > 1 && (
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-emerald-400">[200 OK]</span>
                <span className="text-xs text-emerald-300/80">Lead Vaulted</span>
                <span className="text-slate-600">|</span>
                <span className="text-xs text-emerald-400/60">Payload routed to destination</span>
                <span className="text-slate-600">|</span>
                <span className="text-xs text-emerald-400/60">Tax Avoided: $0.05</span>
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
   Webhook Tools Panel — Generator, Tax Counter, Schema Export
   ═══════════════════════════════════════════════════════════════════════════ */

function RecentInboundActivity({ leads = [] }) {
  const [isActivityOpen, setIsActivityOpen] = useState(true);
  const recent = leads.slice(0, 4);

  return (
    <div className="rounded-xl border border-zinc-800 bg-surface-raised p-5 shadow-xl flex flex-col h-full">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsActivityOpen(!isActivityOpen)}
        className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800/60 hover:opacity-80 transition-opacity w-full"
      >
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-zinc-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">Recent Inbound Activity</h3>
        </div>
        <ChevronDown 
          className={`h-4 w-4 text-zinc-500 transition-transform duration-300 ${
            isActivityOpen ? "rotate-0" : "-rotate-90"
          }`}
        />
      </button>
      
      {/* Collapsible Content */}
      <div className={`overflow-hidden transition-all duration-300 flex-1 flex flex-col ${
        isActivityOpen ? "max-h-[300px] opacity-100" : "max-h-0 opacity-0"
      }`}>
        {recent.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-[11px] text-zinc-500 italic border border-dashed border-zinc-700/50 rounded-lg bg-zinc-900/50">
            No recent inbound activity
          </div>
        ) : (
          <div className="space-y-3">
            {recent.map((lead, idx) => {
              const timeAgo = Math.round((Date.now() - new Date(lead.created_at).getTime()) / 60000);
              const timeStr = timeAgo < 1 ? "Just now" : `${timeAgo}m ago`;
              const method = "POST";
              const path = "/api/leads/inbound";
              const status = lead.status === "200" || lead.deliveryStatus === "DELIVERED" || lead.is_test ? "200 OK" : "500 ERR";
              const statusColor = status === "200 OK" ? "text-emerald-400" : "text-rose-400";
              
              return (
                <div key={lead.id || idx} className="flex items-center justify-between text-[11px] font-mono border-b border-zinc-800/50 pb-2 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2">
                    <span className="text-cyan-400 font-bold">{method}</span>
                    <span className="text-zinc-400 truncate max-w-[120px] sm:max-w-[180px]">{path}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-semibold ${statusColor}`}>{status}</span>
                    <span className="text-zinc-500 text-right min-w-[45px]">{timeStr}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function DashboardTopActions({ leads, stats, onGenerateWebhook, generatedWebhook, generating, toast, destinationUrl, onDestinationChange, onSaveDestination, savingDestination, onRefreshStats, refreshingStats, hasWebhook }) {
  const [webhookOpen, setWebhookOpen] = useState(false);
  const [webhookCopied, setWebhookCopied] = useState(false);

  const handleCopyWebhook = async () => {
    if (!generatedWebhook) return;
    try {
      await navigator.clipboard.writeText(`Bearer ${generatedWebhook.apiKey}`);
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
        {/* Generate API Key Card */}
        <div id="tour-webhook-generator" className="relative flex flex-col h-full">
          <button
            onClick={() => { setWebhookOpen(!webhookOpen); }}
            className={`w-full flex items-center justify-between rounded-xl border px-5 py-3.5 transition-all duration-200 ${
              webhookOpen ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-400" : "border-slate-700/50 bg-surface-raised hover:border-cyan-500/30 hover:bg-surface-overlay text-slate-200"
            }`}
          >
            <div className="flex items-center gap-3">
              <Link2 className={`h-4 w-4 ${webhookOpen ? "text-cyan-400" : "text-slate-400"}`} />
              <span className="text-sm font-semibold">Generate API Key</span>
            </div>
            <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${webhookOpen ? "rotate-180" : ""}`} />
          </button>
          
          {/* Dropdown Content */}
          <div className={`overflow-hidden transition-all duration-300 flex-1 flex flex-col ${webhookOpen ? "max-h-[600px] mt-2 opacity-100" : "max-h-0 opacity-0"}`}>
            <div className="rounded-xl border border-zinc-800 bg-surface-raised p-5 shadow-xl flex flex-col flex-1">
              <button
                onClick={onGenerateWebhook}
                disabled={generating}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 py-2.5 text-xs font-semibold text-cyan-400 hover:bg-cyan-500/20 transition-colors disabled:opacity-50"
              >
                {generating ? <><Loader2 className="h-3.5 w-3.5 animate-spin"/> Generating...</> : <><Plus className="h-3.5 w-3.5" /> Generate Secure API Key</>}
              </button>

              {/* Security Warnings Section */}
              <div className="mt-4 space-y-2 text-xs text-zinc-500">
                <div className="flex gap-2">
                  <span className="shrink-0">⚠️</span>
                  <span>API keys are displayed only once upon generation.</span>
                </div>
                <div className="flex gap-2">
                  <span className="shrink-0">⚠️</span>
                  <span>Do not expose production keys in client-side code.</span>
                </div>
                <div className="flex gap-2">
                  <span className="shrink-0">⚠️</span>
                  <span>Keys are bound to your active billing limits.</span>
                </div>
              </div>

              {generatedWebhook && (
                <div className="mt-4 space-y-3 animate-fade-in">
                  <div className="rounded border border-rose-500/20 bg-rose-500/10 p-3 flex gap-2">
                    <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-rose-300 leading-relaxed">Save this API key immediately. For security, it will not be displayed again.</p>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1 text-[10px] uppercase text-slate-500 font-semibold tracking-widest">
                      <span>Authorization Header Value</span>
                      <button onClick={handleCopyWebhook} className="hover:text-cyan-400 flex items-center gap-1">{webhookCopied ? <ClipboardCheck className="h-3 w-3 text-emerald-400"/> : <Copy className="h-3 w-3"/>}</button>
                    </div>
                    <code className="block w-full rounded border border-slate-700/50 bg-slate-900 p-2 font-mono text-[10px] text-slate-300 break-all">
                      {`Bearer ${generatedWebhook.apiKey}`}
                    </code>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Inbound Activity */}
        <RecentInboundActivity leads={leads} />
      </div>
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
    title: "Tax Bypass",
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

function WebhooksTable({ webhooks, onRevoke, onConfigure, isCollapsed, onToggleCollapse, onDeleteAll, planType, setUpgradeModal, onTestPing, flows = [], onAssignFlow }) {
  const [expanded, setExpanded] = useState(false);
  const [configModal, setConfigModal] = useState(null);
  const [configTargetUrl, setConfigTargetUrl] = useState("");
  const [configMethod, setConfigMethod] = useState("POST");
  const [configSaving, setConfigSaving] = useState(false);
  const displayWebhooks = expanded ? webhooks : webhooks.slice(0, 5);

  const openConfigModal = (wh) => {
    setConfigModal(wh);
    setConfigTargetUrl(wh.target_url || "");
    setConfigMethod(wh.http_method || "POST");
  };

  const handleSaveConfig = async () => {
    if (!configModal) return;
    setConfigSaving(true);
    try {
      await onConfigure(configModal.id, configTargetUrl, configMethod);
      setConfigModal(null);
    } finally {
      setConfigSaving(false);
    }
  };

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
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            Active API Keys (Inbound)
          </h2>
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
              <th className="pb-3 font-semibold px-2">API Key (Masked)</th>
              <th className="pb-3 font-semibold px-2">Routing Flow</th>
              <th className="pb-3 font-semibold px-2">Created At</th>
              <th className="pb-3 font-semibold px-2">Last Used</th>
              <th className="pb-3 font-semibold text-right px-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {displayWebhooks.map((wh) => (
              <tr key={wh.id} className="transition-colors hover:bg-slate-800/20">
                <td className="py-3 px-2 font-mono text-[11px] text-amber-400/70">{wh.prefix}...{wh.last_four}</td>
                <td className="py-3 px-2">
                  <select
                    value={wh.flow_id || ""}
                    onChange={(e) => onAssignFlow && onAssignFlow(wh.id, e.target.value || null)}
                    title={wh.flow_id ? "Routing to assigned flow" : "No flow — routes to all destinations"}
                    className={`max-w-[170px] rounded border bg-slate-950 px-2 py-1 text-[11px] outline-none transition focus:border-cyan-500/40 ${
                      wh.flow_id ? "border-cyan-500/30 text-cyan-400" : "border-slate-700 text-slate-500"
                    }`}
                  >
                    <option value="">No flow — all destinations</option>
                    {flows.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </td>
                <td className="py-3 px-2 text-slate-300">{new Date(wh.created_at).toLocaleDateString()}</td>
                <td className="py-3 px-2 text-slate-400 italic">{wh.last_used_at ? new Date(wh.last_used_at).toLocaleDateString() : 'Never'}</td>
                <td className="py-3 px-2 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => onRevoke(wh.id)}
                      className="rounded bg-rose-500/10 px-2 py-1 text-[10px] font-semibold text-rose-400 transition-colors hover:bg-rose-500/20"
                    >
                      Revoke
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {webhooks.length === 0 && (
              <tr>
                <td colSpan="5" className="py-8 text-center text-slate-500 italic">
                  No active API keys. Generate one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Configure Webhook Modal */}
      {configModal && (
        <WebhookConfig 
          configModal={configModal}
          onClose={() => setConfigModal(null)}
          onSave={async (id, url, method) => {
            await onConfigure(id, url, method);
            setConfigModal(null);
          }}
          planType={planType}
          setUpgradeModal={setUpgradeModal}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Lead Ledger Component
   ═══════════════════════════════════════════════════════════════════════════ */

function LeadLedger({ leads, isCollapsed, onToggleCollapse, onDeleteAll, onRefire, onCancelJob, planType, setActiveTab }) {
  // Client-side pagination over the leads already in memory. The backend
  // GET /api/admin/leads currently returns a fixed window (LIMIT 100) with no
  // page/offset params, so true server-side pagination is gated on a backend
  // change. Until then we page the in-memory set (max 100) to cap rendered DOM
  // rows and keep the ledger responsive. URL contract: ?page=N (pageSize 50).
  const PAGE_SIZE = 50;
  const [searchParams, setSearchParams] = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(leads.length / PAGE_SIZE));
  const rawPage = parseInt(searchParams.get("page") || "1", 10);
  const page = Math.min(Math.max(1, Number.isNaN(rawPage) ? 1 : rawPage), totalPages);
  const pagedLeads = useMemo(
    () => leads.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [leads, page]
  );
  const goToPage = useCallback(
    (p) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (p <= 1) next.delete("page");
          else next.set("page", String(p));
          return next;
        },
        { replace: false }
      );
    },
    [setSearchParams]
  );

  if (planType === 'free') {
    return (
      <div id="tour-lead-ledger" className="rounded-2xl border border-slate-800/60 bg-surface p-6 animate-fade-in flex flex-col items-center justify-center min-h-[300px] text-center">
        <div className="h-12 w-12 rounded-xl bg-slate-800/50 border border-slate-700/50 flex items-center justify-center mb-4">
          <Lock className="h-5 w-5 text-slate-400" />
        </div>
        <h3 className="text-base font-bold text-slate-200 mb-2">Lead Ledger Locked</h3>
        <p className="text-xs text-slate-400 max-w-sm mb-6 leading-relaxed">
          Upgrade to the Basic tier to view raw JSON payloads, debug failed webhooks, and prove delivery to your clients.
        </p>
        <button
          onClick={() => setActiveTab && setActiveTab("pricing")}
          className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-5 py-2.5 text-sm font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors"
        >
          Upgrade to Basic
        </button>
      </div>
    );
  }

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
            {pagedLeads.map((lead) => {
              const score = lead.lead_score ?? 0;
              let badgeColor = "bg-rose-500/10 text-rose-400 border-rose-500/20";
              if (score >= 80) badgeColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
              else if (score >= 50) badgeColor = "bg-amber-500/10 text-amber-400 border-amber-500/20";
              
              const deliveryStatus = lead.deliveryStatus || 'PENDING';
              let deliveryBadgeColor = "";
              let displayStatusText = deliveryStatus;

              if (lead.is_test) {
                deliveryBadgeColor = "bg-yellow-500/10 text-yellow-500 border-yellow-500/20 shadow-glow-amber";
                displayStatusText = "TEST SUCCESS";
              } else if (deliveryStatus === 'DELIVERED') {
                deliveryBadgeColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-glow";
              } else if (deliveryStatus === 'FAILED') {
                deliveryBadgeColor = "bg-rose-500/10 text-rose-450 border-rose-500/20 shadow-glow-rose";
              } else if (deliveryStatus === 'CANCELED') {
                deliveryBadgeColor = "bg-slate-500/10 text-slate-400 border-slate-500/20";
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
                        {displayStatusText}
                      </span>
                      {deliveryStatus === 'RETRYING' && lead.job_id && (
                        <button
                          onClick={() => onCancelJob && onCancelJob(lead.id)}
                          className="flex items-center justify-center rounded p-1 text-rose-500 hover:bg-rose-500/10 border border-rose-500/20 transition-colors"
                          title="Stop/Cancel Auto-Retry"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
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
        {leads.length > PAGE_SIZE && (
          <nav
            className="mt-4 flex items-center justify-between border-t border-slate-800/60 pt-3 text-xs text-slate-400"
            aria-label="Lead ledger pagination"
          >
            <span aria-live="polite">
              Showing{" "}
              <span className="font-semibold text-slate-200">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, leads.length)}
              </span>{" "}
              of <span className="font-semibold text-slate-200">{leads.length}</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
                aria-label="Previous page"
                className="rounded-md border border-slate-700/60 px-2.5 py-1 font-semibold text-slate-300 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Prev
              </button>
              <span className="font-mono text-[11px] text-slate-500">
                Page {page} / {totalPages}
              </span>
              <button
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages}
                aria-label="Next page"
                className="rounded-md border border-slate-700/60 px-2.5 py-1 font-semibold text-slate-300 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </nav>
        )}
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

function EgressTester({ leads, destinations = [] }) {
  const [destinationUrl, setDestinationUrl] = useState("https://services.leadconnectorhq.com/hooks/flow_egress_test");
  const [method, setMethod] = useState("POST");
  const [selectedDestId, setSelectedDestId] = useState("");
  const [schemaOpen, setSchemaOpen] = useState(true);

  // Selecting a saved destination auto-populates URL + method; "" = manual entry.
  const handleSelectDestination = (id) => {
    setSelectedDestId(id);
    if (!id) return;
    const dest = destinations.find((d) => String(d.id) === String(id));
    if (dest) {
      setDestinationUrl(dest.target_url || "");
      setMethod(dest.http_method || dest.method || "POST");
    }
  };

  // Initialize mappings dynamically from GHL_STANDARD_SCHEMA on mount
  const [mappings, setMappings] = useState(() => {
    const initialMappings = {};
    Object.keys(GHL_STANDARD_SCHEMA).forEach(key => {
      initialMappings[key] = key;
    });
    return initialMappings;
  });
  
  const [passThrough, setPassThrough] = useState(true);
  const [sending, setSending] = useState(false);
  const [log, setLog] = useState(null);
  const [showRawTraceDrawer, setShowRawTraceDrawer] = useState(false);

  // Validation States - dynamically initialized from schema keys
  const [mappingErrors, setMappingErrors] = useState(() => {
    const errors = {};
    Object.keys(GHL_STANDARD_SCHEMA).forEach(key => {
      errors[key] = "";
    });
    return errors;
  });
  
  const [urlError, setUrlError] = useState("");

  // Real-time URL Validation
  useEffect(() => {
    if (!destinationUrl) {
      setUrlError("");
      return;
    }
    const result = webhookDestinationSchema.safeParse(destinationUrl);
    if (!result.success) {
      setUrlError(result.error.issues[0].message);
    } else {
      setUrlError("");
    }
  }, [destinationUrl]);

  // Real-time Mapping Validation - optional when pass-through is enabled
  useEffect(() => {
    const newErrors = {};
    Object.keys(GHL_STANDARD_SCHEMA).forEach(key => {
      newErrors[key] = "";
    });
    
    Object.keys(mappings).forEach((key) => {
      const value = mappings[key]?.trim();
      if (!passThrough && !value) {
        newErrors[key] = "Required when pass-through is off";
        return;
      }
      if (value) {
        const result = jsonKeyMappingSchema.safeParse(value);
        if (!result.success) {
          newErrors[key] = result.error.issues[0].message;
        }
      }
    });
    setMappingErrors(newErrors);
  }, [mappings, passThrough]);

  // Derived overall validity
  const isFormValid = !urlError && destinationUrl.length > 0 && Object.values(mappingErrors).every((err) => err === "");

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

  // Dynamically compile the egress payload based on mappings and pass-through mode
  const buildEgressPayload = () => {
    const payload = {};
    Object.keys(mappings).forEach(sourceKey => {
      const destKey = mappings[sourceKey]?.trim();
      if (destKey) {
        payload[destKey] = GHL_STANDARD_SCHEMA[sourceKey];
      } else if (passThrough) {
        payload[sourceKey] = GHL_STANDARD_SCHEMA[sourceKey];
      }
    });
    return payload;
  };
  
  const egressPayload = buildEgressPayload();

  // Can fire if URL is valid and has mappings (or pass-through is enabled)
  const hasMappings = Object.values(mappings).some(v => v && v.trim() !== "");
  const canFire = !urlError && destinationUrl && destinationUrl.trim() !== "" && (hasMappings || passThrough);

  const handleFireEgress = async () => {
    if (!canFire) return;
    setSending(true);
    setLog(null);

    try {
      const res = await fetch(`${API_BASE}/egress-test`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          destinationUrl,
          method,
          payload: egressPayload,
        }),
      });

      const data = await res.json().catch(() => ({ success: false, message: "Invalid response from server (possible 502)" }));
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

      <div className="flex flex-col gap-4">
        {/* Row 1: Schema — full width, collapsible */}
        <div className="w-full flex flex-col rounded-2xl border border-slate-800 bg-surface-raised overflow-hidden h-fit">
          <button
            onClick={() => setSchemaOpen((prev) => !prev)}
            className="flex items-center gap-2 border-b border-slate-800/60 bg-surface px-5 py-3 transition hover:bg-surface-overlay"
          >
            <Webhook className="h-4 w-4 text-violet-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Standard JSON Schema
            </h3>
            <ChevronDown
              className={`ml-auto h-4 w-4 text-slate-500 transition-transform duration-300 ${schemaOpen ? "rotate-180" : ""}`}
            />
          </button>
          {schemaOpen && (
            <div className="p-5 overflow-y-auto bg-slate-900/50 max-h-[260px]">
              <pre className="font-mono text-[10px] text-violet-300 leading-relaxed">
                {JSON.stringify(GHL_STANDARD_SCHEMA, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Row 2: Two equal columns */}
        <div className="grid grid-cols-2 gap-4">
        {/* Left: Destination selector + URL + method + pass-through + key mapper */}
        <div className="flex flex-col space-y-5 rounded-2xl border border-slate-800 bg-surface-raised p-5 shadow-xl">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Downstream Integration Setup
          </h3>

          {/* Saved Destination Selector */}
          <div className="space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Saved Destination
            </label>
            <select
              value={selectedDestId}
              onChange={(e) => handleSelectDestination(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-xs text-slate-200 focus:outline-none focus:border-amber-500 transition"
            >
              <option value="">-- Manual Entry --</option>
              {destinations.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

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
              className={`w-full rounded-xl border bg-slate-900 px-4 py-3 font-mono text-xs text-slate-200 focus:outline-none transition ${urlError ? "border-rose-500/50 focus:border-rose-500" : "border-slate-700 focus:border-amber-500"}`}
            />
            {urlError && (
              <p className="text-[10px] text-rose-500 font-medium animate-fade-in">{urlError}</p>
            )}
          </div>

          {/* HTTP Method Field */}
          <div className="space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
              HTTP Method
            </label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 font-mono text-xs text-slate-200 focus:outline-none focus:border-amber-500 transition"
            >
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
            </select>
          </div>

          {/* Pass-Through Toggle */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Pass-Through Unmapped Keys
              </label>
              <p className="text-[9px] text-slate-500">
                {passThrough ? "ON: Unmapped keys included as-is" : "OFF: Only mapped keys included"}
              </p>
            </div>
            <button
              onClick={() => setPassThrough(!passThrough)}
              className={`relative h-6 w-11 rounded-full border-2 transition-all ${passThrough ? "border-emerald-500/40 bg-emerald-500/10" : "border-slate-700/40 bg-slate-900/50"}`}
            >
              <div className={`absolute top-0.5 h-5 w-5 rounded-full transition-transform ${passThrough ? "translate-x-5 bg-emerald-500/80" : "translate-x-0.5 bg-slate-600/60"}`} />
            </button>
          </div>

          {/* Key-Value Mapper */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">FlowAPI Property</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Destination JSON Key</span>
            </div>

            <div className="space-y-3.5 max-h-[320px] overflow-y-auto pr-2">
              {Object.keys(GHL_STANDARD_SCHEMA).map((sourceKey) => (
                <div key={sourceKey} className="flex flex-col gap-1">
                  <div className="flex items-center gap-4">
                    <span className="flex-1 font-mono text-xs text-slate-300 truncate">{sourceKey}</span>
                    <input
                      type="text"
                      value={mappings[sourceKey] || ""}
                      onChange={(e) => setMappings({ ...mappings, [sourceKey]: e.target.value })}
                      placeholder={passThrough ? "(optional)" : "(required)"}
                      className={`w-44 rounded-lg border bg-slate-950 px-3 py-1.5 font-mono text-xs focus:outline-none ${mappingErrors[sourceKey] ? "border-rose-500/50 text-rose-400 focus:border-rose-500" : "border-slate-800 text-amber-400 focus:border-amber-500"}`}
                    />
                  </div>
                  {mappingErrors[sourceKey] && <span className="text-right text-[10px] text-rose-500">{mappingErrors[sourceKey]}</span>}
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleFireEgress}
            disabled={sending || !canFire}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-950 hover:bg-amber-400 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-500/10 mt-auto"
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
                Executing...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 text-slate-950" />
                Fire Test to Destination
              </>
            )}
          </button>
        </div>

        {/* Right: Outgoing Payload Preview + Egress Response Log */}
        <div className="flex flex-col gap-5">
          {/* Payload Preview Card */}
          <div className="rounded-2xl border border-slate-800 bg-surface-raised overflow-hidden">
            <div className="flex items-center gap-2 border-b border-slate-800/60 bg-surface px-5 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
              <span className="ml-2 font-mono text-[11px] text-slate-500">outgoing_payload.json</span>
              <span className={`ml-auto rounded px-2 py-0.5 font-mono text-[10px] uppercase ${passThrough ? "bg-emerald-500/10 text-emerald-400" : "bg-cyan-500/10 text-cyan-400"}`}>
                {passThrough ? "MAPPED + PASS-THROUGH" : "MAPPED PREVIEW"}
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
      </div>

      {/* Bottom-anchored Raw Trace Drawer */}
      {showRawTraceDrawer && log && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md w-full rounded-2xl border border-white/20 bg-black p-5 shadow-2xl shadow-black/50 animate-slide-up">
          <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-white" />
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-white">
                System Error Trace
              </span>
            </div>
            <button
              onClick={() => setShowRawTraceDrawer(false)}
              className="rounded-lg p-1 text-white/60 hover:bg-white/10 hover:text-white transition"
              title="Close trace drawer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          
          <pre className="font-mono text-[10.5px] leading-relaxed text-white overflow-auto max-h-[200px] bg-black border border-white/10 rounded-lg p-3 scrollbar-thin scrollbar-thumb-white/20">
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

const getBrandConfig = (plan) => {
  const planRankStr = plan ? String(plan).toLowerCase() : 'free';
  if (planRankStr === 'basic') return 'text-blue-500 bg-blue-500/10 border-blue-500/20 drop-shadow-md';
  if (planRankStr === 'pro') return 'text-purple-500 bg-purple-500/10 border-purple-500/20 drop-shadow-lg';
  if (planRankStr === 'plus') return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20 animate-pulse drop-shadow-xl';
  return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
};

/**
 * Derive a friendly greeting name from the user record.
 * Prefers last name, then first name, then the email handle, then a neutral fallback.
 * Capitalizes the first letter so legacy lowercase rows still read cleanly.
 */
function greetName(user) {
  const raw =
    user?.last_name?.trim() ||
    user?.first_name?.trim() ||
    user?.email?.split('@')[0] ||
    'there';
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, setUser, refreshUser } = useAuth();
  // Stable ref so fetchStats (memoized with []) can always call the latest refreshUser.
  const refreshUserRef = useRef(refreshUser);
  useEffect(() => { refreshUserRef.current = refreshUser; }, [refreshUser]);
  const token = "session_cookie";





  const [session, setSession] = useState(null);
  const [polling, setPolling] = useState(true);
  const [sandboxStatus, setSandboxStatus] = useState("idle"); // "idle" | "loading" | "success" | "error"
  const [sandboxScore, setSandboxScore] = useState(null);
  const [activeModal, setActiveModal] = useState(null); // { id, accent }
  // New signups land on the dashboard so the Joyride onboarding tour can
  // anchor to its targets (the tour replaces the old auto-shown tutorial tab).
  //
  // The active tab lives in the URL (?tab=…) so panels are deep-linkable and
  // browser back/forward navigates between them. `activeTab`/`setActiveTab`
  // keep their original signatures so existing call sites are unchanged.
  const VALID_TABS = useMemo(
    () => [
      "dashboard", "sandbox", "destinations", "flows", "integrations",
      "logs", "tutorial", "consulting", "pricing", "notifications",
    ],
    []
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab = VALID_TABS.includes(tabParam) ? tabParam : "dashboard";
  const setActiveTab = useCallback(
    (tab) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("tab", tab);
          // A tab switch resets lead-ledger pagination to the first page.
          next.delete("page");
          return next;
        },
        { replace: false }
      );
    },
    [setSearchParams]
  );

  useEffect(() => {
    if (localStorage.getItem("just_registered") === "true") {
      localStorage.removeItem("just_registered");
    }
  }, []);
  const [stats, setStats] = useState({ totalLeads: 0, totalWebhooks: 0, botsBlocked: 0, zapierTaxAvoided: "0.00", planType: "free" });
  const [generatedWebhook, setGeneratedWebhook] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState(null);
  const [destinationUrl, setDestinationUrl] = useState("");
  const [savingDestination, setSavingDestination] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);
  const [leads, setLeads] = useState([]);
  const [webhooks, setWebhooks] = useState([]);
  const [flows, setFlows] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [creditSummary, setCreditSummary] = useState(null);
  const [showSecretModal, setShowSecretModal] = useState(false);

  // Enterprise Security & 2FA / Danger Zone states
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [showDangerModal, setShowDangerModal] = useState(false);
  const [twoFactorDetails, setTwoFactorDetails] = useState(null);
  const [twoFactorToken, setTwoFactorToken] = useState("");
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [refreshingStats, setRefreshingStats] = useState(false);
  const [clearingLogs, setClearingLogs] = useState(false);

  // Account Deletion States
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Step-Up Authentication States
  const [showStepUpModal, setShowStepUpModal] = useState(false);
  const [stepUpOtp, setStepUpOtp] = useState("");
  const [stepUpLoading, setStepUpLoading] = useState(false);
  const [stepUpAction, setStepUpAction] = useState({ type: "generate" }); // { type: 'generate' } or { type: 'delete', id }

  // Paywall Modal State
  const [upgradeModal, setUpgradeModal] = useState({ isOpen: false, feature: "", tier: "" });

  // Guided Onboarding & 2FA Gate States
  const [mfaGateInterception, setMfaGateInterception] = useState(false);

  // Post-checkout celebration modal state
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);

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

  // ── Post-checkout: poll until the Stripe webhook flips the plan ─────────
  // The webhook can land 1–3s after the browser redirect, so never trust the
  // redirect alone — poll /api/auth/me until plan_type changes off the old value.
  const handleCheckoutSuccess = useCallback(async () => {
    const before = user?.plan_type;
    for (let i = 0; i < 8; i++) {
      const fresh = await refreshUser();
      if (fresh?.plan_type && fresh.plan_type !== before && fresh.plan_type !== 'free') {
        setShowCheckoutModal(true);
        return;
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    // Fallback: still celebrate even if the flip is slow to propagate.
    setShowCheckoutModal(true);
  }, [user, refreshUser]);

  // ── Read + clean the Stripe redirect query params on mount ──────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      handleCheckoutSuccess();
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('canceled') === 'true') {
      showToast(`No changes — you're still on the ${user?.plan_type || 'free'} plan.`, 'error');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Poll for guest session status — SKIPPED when user is authenticated. */
  const guestErrorCount = useRef(0);
  const fetchStatus = useCallback(async () => {
    // Authenticated users don't have guest sessions — skip entirely
    if (user) {
      setPolling(false);
      return;
    }

    if (!token) return;

    try {
      const res = await fetch(STATUS_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          navigate("/login", { replace: true });
        }
        // Bail out after 3 consecutive non-auth errors (e.g. 400) to prevent infinite loop
        guestErrorCount.current += 1;
        if (guestErrorCount.current >= 3) {
          console.warn("[Dashboard] Guest status polling stopped after 3 consecutive errors.");
          setPolling(false);
        }
        return;
      }

      // Reset error counter on success
      guestErrorCount.current = 0;

      const data = await res.json().catch(() => ({ success: false, message: "Invalid response from server (possible 502)" }));
      setSession(data.session);

      // Stop polling once AI has responded
      if (data.session?.ai_welcome_message) {
        setPolling(false);
      }
    } catch {
      // Bail out on repeated network errors too
      guestErrorCount.current += 1;
      if (guestErrorCount.current >= 3) {
        console.warn("[Dashboard] Guest status polling stopped after 3 consecutive network errors.");
        setPolling(false);
      }
    }
  }, [navigate, user]);

  useEffect(() => {
    // Don't start polling at all if user is authenticated
    if (user) {
      setPolling(false);
      return;
    }

    fetchStatus(); // initial fetch
    if (!polling) return;

    const interval = setInterval(fetchStatus, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchStatus, polling, user]);

  /** Fetch admin stats (lead count for tax counter). */
  const fetchStats = useCallback(async () => {
    // const token = localStorage.getItem("flow_token");
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({ success: false, message: "Invalid response from server (possible 502)" }));
        setStats((prev) => {
          if (data.planType && prev.planType && data.planType !== prev.planType) {
            // Plan changed in the DB — refresh AuthContext so user.plan_type is in sync.
            setTimeout(() => refreshUserRef.current?.(), 0);
          }
          return {
            ...data,
            hasCompletedOnboarding: prev?.hasCompletedOnboarding === false ? false : data.hasCompletedOnboarding,
          };
        });
      }
    } catch { /* retry silently */ }
  }, []);

  /** Dynamic refresh of gateway metrics */
  const handleRefreshStats = useCallback(async () => {
    setRefreshingStats(true);
    try {
      // const token = localStorage.getItem("flow_token");
      if (!token) return;

      const res = await fetch(`${API_BASE}/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({ success: false, message: "Invalid response from server (possible 502)" }));
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
      // const token = localStorage.getItem("flow_token");
      const res = await fetch(`${GATEWAY_URL}/api/auth/2fa/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json().catch(() => ({ success: false, message: "Invalid response from server (possible 502)" }));
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
      // const token = localStorage.getItem("flow_token");
      const res = await fetch(`${GATEWAY_URL}/api/auth/2fa/enable`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ token: twoFactorToken }),
      });
      const data = await res.json().catch(() => ({ success: false, message: "Invalid response from server (possible 502)" }));
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


  // Get logged in user's email from JWT token
  const userEmail = useMemo(() => {
    // const token = localStorage.getItem("flow_token");
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
      // const token = localStorage.getItem("flow_token");
      const res = await fetch(`${API_BASE}/logs`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json().catch(() => ({ success: false, message: "Invalid response from server (possible 502)" }));
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

  /** Permanently delete account and all user data */
  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") return;
    setDeletingAccount(true);
    try {
      const res = await fetch(`${GATEWAY_URL}/api/users/me`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({ success: false, message: "Invalid response from server" }));
      if (res.ok && data.success) {
        showToast("Account permanently deleted.", "success");
        setShowDeleteAccountModal(false);
        setDeleteConfirmText("");
        handleCloseSecurityModal();
        navigate("/", { replace: true });
      } else {
        showToast(data.message || "Failed to delete account.", "error");
      }
    } catch (err) {
      showToast("Network error during account deletion.", "error");
    } finally {
      setDeletingAccount(false);
    }
  };

  /** Wipe all webhooks */
  const handleWipeAllWebhooks = async () => {
    // const token = localStorage.getItem("flow_token");
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
    // const token = localStorage.getItem("flow_token");
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
    // const token = localStorage.getItem("flow_token");
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/leads/${leadId}/refire`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({ success: false, message: "Invalid response from server (possible 502)" }));
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

  /** Cancel a delayed or waiting auto-retry job from BullMQ queue */
  const handleCancelJob = async (id) => {
    // const token = localStorage.getItem("flow_token");
    if (!token || !id) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/webhooks/queue/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const data = await res.json().catch(() => ({ success: false, message: "Invalid response from server (possible 502)" }));
      if (res.ok && data.success) {
        showToast("Webhook retry queue job canceled successfully.");
        // Instantly update the lead status in local state to CANCELED
        setLeads(prevLeads =>
          prevLeads.map(lead =>
            lead.id === id ? { ...lead, deliveryStatus: "CANCELED" } : lead
          )
        );
      } else {
        showToast(data.message || "Failed to cancel retry job", "error");
      }
    } catch (err) {
      showToast("Network error cancelling retry job", "error");
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

      const data = await res.json().catch(() => ({ success: false, message: "Invalid response from server (possible 502)" }));
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
    // const token = localStorage.getItem("flow_token");
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/leads`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({ success: false, message: "Invalid response from server (possible 502)" }));
        setLeads(data.leads || []);
      } else {
        console.error("[fetchLeads] Error:", res.status, await res.text());
      }
    } catch (err) {
      console.error("[fetchLeads] Network Error:", err);
    }
  }, []);

  const fetchWebhooks = useCallback(async () => {
    // const token = localStorage.getItem("flow_token");
    if (!token) return;
    try {
      const res = await fetch(`${GATEWAY_URL}/api/keys`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({ success: false, message: "Invalid response from server (possible 502)" }));
        setWebhooks(data.keys || []);
      }
    } catch { /* retry silently */ }
  }, []);

  const fetchFlows = useCallback(async () => {
    try {
      const res = await apiClient.get('/api/flows');
      if (res.data?.success) {
        setFlows(res.data.flows || []);
      }
    } catch { /* retry silently */ }
  }, []);

  const fetchDestinations = useCallback(async () => {
    try {
      const res = await apiClient.get('/api/destinations');
      if (res.data?.success) {
        setDestinations(res.data.destinations || []);
      }
    } catch { /* retry silently */ }
  }, []);

  const handleAssignFlow = useCallback(async (keyId, flowId) => {
    // Optimistic update so the select reflects the choice immediately
    const previous = webhooks;
    const flowName = flowId ? (flows.find((f) => f.id === flowId)?.name ?? null) : null;
    setWebhooks((prev) =>
      prev.map((k) => (k.id === keyId ? { ...k, flow_id: flowId, flow_name: flowName } : k))
    );
    try {
      await apiClient.put(`/api/keys/${keyId}/flow`, { flow_id: flowId });
      showToast(flowId ? "Flow assigned" : "Flow unassigned", "success");
    } catch (err) {
      console.error('Failed to assign flow:', err);
      setWebhooks(previous); // rollback
      showToast("Failed to assign flow", "error");
    }
  }, [webhooks, flows]);

  useEffect(() => {
    fetchLeads();
    fetchWebhooks();
    fetchFlows();
    fetchDestinations();
    const interval = setInterval(() => {
      fetchLeads();
      fetchWebhooks();
      fetchFlows();
      fetchDestinations();
    }, STATS_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchLeads, fetchWebhooks, fetchFlows, fetchDestinations]);

  // Lead-credit summary (Growth/Enterprise tiers only)
  useEffect(() => {
    const tier = user?.tier;
    if (tier !== "growth" && tier !== "enterprise") return;
    let active = true;
    const load = async () => {
      try {
        const r = await apiClient.get("/api/balance/summary");
        if (active && r.data?.success) setCreditSummary(r.data);
      } catch { /* silent */ }
    };
    load();
    const iv = setInterval(load, STATS_POLL_INTERVAL);
    return () => { active = false; clearInterval(iv); };
  }, [user?.tier]);



  /** Trigger Step-Up 2FA Flow for Webhook Generation */
  const handleGenerateWebhook = async () => {
    // const token = localStorage.getItem("flow_token");
    if (!token) return;

    // Pre-Check Limit Capacity
    const currentCount = webhooks.length;
    const plan = (stats.planType || "free").toLowerCase();
    
    let isLimitReached = false;
    let nextTier = "";

    if (plan === "free" && currentCount >= 2) {
      isLimitReached = true;
      nextTier = "Basic";
    } else if (plan === "basic" && currentCount >= 10) {
      isLimitReached = true;
      nextTier = "Pro";
    } else if (plan === "pro" && currentCount >= 50) {
      isLimitReached = true;
      nextTier = "Plus";
    }

    if (isLimitReached) {
      setUpgradeModal({
        isOpen: true,
        feature: "Expanded Webhook Capacity",
        tier: nextTier
      });
      return;
    }

    if (!stats.twoFactorEnabled) {
      showToast("Action denied: You must enable 2FA in your account settings first.", "error");
      return;
    }

    setStepUpAction({ type: "generate" });
    setShowStepUpModal(true);
    setStepUpOtp("");
  };

  const generateWebhookAPI = async (token, otp) => {
    const trustedToken = localStorage.getItem("trusted_device_token");
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
    if (trustedToken) {
      headers["x-trusted-device-token"] = trustedToken;
    }

    const res = await fetch(`${GATEWAY_URL}/api/keys`, {
      method: "POST",
      headers,
      body: JSON.stringify(otp ? { totpToken: otp } : {}),
    });
    const data = await res.json().catch(() => ({ success: false, message: "Invalid response from server (possible 502)" }));

    if (res.status === 401) {
      showToast(data.error || "Invalid or expired verification code", "error");
      return false;
    }

    if (res.status === 403 || data.error?.includes("Plan limit reached")) {
      setShowStepUpModal(false);
      setActiveTab("pricing");
      showToast("Webhook limit reached. Please upgrade to Pro to create more.", "error");
      return false;
    }

    if (data.success) {
      if (data.trustedDeviceToken) {
        localStorage.setItem("trusted_device_token", data.trustedDeviceToken);
      }
      
      // Map the new API format (data.key.raw_key) to the state format
      const newWebhookState = {
        ...data,
        apiKey: data.key?.raw_key || data.raw_key || data.apiKey
      };
      
      setGeneratedWebhook(newWebhookState);
      setShowStepUpModal(false);
      setShowSecretModal(true);
      setDestinationUrl("");
      setStepUpOtp("");
      showToast("API Key generated successfully");
      fetchStats();
      fetchLeads();
      fetchWebhooks();
      return true;
    } else {
      showToast(data.message || data.error || "Failed to generate webhook", "error");
      return false;
    }
  };

  const deleteWebhookAPI = async (token, webhookId, otp) => {
    const trustedToken = localStorage.getItem("trusted_device_token");
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
    if (trustedToken) {
      headers["x-trusted-device-token"] = trustedToken;
    }

    const res = await fetch(`${GATEWAY_URL}/api/keys/${webhookId}`, {
      method: "DELETE",
      headers,
      body: JSON.stringify(otp ? { totpToken: otp } : {}),
    });
    const data = await res.json().catch(() => ({ success: false, message: "Invalid response from server (possible 502)" }));

    if (res.status === 401) {
      showToast(data.error || "Invalid or expired verification code", "error");
      return false;
    }

    if (res.ok && data.success) {
      if (data.trustedDeviceToken) {
        localStorage.setItem("trusted_device_token", data.trustedDeviceToken);
      }
      setShowStepUpModal(false);
      showToast("Webhook revoked successfully");
      fetchStats();
      fetchLeads();
      fetchWebhooks();
      return true;
    } else {
      showToast(data.message || data.error || "Failed to revoke webhook", "error");
      return false;
    }
  };

  /** Verify OTP and Execute Action (Generate or Delete) */
  const handleVerifyStepUp = async () => {
    // const token = localStorage.getItem("flow_token");
    if (!token) return;
    if (!stepUpOtp || stepUpOtp.length < 6) {
      showToast("Please enter a valid 6-digit code", "error");
      return;
    }
    setStepUpLoading(true);
    try {
      if (stepUpAction.type === "generate") {
        await generateWebhookAPI(token, stepUpOtp);
      } else if (stepUpAction.type === "delete") {
        await deleteWebhookAPI(token, stepUpAction.id, stepUpOtp);
      }
    } catch (err) {
      showToast(err?.response?.data?.message || err?.message || "Network error verifying code", "error");
    } finally {
      setStepUpLoading(false);
    }
  };

  /** Save the destination URL for the generated webhook key. */
  const handleSaveDestination = async () => {
    // const token = localStorage.getItem("flow_token");
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
      const data = await res.json().catch(() => ({ success: false, message: "Invalid response from server (possible 502)" }));
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
    // const token = localStorage.getItem("flow_token");
    if (!token) return;
    setStepUpAction({ type: "delete", id });
    setShowStepUpModal(true);
    setStepUpOtp("");
  };

  /** Configure a webhook's target_url and http_method. */
  const handleConfigureWebhook = async (id, targetUrl, httpMethod) => {
    // const token = localStorage.getItem("flow_token");
    if (!token) return;
    try {
      const res = await fetch(`${GATEWAY_URL}/api/webhooks/${id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ target_url: targetUrl, http_method: httpMethod }),
      });
      const data = await res.json().catch(() => ({ success: false, message: "Invalid response from server (possible 502)" }));
      if (res.ok && data.success) {
        showToast("Webhook configuration saved");
        fetchWebhooks();
      } else {
        showToast(data.message || "Failed to save configuration", "error");
      }
    } catch {
      showToast("Network error saving configuration", "error");
    }
  };

  /** Send a test ping to the dynamic dispatcher route */
  const handleTestPing = async (id) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/catch/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flow_api_test: "Successful connection established", timestamp: new Date() }),
      });
      if (res.ok) {
        showToast("Test payload delivered successfully.");
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.message || data.error || "Failed to deliver test payload", "error");
      }
    } catch (err) {
      showToast(err?.message || "Network error — is the API running?", "error");
    }
  };

  // Lock body scroll when modals are open
  useEffect(() => {
    if (activeModal || showSecurityModal || showDeleteAccountModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [activeModal, showSecurityModal, showDeleteAccountModal]);

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" }
      });
    } catch (err) {
      console.error("Logout API error:", err);
    } finally {
      navigate("/login", { replace: true });
    }
  };

  const handleCardClick = (card) => {
    setActiveModal({ id: card.id, accent: card.accent });
  };

  const handleCloseModal = () => {
    setActiveModal(null);
  };

  const displayName = greetName(user);

  return (
    <div className="relative min-h-screen bg-surface flex flex-col md:flex-row">

      {/* ── Ambient background ───────────────────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -left-40 top-20 h-[500px] w-[500px] rounded-full bg-emerald-500/[0.02] blur-[140px]" />
        <div className="absolute -right-40 bottom-20 h-[500px] w-[500px] rounded-full bg-violet-500/[0.03] blur-[120px]" />
      </div>

      {/* ── Left Sidebar (Desktop) ───────────────────────────────────── */}
      <aside className={`hidden md:flex flex-col border-r border-zinc-900 bg-zinc-950 h-screen sticky top-0 z-40 transition-all duration-150 ${sidebarCollapsed ? "w-20" : "w-60"}`}>
        <div className={`p-6 flex items-center justify-between border-b border-slate-800/60 ${sidebarCollapsed ? "flex-col gap-3 px-2 py-6" : ""}`}>
          <div className="flex items-center gap-3">
            {sidebarCollapsed ? (
              <div className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold ${
                (user?.plan_type || 'free') === 'basic' ? 'border-blue-500/30 text-blue-400 bg-blue-500/5' :
                (user?.plan_type || 'free') === 'pro' ? 'border-purple-500/30 text-purple-400 bg-purple-500/5' :
                (user?.plan_type || 'free') === 'plus' ? 'border-yellow-400/30 text-yellow-400 bg-yellow-400/5' :
                'border-emerald-500/30 text-emerald-400 bg-emerald-500/5'
              }`} title={displayName}>
                {displayName.charAt(0)}
              </div>
            ) : (
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${getBrandConfig(user?.plan_type || 'free')}`}>
                <Zap className="h-4 w-4" />
              </div>
            )}
            {!sidebarCollapsed && (
              <div>
                <h1 className="flex items-center gap-2 text-sm font-medium tracking-tight text-zinc-50">
                  <span className="h-2 w-2 rounded-full bg-indigo-500" />
                  FlowGateway
                </h1>
                <p className="text-xs text-zinc-500 mt-1">Hi {displayName}</p>
              </div>
            )}
          </div>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 rounded-md transition-colors duration-150"
            title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <button onClick={() => setActiveTab("dashboard")} className={`w-full flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition-all duration-200 ${sidebarCollapsed ? "justify-center px-2" : ""} ${activeTab === "dashboard" ? "bg-indigo-500/10 text-zinc-50" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"}`} title={sidebarCollapsed ? "Live Dashboard" : ""}>
            <LayoutDashboard className="h-4 w-4" /> {!sidebarCollapsed && "Live Dashboard"}
          </button>
          <button id="tour-destination-sandbox" onClick={() => setActiveTab("sandbox")} className={`w-full flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition-all duration-200 ${sidebarCollapsed ? "justify-center px-2" : ""} ${activeTab === "sandbox" ? "bg-indigo-500/10 text-zinc-50" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"}`} title={sidebarCollapsed ? "Destination Sandbox" : ""}>
            <FlaskConical className="h-4 w-4" /> {!sidebarCollapsed && "Destination Sandbox"}
          </button>
          <button onClick={() => setActiveTab("destinations")} className={`w-full flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition-all duration-200 ${sidebarCollapsed ? "justify-center px-2" : ""} ${activeTab === "destinations" ? "bg-indigo-500/10 text-zinc-50" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"}`} title={sidebarCollapsed ? "Destinations" : ""}>
            <Shuffle className="h-4 w-4" /> {!sidebarCollapsed && "Destinations"}
          </button>
          <button onClick={() => setActiveTab("flows")} className={`w-full flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition-all duration-200 ${sidebarCollapsed ? "justify-center px-2" : ""} ${activeTab === "flows" ? "bg-indigo-500/10 text-zinc-50" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"}`} title={sidebarCollapsed ? "Flows" : ""}>
            <Workflow className="h-4 w-4" /> {!sidebarCollapsed && "Flows"}
          </button>
          <button onClick={() => setActiveTab("integrations")} className={`w-full flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition-all duration-200 ${sidebarCollapsed ? "justify-center px-2" : ""} ${activeTab === "integrations" ? "bg-indigo-500/10 text-zinc-50" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"}`} title={sidebarCollapsed ? "Integrations" : ""}>
            <Plug className="h-4 w-4" /> {!sidebarCollapsed && "Integrations"}
          </button>
          <button 
            onClick={() => {
              if (stats.planType === 'free') {
                setUpgradeModal({ isOpen: true, feature: 'Analytics Dashboard', tier: 'Basic or higher' });
              } else {
                setActiveTab("logs");
              }
            }} 
            className={`w-full flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition-all duration-200 ${sidebarCollapsed ? "justify-center px-2" : ""} ${activeTab === "logs" ? "bg-indigo-500/10 text-zinc-50" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"}`} 
            title={sidebarCollapsed ? "Analytics" : ""}
          >
            {stats.planType === 'free' ? <Lock className="h-4 w-4 text-slate-500" /> : <Activity className="h-4 w-4" />} 
            {!sidebarCollapsed && "Analytics"}
          </button>
          <button onClick={() => setActiveTab("tutorial")} className={`w-full flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition-all duration-200 ${sidebarCollapsed ? "justify-center px-2" : ""} ${activeTab === "tutorial" ? "bg-indigo-500/10 text-zinc-50" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"}`} title={sidebarCollapsed ? "Setup Tutorial" : ""}>
            <BookOpen className="h-4 w-4" /> {!sidebarCollapsed && "Setup Tutorial"}
          </button>
          <button onClick={() => setActiveTab("consulting")} className={`w-full flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition-all duration-200 ${sidebarCollapsed ? "justify-center px-2" : ""} ${activeTab === "consulting" ? "bg-indigo-500/10 text-zinc-50" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"}`} title={sidebarCollapsed ? "Consulting" : ""}>
            <PhoneCall className="h-4 w-4" /> {!sidebarCollapsed && "Consulting"}
          </button>
          <button onClick={() => setActiveTab("pricing")} className={`w-full flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition-all duration-200 ${sidebarCollapsed ? "justify-center px-2" : ""} ${activeTab === "pricing" ? "bg-indigo-500/10 text-zinc-50" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"}`} title={sidebarCollapsed ? "Billing" : ""}>
            <CreditCard className="h-4 w-4" /> {!sidebarCollapsed && "Billing"}
          </button>
          <button onClick={() => setActiveTab("notifications")} className={`w-full flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition-all duration-200 ${sidebarCollapsed ? "justify-center px-2" : ""} ${activeTab === "notifications" ? "bg-indigo-500/10 text-zinc-50" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"}`} title={sidebarCollapsed ? "Notifications" : ""}>
            <Settings className="h-4 w-4" /> {!sidebarCollapsed && "Notifications"}
          </button>
        </nav>

        <div className="p-4 border-t border-slate-800/60 mt-auto space-y-2">


          <button
            type="button"
            onClick={async () => { await refreshUser(); await fetchStats(); }}
            className={`flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700/50 bg-surface-raised px-4 py-2.5 text-xs font-semibold text-slate-300 transition-colors hover:bg-slate-800 hover:text-white ${sidebarCollapsed ? "px-2" : ""}`}
            title="Refresh plan status"
          >
            <RefreshCw className="h-4 w-4 text-emerald-400" /> {!sidebarCollapsed && "Refresh plan status"}
          </button>

          <a
            href={`mailto:support.flowapi@gmail.com?subject=FlowAPI%20Support%20Request%20-%20${encodeURIComponent(userEmail)}`}
            className={`flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700/50 bg-surface-raised px-4 py-2.5 text-xs font-semibold text-slate-300 transition-colors hover:bg-slate-800 hover:text-white ${sidebarCollapsed ? "px-2" : ""}`}
            title={sidebarCollapsed ? "Contact Support" : ""}
          >
            <Mail className="h-4 w-4 text-cyan-400" /> {!sidebarCollapsed && "Contact Support"}
          </a>

          {!sidebarCollapsed && (
            <div className="pt-1 text-center">
              <Link to="/terms" target="_blank" className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors">Terms</Link>
              <span className="text-[10px] text-slate-500"> & </span>
              <Link to="/privacy" target="_blank" className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors">Privacy</Link>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main Content Container ───────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-screen relative z-10 overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-800/60 bg-surface/80 px-4 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${getBrandConfig(user?.plan_type || 'free')}`}>
              <Zap className="h-4 w-4" />
            </div>
            <h1 className="flex items-center gap-2 text-sm font-medium tracking-tight text-zinc-50">
              <span className="h-2 w-2 rounded-full bg-indigo-500" />
              FlowGateway
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowSecurityModal(true)} className="p-2 text-zinc-500 hover:text-zinc-200"><Shield className="h-4 w-4" /></button>
            <button onClick={handleLogout} className="p-2 text-slate-500 hover:text-rose-400"><LogOut className="h-4 w-4" /></button>
          </div>
        </header>

        {/* Mobile Navigation (Simple Pill Menu below header) */}
        <nav className="md:hidden flex overflow-x-auto border-b border-zinc-900 bg-zinc-950 px-4 gap-6 hide-scrollbar">
          <button onClick={() => setActiveTab("dashboard")} className={`whitespace-nowrap flex items-center gap-1.5 border-b-2 px-1 py-3 text-xs font-medium ${activeTab === "dashboard" ? "border-indigo-500 text-zinc-50" : "border-transparent text-zinc-500 hover:text-zinc-200"}`}>Dashboard</button>
          <button onClick={() => setActiveTab("sandbox")} className={`whitespace-nowrap flex items-center gap-1.5 border-b-2 px-1 py-3 text-xs font-medium ${activeTab === "sandbox" ? "border-indigo-500 text-zinc-50" : "border-transparent text-zinc-500 hover:text-zinc-200"}`}>Sandbox</button>
          <button onClick={() => setActiveTab("destinations")} className={`whitespace-nowrap flex items-center gap-1.5 border-b-2 px-1 py-3 text-xs font-medium ${activeTab === "destinations" ? "border-indigo-500 text-zinc-50" : "border-transparent text-zinc-500 hover:text-zinc-200"}`}>Destinations</button>
          <button onClick={() => setActiveTab("flows")} className={`whitespace-nowrap flex items-center gap-1.5 border-b-2 px-1 py-3 text-xs font-medium ${activeTab === "flows" ? "border-indigo-500 text-zinc-50" : "border-transparent text-zinc-500 hover:text-zinc-200"}`}>Flows</button>
          <button onClick={() => setActiveTab("integrations")} className={`whitespace-nowrap flex items-center gap-1.5 border-b-2 px-1 py-3 text-xs font-medium ${activeTab === "integrations" ? "border-indigo-500 text-zinc-50" : "border-transparent text-zinc-500 hover:text-zinc-200"}`}>Integrations</button>
          <button 
            onClick={() => {
              if (stats.planType === 'free') {
                setUpgradeModal({ isOpen: true, feature: 'Analytics Dashboard', tier: 'Basic or higher' });
              } else {
                setActiveTab("logs");
              }
            }} 
            className={`whitespace-nowrap flex items-center gap-1.5 border-b-2 px-1 py-3 text-xs font-medium ${activeTab === "logs" ? "border-indigo-500 text-zinc-50" : "border-transparent text-zinc-500 hover:text-zinc-200"}`}
          >
            {stats.planType === 'free' && <Lock className="h-3 w-3 text-slate-500" />} Analytics
          </button>
          <button onClick={() => setActiveTab("tutorial")} className={`whitespace-nowrap flex items-center gap-1.5 border-b-2 px-1 py-3 text-xs font-medium ${activeTab === "tutorial" ? "border-indigo-500 text-zinc-50" : "border-transparent text-zinc-500 hover:text-zinc-200"}`}>Tutorial</button>
          <button onClick={() => setActiveTab("consulting")} className={`whitespace-nowrap flex items-center gap-1.5 border-b-2 px-1 py-3 text-xs font-medium ${activeTab === "consulting" ? "border-indigo-500 text-zinc-50" : "border-transparent text-zinc-500 hover:text-zinc-200"}`}>Consulting</button>
          <button onClick={() => setActiveTab("pricing")} className={`whitespace-nowrap flex items-center gap-1.5 border-b-2 px-1 py-3 text-xs font-medium ${activeTab === "pricing" ? "border-indigo-500 text-zinc-50" : "border-transparent text-zinc-500 hover:text-zinc-200"}`}>Billing</button>
          <button onClick={() => setActiveTab("notifications")} className={`whitespace-nowrap flex items-center gap-1.5 border-b-2 px-1 py-3 text-xs font-medium ${activeTab === "notifications" ? "border-indigo-500 text-zinc-50" : "border-transparent text-zinc-500 hover:text-zinc-200"}`}>Notifications</button>
        </nav>

        {/* Desktop Header (Top right tools) */}
        <header className="hidden md:flex sticky top-0 z-30 h-14 items-center justify-end border-b border-slate-800/60 bg-surface/80 px-8 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <button onClick={() => setShowSecurityModal(true)} title="Security & 2FA Settings" className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-colors duration-150 hover:bg-zinc-800 hover:text-zinc-100">
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

              {/* Destination health warning banners */}
              {destinations.length === 0 ? (
                <button
                  onClick={() => setActiveTab("destinations")}
                  className="flex w-full items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-5 py-3.5 text-left transition hover:bg-rose-500/20"
                >
                  <ShieldAlert className="h-5 w-5 shrink-0 text-rose-400" />
                  <span className="text-sm font-semibold text-rose-300">
                    No destinations configured — incoming leads will be lost.
                  </span>
                  <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-rose-400" />
                </button>
              ) : destinations.every((d) => !d.is_active) ? (
                <button
                  onClick={() => setActiveTab("destinations")}
                  className="flex w-full items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-3.5 text-left transition hover:bg-amber-500/20"
                >
                  <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />
                  <span className="text-sm font-semibold text-amber-300">
                    All destinations are inactive — incoming leads will not be delivered.
                  </span>
                  <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-amber-400" />
                </button>
              ) : null}

              {/* Dashboard Top Actions & Stats */}
              <DashboardTopActions
                leads={leads}
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
                hasWebhook={!!generatedWebhook}
              />

              {/* Active Webhooks Table (Smart List) */}
              <WebhooksTable 
                webhooks={webhooks} 
                onRevoke={handleRevokeWebhook}
                onConfigure={handleConfigureWebhook}
                isCollapsed={webhooksCollapsed}
                onToggleCollapse={() => setWebhooksCollapsed(!webhooksCollapsed)}
                onDeleteAll={() => setWipeModal("webhooks")}
                planType={stats.planType}
                setUpgradeModal={setUpgradeModal}
                onTestPing={handleTestPing}
                flows={flows}
                onAssignFlow={handleAssignFlow}
              />

              {/* Lead Ledger Table */}
              <LeadLedger 
                leads={leads} 
                isCollapsed={leadsCollapsed}
                onToggleCollapse={() => setLeadsCollapsed(!leadsCollapsed)}
                onDeleteAll={() => setWipeModal("leads")}
                onRefire={handleRefireLead}
                onCancelJob={handleCancelJob}
                planType={stats.planType}
                setActiveTab={setActiveTab}
              />
            </>
          ) : activeTab === "sandbox" ? (
            <EgressTester leads={leads} destinations={destinations} />
          ) : activeTab === "destinations" ? (
            <DestinationManager setActiveTab={setActiveTab} />
          ) : activeTab === "flows" ? (
            <FlowManager />
          ) : activeTab === "integrations" ? (
            <IntegrationsTab setActiveTab={setActiveTab} />
          ) : activeTab === "logs" ? (
            <WebhookLogs planType={stats.planType} setUpgradeModal={setUpgradeModal} />
          ) : activeTab === "consulting" ? (
            <div className="w-full h-full min-h-[800px] rounded-2xl overflow-hidden border border-slate-800/60 bg-surface">
              <BookingWidget />
            </div>
          ) : activeTab === "pricing" ? (
            <Pricing setActiveTab={setActiveTab} />
          ) : activeTab === "notifications" ? (
            <NotificationPreferences />
          ) : (
            <SetupTutorial onOpenFeatures={() => setShowFeatures(true)} setActiveTab={setActiveTab} />
          )}
        </main>

        {/* Right-Side Metrics Column */}
        {activeTab === "dashboard" && (
          <aside id="tour-metrics-panel" className="w-full lg:w-96 shrink-0 border-t lg:border-t-0 lg:border-l border-zinc-900 bg-zinc-950 p-6 lg:py-8 lg:px-8 space-y-6 lg:h-[calc(100vh-3.5rem)] lg:sticky lg:top-14 overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-emerald-400" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Live Metrics</h3>
              </div>
              <button
                onClick={fetchStats}
                disabled={refreshingStats}
                className="p-1.5 text-zinc-500 hover:text-zinc-200 transition-colors duration-150 disabled:opacity-50 rounded-md hover:bg-zinc-800"
                title="Refresh Metrics"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshingStats ? "animate-spin" : ""}`} />
              </button>
            </div>

            <div className="space-y-4 w-full">
              {/* Tax Avoided */}
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.02] p-5 w-full">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                    <DollarSign className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400/60 leading-none">Tax Avoided</p>
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

              {/* Lead Credits — Growth/Enterprise only */}
              {(user?.tier === "growth" || user?.tier === "enterprise") && creditSummary && (
                <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 w-full">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-indigo-500/10">
                      <CreditCard className="h-4 w-4 text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 leading-none">Lead Credits</p>
                      <p className="text-[9px] text-zinc-500 mt-1">{creditSummary.metered_count} destination(s) metered</p>
                    </div>
                  </div>
                  <div className="font-mono text-2xl font-medium text-zinc-50">
                    {(creditSummary.total_balance ?? 0).toLocaleString()}
                  </div>
                  {creditSummary.paused_count > 0 && (
                    <button
                      onClick={() => setActiveTab("destinations")}
                      className="mt-2 flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 transition-colors"
                    >
                      ● {creditSummary.paused_count} destination{creditSummary.paused_count === 1 ? "" : "s"} paused
                    </button>
                  )}
                </div>
              )}
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



      {/* ── Step-Up Authentication Modal ────────────────────────────────────── */}
      {showStepUpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-800/60 bg-surface-raised/80 p-8 shadow-2xl shadow-black/40 backdrop-blur-sm animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setShowStepUpModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-semibold text-white mb-2 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-blue-400" /> Security Verification
            </h2>
            <p className="text-slate-400 text-sm mb-6">
              Enter your 6-digit Authenticator Code to {stepUpAction.type === 'delete' ? 'revoke this webhook' : 'generate a secure webhook'}.
            </p>
            <div className="space-y-4">
              <div>
                <input
                  type="text"
                  maxLength="6"
                  value={stepUpOtp}
                  onChange={(e) => setStepUpOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-4 text-center text-3xl tracking-[0.5em] text-white placeholder-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-mono"
                />
              </div>
              <div className="pt-2">
                <button
                  onClick={handleVerifyStepUp}
                  disabled={stepUpLoading || stepUpOtp.length < 6}
                  className={`w-full flex items-center justify-center gap-2 text-white py-2.5 rounded-lg text-sm font-medium transition-all shadow-lg ${
                    stepUpAction.type === 'delete' 
                      ? 'bg-red-600 hover:bg-red-500 shadow-red-500/20 disabled:bg-red-600/50 disabled:text-red-200' 
                      : 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/20 disabled:bg-blue-600/50 disabled:text-blue-200'
                  }`}
                >
                  {stepUpLoading ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                      Verifying...
                    </>
                  ) : (
                    stepUpAction.type === 'delete' ? 'Verify & Revoke' : 'Verify & Generate'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
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
                      ? "bg-indigo-500/10 text-zinc-50"
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

              {/* Card 3: Permanent Account Deletion */}
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.04] p-5">
                <div className="mb-2.5 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-500 animate-pulse-slow" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-rose-400">
                    Delete Account
                  </h4>
                </div>
                <p className="text-[11px] text-slate-500 leading-normal mb-4">
                  Permanently delete your FlowAPI account, including all API keys, webhooks, and routing history. This action is irreversible.
                </p>
                <button
                  onClick={() => setShowDeleteAccountModal(true)}
                  className="rounded-lg bg-rose-600/10 border border-rose-550/30 px-4 py-2.5 text-xs font-bold text-rose-400 hover:bg-rose-600 hover:text-white transition w-full"
                >
                  Delete Account & All Data
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

      {/* ── Permanent Account Deletion Modal ────────────────────────────── */}
      {showDeleteAccountModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md rounded-2xl border border-rose-900/40 bg-surface-raised p-6 shadow-2xl shadow-rose-950/20">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-400 mx-auto border border-rose-500/20 animate-shake">
              <AlertTriangle className="h-6 w-6" />
            </div>

            <h3 className="text-center text-base font-bold text-slate-100">
              Permanently Delete Account?
            </h3>
            <p className="mt-2.5 text-center text-xs text-rose-400 font-semibold bg-rose-500/10 p-3 rounded-lg border border-rose-500/20 leading-normal">
              WARNING: This action is permanent and cannot be undone. All API Keys, Webhook Destinations, and routing history will be instantly destroyed.
            </p>
            
            <div className="mt-6 space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block text-center">
                Type <span className="text-rose-400 font-mono font-bold">DELETE</span> to confirm
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full rounded-lg border border-slate-700 bg-surface px-4 py-2.5 text-center font-mono text-sm tracking-[0.2em] font-bold text-slate-200 outline-none transition focus:border-rose-500/40"
              />
            </div>

            <div className="mt-6 flex flex-col gap-2">
              <button
                disabled={deleteConfirmText !== "DELETE" || deletingAccount}
                onClick={handleDeleteAccount}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 py-2.5 text-xs font-bold text-white hover:bg-rose-550 disabled:opacity-50 transition shadow-lg shadow-rose-500/20"
              >
                {deletingAccount ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Permanently Delete My Account"
                )}
              </button>
              <button
                disabled={deletingAccount}
                onClick={() => {
                  setShowDeleteAccountModal(false);
                  setDeleteConfirmText("");
                }}
                className="rounded-lg bg-slate-800 py-2.5 text-xs font-bold text-slate-400 hover:bg-slate-750 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SaaS Tier Upgrade Modal ─────────────────────────────────────── */}
      <UpgradeModal
        isOpen={upgradeModal.isOpen}
        onClose={() => setUpgradeModal({ isOpen: false, feature: "", tier: "" })}
        featureName={upgradeModal.feature}
        requiredTier={upgradeModal.tier}
        onNavigateToPricing={() => setActiveTab("pricing")}
      />

      {/* ── Post-checkout celebration ────────────────────────────────────── */}
      {showCheckoutModal && (
        <CheckoutSuccessModal
          user={user}
          onClose={() => setShowCheckoutModal(false)}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div 
          style={{ zIndex: 99999 }}
          className={`fixed bottom-6 right-6 z-[99999] flex items-center gap-3 rounded-xl border px-5 py-3.5 shadow-xl shadow-black/30 ${
            toast.type === "success" ? "border-emerald-500/30 bg-surface-raised text-emerald-400" : "border-rose-500/30 bg-surface-raised text-rose-400"
          } ${toast.leaving ? "animate-toast-out" : "animate-toast-in"}`}
        >
          {toast.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <X className="h-4 w-4" />}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
