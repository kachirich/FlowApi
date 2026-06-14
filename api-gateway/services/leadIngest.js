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
import { getPlanType } from "../middleware/requirePlan.js";

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
 * @param {string}  [args.tier]     - User billing tier (informational; reserved).
 * @param {string}  [args.plan_type]- User plan type, used for catch-style retry config.
 * @param {object}  [args.webhook]  - webhook_keys row (catch path only). When present the
 *                                    queued job dispatches directly to webhook.target_url.
 *                                    When absent the job routes via destinations/flows.
 * @param {object}  [args.headers]  - Inbound headers to forward (catch path).
 * @param {string}  [args.method]   - HTTP method to forward with (catch path).
 * @param {string}  [args.flowId]   - Optional flow id to thread into the dispatch job.
 * @returns {Promise<{ lead_id: string, contact_id: string, score: number, queued: boolean }>}
 */
export async function ingestLead({
  userId,
  payload,
  source = 'ingest',
  tier,
  plan_type,
  webhook = null,
  headers = null,
  method = null,
  flowId = null,
}) {
  const isTest = !!(payload && payload.flow_api_test);

  // ── Smart Catcher — Lead Data Extraction ────────────────────────────────
  const firstName = findValue(payload, ['first_name', 'firstName', 'first']) || '';
  const lastName  = findValue(payload, ['last_name', 'lastName', 'last']) || '';
  const email     = findValue(payload, ['email', 'Email', 'emailAddress']) || '';
  const phone     = findValue(payload, ['phone', 'Phone', 'phoneNumber']) || '';

  let contactId = findValue(payload, ['contact_id', 'contactId', 'id', 'contact_key']);
  if (!contactId) {
    const cleanEmail = email ? email.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
    contactId = cleanEmail
      ? `catch_${cleanEmail}`
      : `catch_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  const leadScore = calculateLeadScore(payload);

  console.log(`[ingest:${source}] lead=${firstName} ${lastName} contact=${contactId} score=${leadScore}/100`);

  // ── Daily Lead Cap Verification (Row-Level Locking) ──────────────────────
  const client = await pool.connect();
  let capReached = false;
  try {
    await client.query("BEGIN");

    // Ensure the counter row exists for the user
    await client.query(
      `INSERT INTO lead_counters (user_id, daily_lead_cap, daily_leads_received, last_reset_date)
       VALUES ($1, 100, 0, CURRENT_DATE)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId]
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
    `INSERT INTO ghl_leads (contact_id, raw_payload, status, webhook_key_id, lead_score, first_name, last_name, email, phone, delivery_status, retry_count, user_id, is_test)
     VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     ON CONFLICT (contact_id) DO UPDATE SET
       status = EXCLUDED.status,
       webhook_key_id = EXCLUDED.webhook_key_id,
       lead_score = EXCLUDED.lead_score,
       first_name = EXCLUDED.first_name,
       last_name = EXCLUDED.last_name,
       email = EXCLUDED.email,
       phone = EXCLUDED.phone,
       delivery_status = EXCLUDED.delivery_status,
       retry_count = EXCLUDED.retry_count,
       user_id = EXCLUDED.user_id,
       is_test = EXCLUDED.is_test
     RETURNING id`,
    [contactId, JSON.stringify(payload), 'PENDING', webhookKeyId, leadScore, firstName, lastName, email, phone, 'PENDING', 0, userId, isTest]
  );
  const leadId = vaultResult.rows[0]?.id;

  // ── Queue Webhook Dispatch Job ───────────────────────────────────────────
  if (webhook) {
    // Catch path: dispatch directly to the single configured target_url, with
    // the exact same plan-based retry config as before.
    const planType = plan_type || (await getPlanType(userId)) || "free";

    let attempts = 1;
    let backoff = undefined;
    if (planType === "pro") {
      attempts = 5;
      backoff = { type: "exponential", delay: 5000 };
    } else if (planType === "plus") {
      attempts = 10;
      backoff = { type: "exponential", delay: 5000 };
    }

    await webhookQueue.add(
      "dispatch",
      {
        webhook,
        payload,
        headers,
        method: method || webhook.http_method || "POST",
        contactId,
        isTest,
        flow_id: flowId ?? null,
      },
      {
        attempts,
        backoff,
        removeOnComplete: true,
        removeOnFail: false,
      }
    );
  } else {
    // Destination/flow routing path: the worker fans the lead out via
    // dispatchLead(), which performs its own tier-based retry handling, so the
    // outer job only needs a single attempt.
    await webhookQueue.add(
      "dispatch",
      {
        userId,
        payload,
        contactId,
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
  }

  return { lead_id: leadId, contact_id: contactId, score: leadScore, queued: true };
}
