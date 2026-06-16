# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Identity

**FlowGateway / FlowAPI** — Main active project. Lead routing gateway and brokerage platform.

- **Brand:** FlowAPI (domain: flowgateway.dev)
- **Market:** Whitelabel lead intelligence platform targeting Nairobi/Kenya SMEs
- **Target buyers:** KCB, Pesapal
- **Core flow:** API key → webhook URL → GHL/Tally → routes to buyer destination
- **Planned AI layer:** Lead scoring agent using Anthropic API — scores incoming leads against buyer specs before routing
- **Status:** Work in progress

## Project Overview

FlowAPI is a lead-routing platform that receives incoming webhooks (primarily from GoHighLevel/GHL), scores and stores leads, then dispatches them to configured downstream destinations using round-robin or broadcast strategies with tier-based retry logic.

Three components:
- `api-gateway/` — Node.js/Express backend (the main service)
- `flow-dashboard/` — React/Vite frontend dashboard
- `authkit-service/` — Minimal separate auth microservice (stub/secondary)

## Commands

### api-gateway
```bash
cd api-gateway
npm run dev          # Development with --watch
npm start            # Production
npm test             # Run all tests (vitest, requires live DB + Redis)
npm run test:watch   # Watch mode
npm run seed         # Seed the database
```

### flow-dashboard
```bash
cd flow-dashboard
npm run dev          # Start Vite dev server
npm run build        # Production build
npm run lint         # ESLint
npm run preview      # Preview production build
```

### Run a single test file
```bash
cd api-gateway && npx vitest run tests/integration.test.js --reporter verbose
```

### Docker (api-gateway)
```bash
cd api-gateway
docker compose up -d    # Start PostgreSQL, PgBouncer, Redis, and api-gateway
docker compose down     # Stop all services
```

## Environment Setup

Copy `api-gateway/.env.example` to `api-gateway/.env`. Required vars:
- `PGHOST`, `PGPORT` (default 6432 for PgBouncer), `PGDATABASE`, `PGUSER`, `PGPASSWORD`
- `JWT_SECRET` — must be a long random string
- `REDIS_URL` — defaults to `redis://127.0.0.1:6379`
- `CORS_ORIGIN` — comma-separated allowed frontend origins (e.g. `http://localhost:5173`)

Frontend uses `VITE_API_BASE_URL` (defaults to `http://localhost:3000`).

**Database schema is auto-applied on startup** via `initializeDatabase()` in `db/connection.js` — no manual migrations needed for local dev. The file runs idempotent `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ADD COLUMN IF NOT EXISTS` statements.

## Architecture

### Request Flow (Webhook Ingress)

`POST /api/catch/:webhook_id` is the core ingress path:
1. Looks up `webhook_keys` by UUID — identifies the owning user
2. Runs `meteredLimiter` — enforces monthly request quota (Redis-backed, plan-gated)
3. Daily lead cap check — uses a PostgreSQL `SELECT ... FOR UPDATE` transaction on `lead_counters`
4. Extracts lead fields via `findValue()` — recursive key finder handles arbitrary nesting from any CRM
5. Calculates a `lead_score` (0–100) based on email domain, phone, company presence
6. Upserts into `ghl_leads` with `ON CONFLICT (contact_id) DO UPDATE`
7. Queues a BullMQ job on `webhook-dispatch` queue with tier-based retry config
8. Returns `200` immediately; actual delivery is async

### Delivery and Retry Tiers

Configured in `services/queue.js` and `services/WebhookDispatcher.js`:
- **sandbox**: 1 attempt, no retry
- **growth**: 3 attempts, fixed 5s backoff
- **enterprise**: 100 attempts, exponential 5s backoff

`WebhookDispatcher.dispatchLead()` handles two routing strategies (set per user):
- `round_robin`: deliver to the first destination under its daily cap, stop
- `broadcast`: deliver to ALL destinations under cap

Daily destination caps are enforced with an atomic Redis Lua script (`CHECK_CAP_LUA`) keyed as `destination:leads:{id}:{date}`.

Before each HTTP dispatch, DNS resolution is checked to block internal IP ranges (SSRF protection). Test payloads (`flow_api_test: true`) bypass the DNS check.

### Plan & Billing Middleware

`requirePlan(...allowedPlans)` in `middleware/requirePlan.js` gates routes by billing tier. It reads from Redis first (`user:{id}:plan`, 15-min TTL) then falls back to Postgres. Plan type is attached to `req.user.plan_type` for downstream use.

`meteredLimiter` enforces monthly quotas: 10k (free/basic), 100k (pro), unlimited (plus). Resets roll at 30-day intervals tracked in `users.billing_cycle_reset`.

### Authentication

JWT is read from `req.cookies.jwt` (preferred) OR `Authorization: Bearer <token>`. Tokens are issued as HttpOnly cookies on login (`SameSite: Strict`).

On logout, the JWT is written to a Redis blacklist (`blacklist:{token}`, 24h TTL).

Sensitive actions (webhook key generation) require **step-up OTP** via email. A successful OTP verification mints a `trustedDeviceToken` (72h JWT) stored in `x-trusted-device-token` header to bypass repeated OTPs on the same device.

API key auth (`x-api-key` header) is an alternative path handled by `middleware/apiKeyAuth.js`, which SHA-256 hashes the key and looks it up in `api_keys`.

### Database Schema

All tables are owned and managed by `db/connection.js:initializeDatabase()`. Key tables:
- `users` — identity, plan_type, tier, Stripe fields, 2FA, monthly_request_count
- `webhook_keys` — per-user webhook endpoints with `target_url`, `http_method`, `custom_headers`
- `destinations` — named delivery targets with `daily_cap`
- `ghl_leads` — lead vault; `delivery_status` tracks `PENDING → DELIVERED/RETRYING/FAILED/CANCELED`
- `webhook_logs` — delivery audit log; retention is plan-gated (7d free, 30d pro, unlimited plus)
- `lead_counters` — daily ingress caps per user (row-lock increment)
- `api_keys` — hashed API keys (never store plaintext)
- `otps` — email OTP codes with `expires_at`
- `guest_sessions` — live demo/tech demo flow sessions

### Janitor Service

`services/janitor.service.js` runs a cron job at midnight to purge `webhook_logs` per retention policy. It's started at server startup alongside Redis connect.

### Frontend Auth Flow

`AuthContext` (`flow-dashboard/src/context/AuthContext.jsx`) calls `GET /api/auth/me` on load to rehydrate session from the HttpOnly cookie. The Axios client (`utils/api.js`) auto-redirects to `/login` on any 401, except during the `/api/auth/me` initialization check to avoid redirect loops.

## Key Conventions

### SSRF Protection
All outbound URLs go through two layers:
1. **Zod validation** (`middleware/validateRequest.js`) at input time — blocks internal IP ranges and requires `https://`
2. **DNS rebinding check** (`WebhookDispatcher.attemptHttpRequest`) at dispatch time — resolves hostname and blocks private ranges

Custom headers on webhook destinations are only forwarded for `pro`/`plus` plans, and headers like `host`, `content-length`, `connection` are always blocked.

### Rate Limiters
All rate limiters are Redis-backed (`RedisStore`) and are automatically **skipped in development** (when `NODE_ENV === 'development'` or request comes from localhost). Each limiter uses a unified `globalKeyGenerator` that prefers `req.user.id` over IP to prevent shared-IP false positives.

### Integration Tests
Tests in `api-gateway/tests/integration.test.js` require a live PostgreSQL and Redis connection. They create/delete real DB rows. `app.js` exports the Express app without calling `listen()` specifically to support Supertest.

### Error Responses
All routes return `{ success: boolean, message?: string, error?: string }`. The global error handler in `app.js` sanitizes 5xx responses to prevent data leaks while passing 4xx messages through intact.

### Zod Validation
Use `validateRequest(schema)` middleware factory from `middleware/validateRequest.js` to validate request bodies. It replaces `req.body` with the Zod-parsed result (sanitized). Add new schemas to that file.
