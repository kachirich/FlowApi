import { Router } from "express";
import meteredLimiter from "../middleware/meteredLimiter.js";
import { webhookIngressLimiter, perKeyBurstLimiter } from "../middleware/rateLimiter.js";
import { query } from "../db/connection.js";
import { ingestLead } from "../services/leadIngest.js";

const router = Router();

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
router.post("/:webhook_id", perKeyBurstLimiter, webhookIngressLimiter, async (req, res) => {
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

    // ── Step 4: Shared ingest pipeline ──────────────────────────────────
    // Field extraction, lead scoring, daily-cap enforcement, vaulting and the
    // BullMQ enqueue all live in services/leadIngest.js now. Passing `webhook`
    // keeps the catch path's direct-to-target_url dispatch behaviour intact.
    console.log("\n" + "═".repeat(60));
    console.log(`🚀 DYNAMIC DISPATCHER — Webhook ${webhook.masked_key}`);
    console.log(`📡 Forwarding → ${webhook.target_url} [${(webhook.http_method || 'POST').toUpperCase()}]`);
    console.log("═".repeat(60) + "\n");

    try {
      await ingestLead({
        userId,
        payload,
        source: "catch",
        tier: req.webhookKey.tier || "sandbox",
        webhook,
        headers: req.headers,
        method: webhook.http_method || "POST",
      });
    } catch (ingestErr) {
      if (ingestErr.status === 429) {
        return res.status(429).json({
          success: false,
          message: ingestErr.message,
        });
      }
      throw ingestErr; // Forward to outer catch block for 500 handling
    }

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
