# FlowAPI — Lead Routing Engine

> **Stop chasing stale lists. Route live leads in milliseconds.**

FlowAPI is the enterprise-grade webhook routing engine built for lead brokers and performance marketing agencies. Capture a lead once, deliver it to every buyer instantly — no manual uploads, no spreadsheet hell, no missed conversions.

**Live platform:** [flowgateway.dev](https://flowgateway.dev)

---

## The Problem We Solve

Lead brokers spend hours every day doing work that should be instantaneous. A lead comes in from a form, an affiliate, or a CRM — and someone has to manually route it to the right buyer before it goes cold. By the time it lands, it's stale. By the time the buyer works it, the prospect has moved on.

FlowAPI eliminates that gap entirely. Your leads move from capture to your buyer's CRM in under 50ms.

---

## How It Works

```
Lead Source  →  FlowAPI Routing Engine  →  Buyer CRM / Webhook
(Any CRM)        (Cap · Score · Queue)      (GHL, Salesforce, etc.)
```

**1. Inbound Capture** — Push any JSON payload to your unique webhook endpoint using your API key. FlowAPI accepts data from any source — GoHighLevel, web forms, affiliate networks, or custom integrations.

**2. The Routing Engine** — Every lead is scored, deduplicated, and checked against each buyer's daily cap before dispatch. The engine enforces your rules automatically, 24/7.

**3. Outbound Delivery** — FlowAPI forwards the payload to your buyer's endpoint using round-robin (first available buyer) or broadcast (all buyers simultaneously) routing. Failed deliveries are automatically retried based on your plan tier.

---

## Key Features

### Smart Lead Routing
- **Round-Robin** — Distribute leads sequentially across your buyer network, respecting each buyer's daily cap
- **Broadcast** — Deliver the same lead to all active destinations simultaneously
- **Daily Caps per Buyer** — Never oversell a campaign. Set per-destination limits and let the engine manage the math automatically

### Reliability at Every Tier
- **Automatic Retries** — Growth accounts get 3 retry attempts; Enterprise accounts get up to 100 with exponential backoff, so no lead is lost to a momentary downstream outage
- **Delivery Status Tracking** — Every lead carries a live status: `PENDING → DELIVERED / RETRYING / FAILED`
- **Webhook Audit Logs** — Full delivery history with request payloads and response codes, retained based on your plan

### Enterprise-Grade Security
- **SHA-256 Hashed API Keys** — Plaintext keys are never stored; only a cryptographic hash lives in the database
- **Two-Factor Authentication** — TOTP-based 2FA with QR code setup for every account
- **Step-Up OTP Verification** — Sensitive operations (generating new API keys) require a fresh email OTP, with a 72-hour trusted device bypass for convenience
- **DNS Rebinding Protection** — Every outbound dispatch resolves the target hostname and blocks private/internal IP ranges to prevent SSRF attacks
- **SSRF-Safe URL Validation** — Destination URLs are validated against a strict allowlist at save time, rejecting local networks, cloud metadata endpoints, and `.local` domains

### Lead Intelligence
- **Automatic Lead Scoring** — Every inbound lead receives a 0–100 quality score based on email domain, phone completeness, company presence, and name validity — no configuration required
- **Smart Field Extraction** — FlowAPI recursively parses arbitrarily nested CRM payloads, so a `contact.email` and a root-level `email` field are both handled without custom mapping
- **Meta/Facebook Webhook Verification** — Built-in support for the `hub.challenge` handshake, so you can connect Facebook Lead Ads directly without any additional tooling

### Compliance Built In
- **GDPR Right to Erasure** — One API call permanently deletes an account and cascades removal of all associated leads, webhooks, and logs
- **Plan-Gated Log Retention** — Logs are automatically purged nightly: 7 days for free accounts, 30 days for Pro, unlimited for Plus

---

## Pricing

| | **Sandbox** | **Growth** | **Enterprise** |
|---|---|---|---|
| **Price** | Free | $99/mo | $249/mo |
| **Requests/day** | 500 | 10,000 | 100,000 |
| **Destinations** | 1 | Up to 5 | Unlimited |
| **Retry Queue** | None | 3× fixed backoff | 100× exponential backoff |
| **Log Retention** | 7 days | 30 days | Unlimited |
| **Custom Headers** | — | — | Yes |

[Get started free →](https://flowgateway.dev)

---

## Tech Stack

| Layer | Technology |
|---|---|
| API / Backend | Node.js 18+, Express 4 |
| Database | PostgreSQL 16 (via PgBouncer connection pooling) |
| Cache / Rate Limiting | Redis 7 |
| Job Queue | BullMQ |
| Frontend Dashboard | React 18, Vite, Tailwind CSS |
| Validation | Zod |
| Auth | JWT (HttpOnly cookies), bcrypt, speakeasy TOTP |
| Email | Nodemailer / Resend |
| Payments | Stripe |
| Container | Docker + Docker Compose |

---

## Self-Hosting

### Prerequisites
- Node.js ≥ 18
- PostgreSQL 16
- Redis 7
- Docker & Docker Compose (recommended)

### Quickstart

```bash
# 1. Clone the repository
git clone https://github.com/kachirich/flowapi.git
cd flowapi

# 2. Configure the API gateway
cp api-gateway/.env.example api-gateway/.env
# Edit api-gateway/.env — set JWT_SECRET, PGPASSWORD, and any Stripe/email keys

# 3. Start all infrastructure services (Postgres, PgBouncer, Redis) + the gateway
cd api-gateway
docker compose up -d

# 4. Start the frontend dashboard (separate terminal)
cd flow-dashboard
npm install
npm run dev
```

The API gateway runs on `http://localhost:3000`. The dashboard dev server runs on `http://localhost:5173`.

Database schema is applied automatically on first startup — no manual migration steps required.

### Environment Variables

See [`api-gateway/.env.example`](api-gateway/.env.example) for the full list. The minimum required to boot:

```
JWT_SECRET=<long-random-string>
PGHOST=localhost
PGPORT=6432
PGDATABASE=flow_gateway
PGUSER=postgres
PGPASSWORD=<your-password>
REDIS_URL=redis://127.0.0.1:6379
CORS_ORIGIN=http://localhost:5173
```

---

## Routing Your First Lead

Once the gateway is running:

**1. Generate an API key** from the dashboard or via `POST /api/keys`.

**2. Configure a destination** — the buyer's webhook URL — via `POST /api/destinations`.

**3. Send a lead** to your webhook endpoint:

```bash
curl -X POST https://flowgateway.dev/api/catch/<your-webhook-id> \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Jane",
    "last_name": "Smith",
    "email": "jane@acmecorp.com",
    "phone": "+1-555-0100"
  }'
```

FlowAPI scores, stores, and dispatches the lead — and returns `200` before the buyer even knows it's coming.

---

## License

© 2026 FlowAPI. All rights reserved.
