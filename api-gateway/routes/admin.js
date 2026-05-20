import { Router } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { query } from "../db/connection.js";
import authenticate from "../middleware/auth.js";
import { generateApiKey } from "../utils/apiKeyGenerator.js";

const router = Router();

/* ═══════════════════════════════════════════════════════════════════════════
   Standard GoHighLevel JSON reference payload for downstream field mapping.
   ═══════════════════════════════════════════════════════════════════════════ */
const GHL_DUMMY_PAYLOAD = {
  contact_id: "abc123-ghl-contact-id",
  first_name: "Sarah",
  last_name: "Tech",
  email: "sarah.tech@example.com",
  phone: "+1-555-0100",
  tags: ["new_lead", "website"],
  source: "GoHighLevel",
  date_added: new Date().toISOString(),
  custom_fields: {
    company: "Acme Corp",
    deal_value: "5000",
    lead_status: "new",
  },
  location_id: "loc_abc123",
  assigned_to: "user_xyz789",
};

/**
 * GET /api/admin/dashboard
 *
 * Returns aggregated gateway metrics for the control-panel dashboard:
 *   • totalRequests  — count of all logged requests
 *   • blockedAttacks — count of 401, 403, and 429 responses
 *   • activeTokens   — placeholder (not tracked in DB)
 *   • recentTraffic  — 10 most recent request log entries
 *
 * Protected by the `authenticate` middleware (applied in server.js).
 */
router.get("/dashboard", authenticate, async (_req, res, next) => {
  try {
    // Run all three queries concurrently for speed
    const [totalResult, blockedResult, trafficResult] = await Promise.all([
      query("SELECT COUNT(*)::int AS count FROM request_logs"),
      query(
        `SELECT COUNT(*)::int AS count
           FROM request_logs
          WHERE status_code IN (401, 403, 429)`,
      ),
      query(
        `SELECT ip_address  AS ip,
                method || ' ' || path AS endpoint,
                status_code AS status,
                created_at  AS timestamp
           FROM request_logs
          ORDER BY created_at DESC
          LIMIT 10`,
      ),
    ]);

    res.json({
      totalRequests: totalResult.rows[0].count,
      blockedAttacks: blockedResult.rows[0].count,
      activeTokens: 0,               // extend when token tracking is added
      recentTraffic: trafficResult.rows,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/generate-webhook
 *
 * Generates a new 32-character hex API key, persists it to the
 * `webhook_keys` table, and returns the full webhook URL.
 *
 * Protected by JWT.
 */
router.post("/generate-webhook", authenticate, async (_req, res, next) => {
  try {
    // Generate raw API key
    const rawKey = "flow_api_live_" + crypto.randomBytes(16).toString("hex");
    
    // Mask key for display
    const maskedKey = "flow_api_..." + rawKey.slice(-4);
    
    // Hash key for DB
    const hashedKey = await bcrypt.hash(rawKey, 10);

    // Build the webhook URL
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    const host = process.env.PUBLIC_HOST || `localhost:${process.env.PORT || 3000}`;
    const webhookUrl = `${protocol}://${host}/api/webhooks/ghl?x-api-key=${rawKey}`;

    const insertResult = await query(
      `INSERT INTO webhook_keys (api_key, masked_key, webhook_url) VALUES ($1, $2, $3) RETURNING id`,
      [hashedKey, maskedKey, webhookUrl],
    );

    console.log("\n" + "═".repeat(60));
    console.log(`🔑 NEW WEBHOOK KEY GENERATED: ${maskedKey}`);
    console.log("═".repeat(60) + "\n");

    return res.json({
      success: true,
      apiKey: rawKey,
      webhookUrl,
      id: insertResult.rows[0].id
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/stats
 *
 * Returns the total number of leads stored in `ghl_leads` and the
 * number of generated webhook keys. Used by the frontend to render
 * the "Zapier Tax Avoided" counter ($0.05 × total leads).
 *
 * Protected by JWT.
 */
router.get("/stats", authenticate, async (req, res, next) => {
  try {
    const [leadsResult, keysResult, botsResult, userResult] = await Promise.all([
      query("SELECT COUNT(*)::int AS count FROM ghl_leads"),
      query("SELECT COUNT(*)::int AS count FROM webhook_keys"),
      query("SELECT value::int AS count FROM gateway_counters WHERE key = 'bots_blocked'"),
      query("SELECT two_factor_enabled, has_completed_onboarding FROM users WHERE id = $1", [req.user.id]),
    ]);

    const totalLeads = leadsResult.rows[0].count;
    const totalWebhooks = keysResult.rows[0].count;
    const botsBlocked = botsResult.rows[0]?.count ?? 0;
    const zapierTaxAvoided = (totalLeads * 0.05).toFixed(2);
    const twoFactorEnabled = userResult.rows[0]?.two_factor_enabled ?? false;
    const hasCompletedOnboarding = userResult.rows[0]?.has_completed_onboarding ?? false;

    return res.json({
      totalLeads,
      totalWebhooks,
      botsBlocked,
      zapierTaxAvoided,
      twoFactorEnabled,
      hasCompletedOnboarding,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/onboarding/complete
 *
 * Marks onboarding as completed for the authenticated user.
 * Protected by JWT.
 */
router.post("/onboarding/complete", authenticate, async (req, res, next) => {
  try {
    await query("UPDATE users SET has_completed_onboarding = true WHERE id = $1", [req.user.id]);
    return res.json({
      success: true,
      message: "Onboarding completed successfully"
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/standard-schema
 *
 * Returns the standard GoHighLevel JSON reference payload that users
 * can copy-paste into their destination webhook for field mapping.
 */
router.get("/standard-schema", authenticate, (_req, res) => {
  return res.json({
    success: true,
    schema: GHL_DUMMY_PAYLOAD,
  });
});

/**
 * PUT /api/admin/destination
 *
 * Saves a destination webhook URL for a given API key.
 *
 * Body: { id: number, destinationUrl: string }
 * Protected by JWT.
 */
router.put("/destination", authenticate, async (req, res, next) => {
  try {
    const { id, destinationUrl } = req.body;

    if (!id || !destinationUrl) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: id, destinationUrl",
      });
    }

    // Validate URL format
    try {
      new URL(destinationUrl);
    } catch {
      return res.status(400).json({
        success: false,
        message: "Invalid URL format for destinationUrl",
      });
    }

    const result = await query(
      `UPDATE webhook_keys SET destination_url = $1 WHERE id = $2 RETURNING id, masked_key`,
      [destinationUrl, id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "API key not found",
      });
    }

    console.log("\n" + "═".repeat(60));
    console.log(`📡 DESTINATION SET for key ${result.rows[0].masked_key} → ${destinationUrl}`);
    console.log("═".repeat(60) + "\n");

    return res.json({
      success: true,
      message: "Destination URL saved",
      destinationUrl,
    });
  } catch (err) {
    next(err);
  }
});



/**
 * GET /api/admin/webhooks
 *
 * Returns active webhooks and analytics.
 */
router.get("/webhooks", authenticate, async (_req, res, next) => {
  try {
    const result = await query(`
      SELECT 
        wk.id,
        wk.masked_key,
        wk.destination_url,
        wk.created_at,
        COUNT(gl.id) FILTER (WHERE gl.status = '200' OR gl.status = 'forwarded') AS total_success,
        COUNT(gl.id) FILTER (WHERE gl.status = '429' OR gl.status = 'failed') AS total_blocked
      FROM webhook_keys wk
      LEFT JOIN ghl_leads gl ON wk.id = gl.webhook_key_id
      GROUP BY wk.id
      ORDER BY wk.created_at DESC
    `);
    
    return res.json({
      success: true,
      webhooks: result.rows
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/leads
 *
 * Returns vaulted leads joined with webhook_keys for masked key tracking.
 */
router.get("/leads", authenticate, async (_req, res, next) => {
  try {
    const result = await query(`
      SELECT 
        gl.id,
        gl.contact_id,
        gl.first_name,
        gl.last_name,
        gl.email,
        gl.phone,
        gl.status,
        gl.lead_score,
        gl.created_at,
        gl.delivery_status AS "deliveryStatus",
        gl.retry_count AS "retryCount",
        gl.last_delivery_error AS "lastDeliveryError",
        wk.masked_key AS source_webhook
      FROM ghl_leads gl
      LEFT JOIN webhook_keys wk ON gl.webhook_key_id = wk.id
      ORDER BY gl.created_at DESC
      LIMIT 100
    `);
    
    return res.json({
      success: true,
      leads: result.rows
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/admin/leads
 *
 * Wipes all lead records in the Lead Ledger database.
 * Protected by JWT.
 */
router.delete("/leads", authenticate, async (_req, res, next) => {
  try {
    await query("DELETE FROM ghl_leads");
    return res.json({ success: true, message: "All lead records have been wiped." });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/admin/webhooks
 *
 * Wipes all active webhooks.
 * Protected by JWT.
 */
router.delete("/webhooks", authenticate, async (_req, res, next) => {
  try {
    await query("DELETE FROM webhook_keys");
    return res.json({ success: true, message: "All active webhooks have been wiped." });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/admin/webhooks/:id
 *
 * Revokes a single webhook key.
 */
router.delete("/webhooks/:id", authenticate, async (req, res, next) => {
  try {
    await query(`DELETE FROM webhook_keys WHERE id = $1`, [req.params.id]);
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/admin/logs
 *
 * Deletes all routing metadata/history for the user (leads, request logs, and spam counters).
 * Protected by JWT.
 */
router.delete("/logs", authenticate, async (_req, res, next) => {
  try {
    await Promise.all([
      query("DELETE FROM ghl_leads"),
      query("DELETE FROM request_logs"),
      query("UPDATE gateway_counters SET value = 0 WHERE key = 'bots_blocked'"),
    ]);

    return res.json({
      success: true,
      message: "All analytics logs and routing metadata have been reset",
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/egress-test
 *
 * Executes a real outbound POST request to a destination URL with formatted lead data.
 */
router.post("/egress-test", authenticate, async (req, res, next) => {
  try {
    const { destinationUrl, payload } = req.body;

    if (!destinationUrl) {
      return res.status(400).json({
        success: false,
        message: "Missing destinationUrl",
      });
    }

    try {
      new URL(destinationUrl);
    } catch {
      return res.status(400).json({
        success: false,
        message: "Invalid destinationUrl format",
      });
    }

    const startTime = Date.now();
    let outboundResponse;
    let responseText = "";
    let statusCode = 500;

    try {
      outboundResponse = await fetch(destinationUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      statusCode = outboundResponse.status;
      responseText = await outboundResponse.text();
    } catch (err) {
      return res.json({
        success: false,
        error: `Outbound connection failed: ${err.message}`,
        durationMs: Date.now() - startTime,
      });
    }

    const durationMs = Date.now() - startTime;
    return res.json({
      success: statusCode >= 200 && statusCode < 300,
      statusCode,
      responseText,
      durationMs,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/leads/:id/refire
 *
 * Manual re-fire triggers a reset of status and retry_count to queue it for immediate delivery.
 */
router.post("/leads/:id/refire", authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if the lead exists
    const leadResult = await query("SELECT * FROM ghl_leads WHERE id = $1", [id]);
    if (leadResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Lead not found"
      });
    }

    // Reset status to PENDING and retry count to 0
    await query(`
      UPDATE ghl_leads
      SET delivery_status = 'PENDING',
          retry_count = 0,
          last_delivery_error = NULL
      WHERE id = $1
    `, [id]);

    // Import and trigger queue worker instantly in background
    const { processQueue } = await import("../utils/queueWorker.js");
    processQueue();

    return res.json({
      success: true,
      message: "Lead manually re-queued for delivery"
    });
  } catch (err) {
    next(err);
  }
});

export default router;

