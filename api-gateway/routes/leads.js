import { Router } from "express";
import { authenticate, apiKeyAuth, webhookIngressLimiter, getPlanType } from "../middleware/index.js";
import pool, { query } from "../db/connection.js";
import { webhookQueue } from "../services/queue.js";
import { dispatchLead } from "../services/WebhookDispatcher.js";
import meteredLimiter from "../middleware/meteredLimiter.js";
import { findValue, calculateLeadScore } from "../services/leadIngest.js";
import { webhookDestinationSchema } from "../middleware/validateRequest.js";
import redisClient from "../utils/redisClient.js";

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
    // meteredLimiter requires req.webhookKey.userId — set it from the authenticated API key
    req.webhookKey = { userId: req.user.id, id: req.user.key_id };

    // ── Idempotency check ────────────────────────────────────────────────
    const idempotencyKey = req.headers["x-idempotency-key"];
    if (idempotencyKey) {
      const cacheKey = `idempotency:inbound:${req.user.id}:${idempotencyKey}`;
      const cached = await redisClient.get(cacheKey).catch(() => null);
      if (cached) return res.status(200).json(JSON.parse(cached));
    }
    const limiterError = await new Promise(resolve => {
      meteredLimiter(req, res, err => resolve(err || null));
    });
    if (res.headersSent) return;
    if (limiterError) throw limiterError;

    const userId = req.user.id;
    const payload = req.body;
    const isTest = !!(payload && payload.flow_api_test);

    // 2. Look up user's active destinations
    const destinationsResult = await query(
      `SELECT id, target_url, daily_cap, is_active 
       FROM destinations 
       WHERE user_id = $1 AND is_active = TRUE`,
      [userId]
    );

    const activeDestinations = destinationsResult.rows;

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
    const primaryDestinationId = activeDestinations.length > 0 ? activeDestinations[0].id : null;
    await query(
      `INSERT INTO ghl_leads (contact_id, raw_payload, status, webhook_key_id, destination_id, lead_score, first_name, last_name, email, phone, delivery_status, retry_count, user_id, is_test)
       VALUES ($1, $2::jsonb, $3, NULL, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
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
         destination_id = EXCLUDED.destination_id,
         is_test = EXCLUDED.is_test`,
      [contactId, JSON.stringify(payload), 'PENDING', primaryDestinationId, leadScore, firstName, lastName, email, phone, 'PENDING', 0, userId, isTest]
    );

    // 5. Trigger Multi-Mode Smart Dispatcher
    const dispatchResult = await dispatchLead(userId, payload, contactId, isTest);

    if (!dispatchResult.success) {
      return res.status(422).json({
        ...dispatchResult,
        error_code: dispatchResult.error_code || "DISPATCH_FAILED",
      });
    }

    const responseBody = {
      ...dispatchResult,
      contact_id: contactId,
    };

    if (idempotencyKey) {
      const cacheKey = `idempotency:inbound:${req.user.id}:${idempotencyKey}`;
      await redisClient.setEx(cacheKey, 86400, JSON.stringify(responseBody)).catch(() => {});
    }

    return res.status(200).json(responseBody);
  } catch (error) {
    console.error("[inbound] Error processing lead:", error);
    if (error.status === 429) {
      return res.status(429).json({
        success: false,
        error_code: error.code || "RATE_LIMITED",
        message: error.message,
      });
    }
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

  const urlValidation = webhookDestinationSchema.safeParse(destinationUrl);
  if (!urlValidation.success) {
    return res.status(400).json({ success: false, message: "Invalid destination URL" });
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

/**
 * GET /api/leads/:id/status
 *
 * Agent-facing status poll — returns real delivery state for a vaulted lead.
 * Accepts JWT cookie or x-api-key header.
 */
router.get("/:id/status", apiKeyAuth, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id, contact_id, lead_score, delivery_status, retry_count,
              last_delivery_error, is_test, created_at, bullmq_job_id
       FROM ghl_leads
       WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error_code: "LEAD_NOT_FOUND",
        message: "Lead not found or does not belong to your account",
      });
    }

    const lead = result.rows[0];
    return res.status(200).json({
      success: true,
      lead_id: lead.id,
      contact_id: lead.contact_id,
      score: lead.lead_score,
      delivery_status: lead.delivery_status,
      retry_count: lead.retry_count,
      last_delivery_error: lead.last_delivery_error || null,
      is_test: lead.is_test,
      created_at: lead.created_at,
      job_id: lead.bullmq_job_id || null,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
