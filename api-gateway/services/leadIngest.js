/**
 * leadIngest.js — Shared lead ingestion pipeline
 *
 * Extracted from routes/catch.js so the exact same field extraction, lead
 * scoring, daily-cap enforcement, lead vaulting and BullMQ enqueue can be
 * reused by every ingress path (the catch-all dispatcher, the public
 * /api/v1/leads endpoint, etc).
 *
 * Behaviour for the catch path is byte-for-byte equivalent to the old inline
 * logic — the only additions are the optional flow_id on the queued job and a
 * `RETURNING id` so callers can surface the vaulted lead id.
 */
import pool, { query } from "../db/connection.js";
import { webhookQueue } from "./queue.js";
import { getUserTier } from "../middleware/requirePlan.js";
import { retryConfig } from "../utils/retryConfig.js";
import { planFor } from "../config/plans.js";

/* ═══════════════════════════════════════════════════════════════════════════
   Helper — Smart Catcher extraction (recursive key finder)
   ═══════════════════════════════════════════════════════════════════════════ */
export function findValue(obj, possibleKeys) {
  if (!obj || typeof obj !== 'object') return undefined;

  for (const key of possibleKeys) {
    if (key in obj && obj[key] !== undefined && obj[key] !== null) {
      return obj[key];
    }
  }

  const commonContainers = ['contact', 'data', 'lead', 'user', 'customer'];
  for (const container of commonContainers) {
    if (obj[container] && typeof obj[container] === 'object') {
      const val = findValue(obj[container], possibleKeys);
      if (val !== undefined && val !== null) return val;
    }
  }

  for (const key in obj) {
    if (obj[key] && typeof obj[key] === 'object' && !commonContainers.includes(key)) {
      const val = findValue(obj[key], possibleKeys);
      if (val !== undefined && val !== null) return val;
    }
  }

  return undefined;
}

export function calculateLeadScore(payload) {
  let score = 50;
  const email = (findValue(payload, ['email', 'Email', 'emailAddress']) || '').toLowerCase();
  const phone = findValue(payload, ['phone', 'Phone', 'phoneNumber']) || '';
  const company = findValue(payload, ['companyName', 'company']) || '';
  const firstName = (findValue(payload, ['first_name', 'firstName', 'first']) || '').toLowerCase();

  if (email.endsWith('@gmail.com') || email.endsWith('@yahoo.com') || email.endsWith('@hotmail.com')) {
    score -= 15;
  } else if (email.includes('@')) {
    score += 25;
  }

  if (phone.length > 7) score += 15;
  if (company.length > 2) score += 10;
  if (firstName.includes('test') || firstName === '') score -= 30;

  return Math.max(0, Math.min(100, score));
}

/**
 * Ingest a single lead: extract fields, score it, enforce the user's daily cap,
 * vault it into ghl_leads and enqueue a dispatch job.
 *
 * @param {object}  args
 * @param {string}  args.userId     - Owning user id.
 * @param {object}  args.payload    - Raw inbound JSON payload (any shape).
 * @param {string}  args.source     - Short label for logging/audit ('catch', 'v1_api', ...).
 * @param {string}  [args.tier]     - User billing tier; drives daily cap + catch-path retry. Looked up if omitted.
 * @param {object}  [args.webhook]  - webhook_keys row (catch path only). When present the
 *                                    queued job dispatches directly to webhook.target_url.
 *                                    When absent the job routes via destinations/flows.
 * @param {object}  [args.headers]  - Inbound headers to forward (catch path).
 * @param {string}  [args.method]   - HTTP method to forward with (catch path).
 * @param {string}  [args.flowId]   - Optional flow id to thread into the dispatch job.
 * @returns {Promise<{ lead_id: string, contact_id: string, score: number, queued: boolean }>}
 */
/**
 * Normalize a Tally webhook payload into a flat object so findValue can
 * extract standard fields (email, name, phone).
 *
 * Tally wraps all answers under data.fields[] as {label, type, value} objects.
 * We flatten by lower-cased label so findValue's key-matching works normally.
 */
function normalizeTally(payload) {
  const fields = payload?.data?.fields;
  if (!Array.isArray(fields)) return payload;

  const flat = {};
  for (const field of fields) {
    if (field.label && field.value !== undefined && field.value !== null) {
      flat[field.label.toLowerCase().replace(/\s+/g, '_')] = field.value;
    }
  }
  return { ...payload, ...flat };
}

export async function ingestLead({
  userId,
  payload,
  source = 'ingest',
  tier,
  webhook = null,
  headers = null,
  method = null,
  flowId = null,
}) {
  const isTest = !!(payload && payload.flow_api_test);

  // Resolve the user's tier once (caller may pass it; else look it up). Drives
  // the daily-cap seed and the catch-path retry config.
  const userTier = tier || (await getUserTier(userId)) || "sandbox";

  // Normalize Tally payloads (data.fields[] → flat keys) before extraction
  const normalizedPayload = normalizeTally(payload);

  // ── Smart Catcher — Lead Data Extraction ────────────────────────────────
  const firstName = findValue(normalizedPayload, ['first_name', 'firstName', 'first']) || '';
  const lastName  = findValue(normalizedPayload, ['last_name', 'lastName', 'last']) || '';
  const email     = findValue(normalizedPayload, ['email', 'Email', 'emailAddress']) || '';
  const phone     = findValue(normalizedPayload, ['phone', 'Phone', 'phoneNumber']) || '';

  let contactId = findValue(normalizedPayload, ['contact_id', 'contactId', 'id', 'contact_key']);
  if (!contactId) {
    const cleanEmail = email ? email.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
    contactId = cleanEmail
      ? `catch_${cleanEmail}`
      : `catch_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  const leadScore = calculateLeadScore(normalizedPayload);

  console.log(`[ingest:${source}] lead=${firstName} ${lastName} contact=${contactId} score=${leadScore}/100`);

  // ── Daily Lead Cap Verification (Row-Level Locking) ──────────────────────
  const client = await pool.connect();
  let capReached = false;
  try {
    await client.query("BEGIN");

    // Ensure the counter row exists for the user, seeded with their plan's
    // daily cap (was a hardcoded 100 regardless of plan).
    await client.query(
      `INSERT INTO lead_counters (user_id, daily_lead_cap, daily_leads_received, last_reset_date)
       VALUES ($1, $2, 0, CURRENT_DATE)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId, planFor(userTier).dailyLeadCap]
    );

    // Acquire exclusive lock on the row to queue concurrent requests
    const counterResult = await client.query(
      `SELECT daily_lead_cap, daily_leads_received, last_reset_date
       FROM lead_counters
       WHERE user_id = $1 FOR UPDATE`,
      [userId]
    );

    let { daily_lead_cap, daily_leads_received, last_reset_date } = counterResult.rows[0];

    // Reset odometer if a new day has started (uses JS dates to avoid DB timezone traps)
    const today = new Date().toISOString().split("T")[0];
    const lastReset = new Date(last_reset_date).toISOString().split("T")[0];

    if (today !== lastReset) {
      daily_leads_received = 0;
    }

    if (daily_leads_received >= daily_lead_cap) {
      await client.query("ROLLBACK");
      capReached = true;
    } else {
      // Increment the counter and commit the transaction
      await client.query(
        `UPDATE lead_counters
         SET daily_leads_received = $1 + 1, last_reset_date = CURRENT_DATE
         WHERE user_id = $2`,
        [daily_leads_received, userId]
      );
      await client.query("COMMIT");
    }
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  if (capReached) {
    const err = new Error("Daily lead cap reached. Please upgrade your plan or wait until tomorrow.");
    err.status = 429;
    err.code = "DAILY_CAP_REACHED";
    throw err;
  }

  // ── Vault the lead ───────────────────────────────────────────────────────
  const webhookKeyId = webhook ? webhook.id : null;
  const vaultResult = await query(
    `INSERT INTO ghl_leads (contact_id, raw_payload, webhook_key_id, lead_score, first_name, last_name, email, phone, delivery_status, retry_count, user_id, is_test)
     VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (contact_id, user_id) DO UPDATE SET
       webhook_key_id = EXCLUDED.webhook_key_id,
       lead_score = EXCLUDED.lead_score,
       first_name = EXCLUDED.first_name,
       last_name = EXCLUDED.last_name,
       email = EXCLUDED.email,
       phone = EXCLUDED.phone,
       delivery_status = EXCLUDED.delivery_status,
       retry_count = EXCLUDED.retry_count,
       is_test = EXCLUDED.is_test
     RETURNING id`,
    [contactId, JSON.stringify(payload), webhookKeyId, leadScore, firstName, lastName, email, phone, 'PENDING', 0, userId, isTest]
  );
  const leadId = vaultResult.rows[0]?.id;

  // ── Queue Webhook Dispatch Job ───────────────────────────────────────────
  if (webhook) {
    // Catch path: dispatch directly to the single configured target_url, using
    // the shared tier-based retry config (single source of truth — same as the
    // queue-routing path in WebhookDispatcher.dispatchLead).
    const { attempts, backoff } = retryConfig(userTier);

    const job = await webhookQueue.add(
      "dispatch",
      {
        webhook,
        payload,
        headers,
        method: method || webhook.http_method || "POST",
        contactId,
        leadId,
        isTest,
        tier: userTier,
        flow_id: flowId ?? null,
      },
      {
        attempts,
        backoff,
        removeOnComplete: true,
        removeOnFail: false,
      }
    );
    if (job?.id) {
      await query(
        'UPDATE ghl_leads SET bullmq_job_id = $1 WHERE id = $2',
        [job.id, leadId]
      ).catch(() => {});
    }
  } else {
    // Destination/flow routing path: the worker fans the lead out via
    // dispatchLead(), which performs its own tier-based retry handling, so the
    // outer job only needs a single attempt.
    const job = await webhookQueue.add(
      "dispatch",
      {
        userId,
        payload,
        contactId,
        leadId,
        isTest,
        source,
        flow_id: flowId ?? null,
      },
      {
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: false,
      }
    );
    if (job?.id) {
      await query(
        'UPDATE ghl_leads SET bullmq_job_id = $1 WHERE id = $2',
        [job.id, leadId]
      ).catch(() => {});
    }
  }

  return { lead_id: leadId, contact_id: contactId, score: leadScore, queued: true };
}
