import { Router } from "express";
import { authenticate, apiKeyAuth, webhookIngressLimiter, getPlanType } from "../middleware/index.js";
import pool, { query } from "../db/connection.js";
import { webhookQueue } from "../services/queue.js";
import { dispatchLead } from "../services/WebhookDispatcher.js";

function findValue(obj, possibleKeys) {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const key of possibleKeys) {
    if (key in obj && obj[key] !== undefined && obj[key] !== null) return obj[key];
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

const router = Router();

/**
 * POST /api/leads/inbound
 * 
 * Machine-to-machine webhook ingestion using API Keys.
 * 1. Authenticates via apiKeyAuth (attaches req.user.id)
 * 2. Rate limits via webhookIngressLimiter
 * 3. Enforces daily lead caps
 * 4. Vaults lead and queues a dispatch job for ALL active destinations configured by the user.
 */
router.post("/inbound", apiKeyAuth, webhookIngressLimiter, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const payload = req.body;
    const isTest = !!(payload && payload.flow_api_test);

    // 1. Check daily lead cap
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO lead_counters (user_id, daily_lead_cap, daily_leads_received, last_reset_date) 
         VALUES ($1, 100, 0, CURRENT_DATE) 
         ON CONFLICT (user_id) DO NOTHING`,
        [userId]
      );

      const counterResult = await client.query(
        `SELECT daily_lead_cap, daily_leads_received, last_reset_date 
         FROM lead_counters 
         WHERE user_id = $1 FOR UPDATE`,
        [userId]
      );
      let { daily_lead_cap, daily_leads_received, last_reset_date } = counterResult.rows[0];
      const today = new Date().toISOString().split("T")[0];
      const lastReset = new Date(last_reset_date).toISOString().split("T")[0];

      if (today !== lastReset) daily_leads_received = 0;

      if (daily_leads_received >= daily_lead_cap) {
        await client.query("ROLLBACK");
        client.release();
        return res.status(429).json({
          success: false,
          message: "Daily lead cap reached. Please upgrade your plan or wait until tomorrow.",
        });
      }

      await client.query(
        `UPDATE lead_counters 
         SET daily_leads_received = $1 + 1, last_reset_date = CURRENT_DATE 
         WHERE user_id = $2`,
        [daily_leads_received, userId]
      );
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    // 2. Look up user's active destinations
    const webhooksResult = await query(
      `SELECT id, target_url, http_method, masked_key, custom_headers 
       FROM webhook_keys 
       WHERE user_id = $1`,
      [userId]
    );

    const activeDestinations = webhooksResult.rows.filter(w => w.target_url);

    // 3. Extract Lead Info
    const firstName = findValue(payload, ['first_name', 'firstName', 'first']) || '';
    const lastName  = findValue(payload, ['last_name', 'lastName', 'last']) || '';
    const email     = findValue(payload, ['email', 'Email', 'emailAddress']) || '';
    const phone     = findValue(payload, ['phone', 'Phone', 'phoneNumber']) || '';
    let contactId = findValue(payload, ['contact_id', 'contactId', 'id', 'contact_key']);
    
    if (!contactId) {
      const cleanEmail = email ? email.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
      contactId = cleanEmail ? `catch_${cleanEmail}` : `catch_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    }
    const leadScore = calculateLeadScore(payload);

    // 4. Vault the lead
    const primaryWebhookId = activeDestinations.length > 0 ? activeDestinations[0].id : null;
    await query(
      `INSERT INTO ghl_leads (contact_id, raw_payload, status, webhook_key_id, lead_score, first_name, last_name, email, phone, delivery_status, retry_count, user_id, is_test)
       VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (contact_id) DO UPDATE SET
         status = EXCLUDED.status,
         raw_payload = EXCLUDED.raw_payload,
         lead_score = EXCLUDED.lead_score,
         first_name = EXCLUDED.first_name,
         last_name = EXCLUDED.last_name,
         email = EXCLUDED.email,
         phone = EXCLUDED.phone,
         delivery_status = EXCLUDED.delivery_status,
         retry_count = EXCLUDED.retry_count,
         is_test = EXCLUDED.is_test`,
      [contactId, JSON.stringify(payload), 'PENDING', primaryWebhookId, leadScore, firstName, lastName, email, phone, 'PENDING', 0, userId, isTest]
    );

    // 5. Trigger Multi-Mode Smart Dispatcher
    const dispatchResult = await dispatchLead(userId, payload, contactId, isTest);

    if (!dispatchResult.success) {
      return res.status(422).json(dispatchResult);
    }

    return res.status(200).json(dispatchResult);
  } catch (error) {
    console.error("[inbound] Error processing lead:", error);
    next(error);
  }
});

/**
 * POST /api/leads/simulate
 *
 * JWT-protected route that fires a mock lead payload to the configured
 * destination webhook for enrichment testing, then returns the response
 * back to the frontend.
 */
router.post("/simulate", authenticate, async (req, res, next) => {
  const destinationUrl = process.env.DESTINATION_WEBHOOK_URL;

  if (!destinationUrl) {
    return res.status(503).json({
      status: 503,
      error: "Service Unavailable",
      message: "No DESTINATION_WEBHOOK_URL configured on the server.",
    });
  }

  try {
    const leadPayload = {
      name: "Sarah Tech",
      email: "sarah.tech@example.com",
      source: "Dashboard",
      tags: ["manual_trigger"],
      triggered_by: req.user?.email || req.user?.id,
      triggered_at: new Date().toISOString(),
    };

    console.log("[leads] Simulating lead enrichment →", destinationUrl);

    const webhookRes = await fetch(destinationUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(leadPayload),
    });

    const webhookData = await webhookRes.text();

    // Try to parse as JSON; fall back to raw text
    let parsed;
    try {
      parsed = JSON.parse(webhookData);
    } catch {
      parsed = { raw: webhookData };
    }

    console.log("[leads] Destination webhook responded:", webhookRes.status);

    return res.json({
      status: 200,
      message: "Lead enrichment triggered successfully",
      lead: leadPayload,
      webhook: {
        status: webhookRes.status,
        data: parsed,
      },
    });
  } catch (err) {
    // If the destination is unreachable, return a clear error instead of crashing
    if (err.cause?.code === "ECONNREFUSED") {
      return res.status(502).json({
        status: 502,
        error: "Bad Gateway",
        message: "Destination webhook is unreachable — is your endpoint online?",
      });
    }
    next(err);
  }
});

export default router;
