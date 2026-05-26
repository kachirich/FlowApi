import { Router } from "express";
import meteredLimiter from "../middleware/meteredLimiter.js";
import { webhookIngressLimiter } from "../middleware/rateLimiter.js";
import { query } from "../db/connection.js";
import { webhookQueue } from "../services/queue.js";

const router = Router();

/* ═══════════════════════════════════════════════════════════════════════════
   Helper — Smart Catcher extraction (recursive key finder)
   ═══════════════════════════════════════════════════════════════════════════ */
function findValue(obj, possibleKeys) {
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

function calculateLeadScore(payload) {
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

/* ═══════════════════════════════════════════════════════════════════════════
   GET /api/catch/:webhook_id  —  Platform Verification (Meta / Facebook)
   
   Meta sends a GET request to verify endpoint ownership.
   ═══════════════════════════════════════════════════════════════════════════ */
router.get("/:webhook_id", (req, res) => {
  const mode = req.query["hub.mode"];
  const challenge = req.query["hub.challenge"];
  
  if (mode === "subscribe" && challenge) {
    // Return only the challenge as a raw string with a 200 OK
    return res.status(200).send(challenge);
  }

  // Standard GET fallback so users can ping it in their browser
  return res.status(200).send("FlowAPI Gateway Active");
});

/* ═══════════════════════════════════════════════════════════════════════════
   ALL /api/catch/:webhook_id  —  Dynamic Dispatcher (catch-all)

   Accepts ANY HTTP method. Looks up the webhook by UUID, enforces metered
   billing, forwards the payload to the configured target_url using the
   stored http_method, and logs every event to webhook_logs.
   ═══════════════════════════════════════════════════════════════════════════ */
router.all("/:webhook_id", webhookIngressLimiter, async (req, res) => {
  const { webhook_id } = req.params;

  try {
    // ── Step 1: Look up webhook by UUID ──────────────────────────────────
    const webhookResult = await query(
      `SELECT id, user_id, target_url, http_method, masked_key, custom_headers
       FROM webhook_keys WHERE id = $1`,
      [webhook_id]
    );

    if (webhookResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Webhook not found",
      });
    }

    const webhook = webhookResult.rows[0];
    const userId = webhook.user_id;
    const webhookId = webhook.id;

    // Attach webhookKey info so meteredLimiter can read it
    req.webhookKey = { userId, id: webhookId };

    // ── Step 2: Metered Rate Limiter ────────────────────────────────────
    const limiterError = await new Promise((resolve) => {
      meteredLimiter(req, res, (err) => resolve(err || null));
    });

    // If meteredLimiter already sent a response (429), stop here
    if (res.headersSent) return;
    if (limiterError) throw limiterError;

    const payload = req.body;
    const isTest = !!(payload && payload.flow_api_test);

    // ── Step 3: Check target_url ────────────────────────────────────────
    if (!webhook.target_url) {
      await query(
        `INSERT INTO webhook_logs (user_id, webhook_id, method, status_code, request_payload, response_error, is_test)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, webhookId, req.method, 400, JSON.stringify(payload), "No destination configured", isTest]
      ).catch(e => console.error("Failed to log webhook 400:", e.message));

      return res.status(400).json({
        success: false,
        message: "No destination configured for this webhook. Please set a target URL.",
      });
    }

    // ── Step 4: Smart Catcher — Lead Data Extraction ────────────────────
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

    console.log("\n" + "═".repeat(60));
    console.log(`🚀 DYNAMIC DISPATCHER — Webhook ${webhook.masked_key}`);
    console.log(`👤 Lead: ${firstName} ${lastName}`);
    console.log(`🆔 Contact ID: ${contactId}`);
    console.log(`🧠 Lead Score: ${leadScore}/100`);
    console.log(`📡 Forwarding → ${webhook.target_url} [${(webhook.http_method || 'POST').toUpperCase()}]`);
    console.log("═".repeat(60) + "\n");

    // ── Step 5: Vault the lead ──────────────────────────────────────────
    await query(
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
         is_test = EXCLUDED.is_test`,
      [contactId, JSON.stringify(payload), 'PENDING', webhookId, leadScore, firstName, lastName, email, phone, 'PENDING', 0, userId, isTest]
    );

    // ── Step 6: Queue Webhook Dispatch Job ────────────────────────────────
    const userResult = await query("SELECT plan_type FROM users WHERE id = $1", [userId]);
    const planType = userResult.rows[0]?.plan_type || "free";

    let attempts = 1;
    let backoff = undefined;

    if (planType === "pro") {
      attempts = 5;
      backoff = { type: "exponential", delay: 5000 };
    } else if (planType === "plus") {
      attempts = 10;
      backoff = { type: "exponential", delay: 5000 };
    }

    const job = await webhookQueue.add(
      "dispatch",
      {
        webhook,
        payload,
        headers: req.headers,
        method: webhook.http_method || "POST",
        contactId,
        isTest,
      },
      {
        attempts,
        backoff,
        removeOnComplete: true,
        removeOnFail: false,
      }
    );


    return res.status(200).json({
      success: true,
      message: "Webhook queued for processing",
    });

  } catch (error) {
    console.error("[catch] Error processing webhook:", error);

    const isTestCatch = !!(req.body && req.body.flow_api_test);
    await query(
      `INSERT INTO webhook_logs (user_id, webhook_id, method, status_code, request_payload, response_error, is_test)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [req.webhookKey?.userId, req.webhookKey?.id, req.method, 500, JSON.stringify(req.body), error.message, isTestCatch]
    ).catch(e => console.error("Failed to log webhook 500:", e.message));

    return res.status(500).json({
      success: false,
      message: "Internal server error while processing webhook",
    });
  }
});

export default router;
