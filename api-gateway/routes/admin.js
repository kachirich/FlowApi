import { Router } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import speakeasy from "speakeasy";
import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { query } from "../db/connection.js";
import authenticate from "../middleware/auth.js";
import webhookCreationLimiter from "../middleware/webhookCreationLimiter.js";
import { generateApiKey } from "../utils/apiKeyGenerator.js";
import { validateWebhookUrl } from "../utils/security.js";
import { sendTierUpgradeEmail } from "../services/email.service.js";
import { redisClient, sandboxEgressLimiter } from "../middleware/rateLimiter.js";
import { planCacheKey } from "../middleware/requirePlan.js";
import { planFor } from "../config/plans.js";
import { validateRequest, egressTestBodySchema } from "../middleware/validateRequest.js";
import { webhookQueue } from "../services/queue.js";
import { decrypt } from "../utils/encryption.js";
import { tierFromPlan } from "../utils/tierFromPlan.js";

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  store: new RedisStore({ sendCommand: (...args) => redisClient.call(...args) }),
});

// Gate routes that must only be reachable by platform admins.
function requireAdmin(req, res, next) {
  if (!req.user?.is_admin) {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }
  next();
}

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
    deal_value: 5000,
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
router.get("/dashboard", authenticate, async (req, res, next) => {
  try {
    // All metrics are strictly scoped to the authenticated user's data.
    // request_logs has no user_id column — we use webhook_logs and ghl_leads
    // which are fully partitioned by user_id, preventing cross-tenant leakage.
    const [totalResult, blockedResult, trafficResult] = await Promise.all([
      // Total webhook events processed for this user
      query(
        "SELECT COUNT(*)::int AS count FROM webhook_logs WHERE user_id = $1",
        [req.user.id]
      ),
      // Blocked/failed events for this user (4xx and 5xx webhook responses)
      query(
        `SELECT COUNT(*)::int AS count
           FROM webhook_logs
          WHERE user_id = $1
            AND status_code IN (401, 403, 429, 499, 500)`,
        [req.user.id]
      ),
      // 10 most recent webhook events for this user
      query(
        `SELECT wl.method    AS method,
                wl.status_code AS status,
                wl.created_at  AS timestamp,
                COALESCE(wk.webhook_url, d.target_url) AS endpoint
           FROM webhook_logs wl
           LEFT JOIN webhook_keys wk ON wl.webhook_id = wk.id
           LEFT JOIN destinations d ON wl.destination_id = d.id
          WHERE wl.user_id = $1
          ORDER BY wl.created_at DESC
          LIMIT 10`,
        [req.user.id]
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
router.post("/generate-webhook", authenticate, adminLimiter, webhookCreationLimiter, async (req, res, next) => {
  try {
    const { totpToken } = req.body;

    // Enforce 2FA verification + billing tier check in a single query
    const userResult = await query(
      `SELECT ua.two_factor_secret, ua.two_factor_enabled,
              ub.plan_type, ub.lifetime_webhooks_created
       FROM user_auth ua
       JOIN user_billing ub ON ub.user_id = ua.user_id
       WHERE ua.user_id = $1`,
      [req.user.id]
    );

    const user = userResult.rows[0];
    if (!user || !user.two_factor_secret) {
      return res.status(403).json({ error: "2FA must be configured before generating webhooks" });
    }

    if (!totpToken) {
      return res.status(401).json({ error: "Unauthorized: 2FA Token Required" });
    }

    const verified = speakeasy.totp.verify({
      secret: user.two_factor_secret,
      encoding: "base32",
      token: totpToken,
    });

    if (!verified) {
      return res.status(401).json({ error: "Invalid Code" });
    }

    // ── Enforce Billing Tiers (Lifetime Counter) ───────────────────────────
    const planType = user.plan_type || 'free';
    const lifetimeWebhooks = user.lifetime_webhooks_created || 0;

    const limit = planFor(planType).maxApiKeys;

    if (lifetimeWebhooks >= limit) {
      return res.status(403).json({
        status: 403,
        error: "Plan limit reached. Please upgrade to create more webhooks."
      });
    }

    // Generate raw API key
    const rawKey = "flow_api_live_" + crypto.randomBytes(16).toString("hex");

    // Mask key for display
    const maskedKey = "flow_api_..." + rawKey.slice(-4);

    // bcrypt hash stored in api_key (legacy); SHA-256 hash stored in api_key_hash for O(1) lookup
    const hashedKey = await bcrypt.hash(rawKey, 10);
    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

    // Build the webhook URL using the new dynamic dispatcher format
    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

    const insertResult = await query(
      `INSERT INTO webhook_keys (api_key, api_key_hash, masked_key, webhook_url, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [hashedKey, keyHash, maskedKey, 'pending', req.user.id],
    );

    const webhookId = insertResult.rows[0].id;
    const webhookUrl = `${baseUrl}/api/catch/${webhookId}`;

    // Update the URL now that we have the UUID
    await query(`UPDATE webhook_keys SET webhook_url = $1 WHERE id = $2`, [webhookUrl, webhookId]);

    // ── Update Lifetime Ledger ─────────────────────────────────────────────
    await query(
      "UPDATE user_billing SET lifetime_webhooks_created = lifetime_webhooks_created + 1 WHERE user_id = $1",
      [req.user.id]
    );

    console.log("\n" + "═".repeat(60));
    console.log(`🔑 NEW WEBHOOK KEY GENERATED: ${maskedKey}`);
    console.log("═".repeat(60) + "\n");

    const trustedDeviceToken = jwt.sign(
      { userId: req.user.id },
      process.env.JWT_SECRET,
      { expiresIn: "72h" }
    );

    return res.json({
      success: true,
      apiKey: rawKey,
      webhookUrl,
      id: webhookId,
      trustedDeviceToken
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
    const [leadsResult, keysResult, botsResult, userResult, counterResult, usageResult] = await Promise.all([
      query("SELECT COUNT(*)::int AS count FROM ghl_leads WHERE user_id = $1 AND is_test = false", [req.user.id]),
      query("SELECT COUNT(*)::int AS count FROM webhook_keys WHERE user_id = $1", [req.user.id]),
      query("SELECT value::int AS count FROM gateway_counters WHERE key = 'bots_blocked'"),
      query(
        `SELECT ua.two_factor_enabled, us.has_completed_onboarding, ub.plan_type
         FROM user_auth ua
         JOIN user_billing  ub ON ub.user_id = ua.user_id
         JOIN user_settings us ON us.user_id = ua.user_id
         WHERE ua.user_id = $1`,
        [req.user.id]
      ),
      query("SELECT daily_lead_cap, daily_leads_received, last_reset_date FROM lead_counters WHERE user_id = $1", [req.user.id]),
      query("SELECT monthly_request_count, billing_cycle_reset FROM user_billing WHERE user_id = $1", [req.user.id]),
    ]);

    const totalLeads = leadsResult.rows[0].count;
    const totalWebhooks = keysResult.rows[0].count;
    const botsBlocked = botsResult.rows[0]?.count ?? 0;
    const zapierTaxAvoided = (totalLeads * 0.05).toFixed(2);
    const twoFactorEnabled = userResult.rows[0]?.two_factor_enabled ?? false;
    const hasCompletedOnboarding = userResult.rows[0]?.has_completed_onboarding ?? false;
    const planType = userResult.rows[0]?.plan_type || 'free';

    // ── Daily lead cap usage (read-only mirror of services/leadIngest.js) ──
    // Counter row may not exist until the first lead; default to the 100/day seed.
    const counter = counterResult.rows[0];
    const dailyLeadCap = counter?.daily_lead_cap ?? 100;
    let dailyLeadsReceived = counter?.daily_leads_received ?? 0;
    if (counter?.last_reset_date) {
      const today = new Date().toISOString().split("T")[0];
      const lastReset = new Date(counter.last_reset_date).toISOString().split("T")[0];
      if (today !== lastReset) dailyLeadsReceived = 0; // odometer resets at midnight
    }

    // ── Monthly request quota usage (read-only mirror of meteredLimiter) ──
    const usage = usageResult.rows[0];
    let monthlyRequestCount = usage?.monthly_request_count ?? 0;
    if (usage?.billing_cycle_reset) {
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      if (Date.now() - new Date(usage.billing_cycle_reset).getTime() >= thirtyDaysMs) {
        monthlyRequestCount = 0; // cycle rolled over
      }
    }
    // null = unlimited (enterprise). JSON can't carry Infinity.
    const planMonthly = planFor(planType).monthlyRequests;
    const monthlyRequestLimit = planMonthly === Infinity ? null : planMonthly;

    return res.json({
      totalLeads,
      totalWebhooks,
      botsBlocked,
      zapierTaxAvoided,
      twoFactorEnabled,
      hasCompletedOnboarding,
      planType,
      dailyLeadCap,
      dailyLeadsReceived,
      monthlyRequestCount,
      monthlyRequestLimit,
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
    await query("UPDATE user_settings SET has_completed_onboarding = TRUE WHERE user_id = $1", [req.user.id]);
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

    // Validate URL format and SSRF protection
    const { isValid, error } = validateWebhookUrl(destinationUrl);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: error === "Invalid or prohibited target URL" ? "Invalid or prohibited target URL" : "Invalid URL format for destinationUrl",
      });
    }

    const result = await query(
      `UPDATE webhook_keys SET target_url = $1 WHERE id = $2 AND user_id = $3 RETURNING id, masked_key`,
      [destinationUrl, id, req.user.id],
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
router.get("/webhooks", authenticate, async (req, res, next) => {
  try {
    const result = await query(`
      SELECT 
        wk.id,
        wk.masked_key,
        wk.target_url,
        wk.http_method,
        wk.webhook_url,
        wk.created_at,
        wk.custom_headers,
        COUNT(wl.id) FILTER (WHERE wl.status_code >= 200 AND wl.status_code < 300 AND wl.is_test = false) AS clean_leads,
        COUNT(wl.id) FILTER (WHERE wl.status_code >= 400 AND wl.is_test = false) AS blocked_leads
      FROM webhook_keys wk
      LEFT JOIN webhook_logs wl ON wk.id = wl.webhook_id
      WHERE wk.user_id = $1
      GROUP BY wk.id
      ORDER BY wk.created_at DESC
    `, [req.user.id]);
    
    return res.json({
      success: true,
      webhooks: result.rows
    });
  } catch (err) {
    next(err);
  }
});

/**
 *
 * Returns vaulted leads joined with webhook_keys for masked key tracking.
 */
router.get("/leads", authenticate, async (req, res, next) => {
  try {
    const result = await query(`
      SELECT 
        gl.id,
        gl.contact_id,
        gl.first_name,
        gl.last_name,
        gl.email,
        gl.phone,
        gl.lead_score,
        gl.created_at,
        gl.delivery_status AS "deliveryStatus",
        gl.retry_count AS "retryCount",
        gl.last_delivery_error AS "lastDeliveryError",
        gl.is_test AS "is_test",
        COALESCE(wk.masked_key, d.name) AS source_webhook
      FROM ghl_leads gl
      LEFT JOIN webhook_keys wk ON gl.webhook_key_id = wk.id
      LEFT JOIN destinations d ON gl.destination_id = d.id
      WHERE gl.user_id = $1
      ORDER BY gl.created_at DESC
      LIMIT 100
    `, [req.user.id]);
    
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
router.delete("/leads", authenticate, async (req, res, next) => {
  try {
    await query("DELETE FROM ghl_leads WHERE user_id = $1", [req.user.id]);
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
router.delete("/webhooks", authenticate, async (req, res, next) => {
  try {
    await query("DELETE FROM webhook_keys WHERE user_id = $1", [req.user.id]);
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
    const totpToken = req.body.totpToken || req.headers.totptoken;
    const email = req.user.email;

    const trustedToken = req.headers['x-trusted-device-token'];
    let deviceTrusted = false;
    if (trustedToken) {
      try {
        const decoded = jwt.verify(trustedToken, process.env.JWT_SECRET);
        if (decoded && decoded.userId === req.user.id) {
          deviceTrusted = true;
        }
      } catch (err) {
        // ignore
      }
    }

    if (!deviceTrusted) {
      if (!totpToken) {
        return res.status(401).json({ error: "Unauthorized: Missing 2FA code" });
      }

      // Enforce 2FA verification
      const userResult = await query(
        "SELECT two_factor_secret, two_factor_enabled FROM user_auth WHERE user_id = $1",
        [req.user.id]
      );

      const user = userResult.rows[0];
      if (!user || !user.two_factor_enabled) {
        return res.status(403).json({ error: "Two-factor authentication must be enabled to revoke webhooks" });
      }

      const verified = speakeasy.totp.verify({
        secret: user.two_factor_secret,
        encoding: "base32",
        token: totpToken,
      });

      if (!verified) {
        return res.status(401).json({ error: "Invalid authenticator code" });
      }
    }

    await query(`DELETE FROM webhook_keys WHERE id = $1 AND user_id = $2`, [req.params.id, req.user.id]);

    const trustedDeviceToken = jwt.sign(
      { userId: req.user.id },
      process.env.JWT_SECRET,
      { expiresIn: "72h" }
    );

    return res.json({ success: true, trustedDeviceToken });
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
router.delete("/logs", authenticate, requireAdmin, async (req, res, next) => {
  try {
    await Promise.all([
      query("DELETE FROM ghl_leads WHERE user_id = $1", [req.user.id]),
      query("DELETE FROM webhook_logs WHERE user_id = $1", [req.user.id]),
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
 * 
 * Security Guards:
 * 1. SSRF Blacklist Protection — Validates destinationUrl against internal/private IP ranges
 * 2. Strict Request Timeout — 3000ms hard timeout on outbound requests
 * 3. Aggressive Rate Limiting — 10 requests per minute per user/IP (Redis-backed)
 */
router.post("/egress-test", authenticate, sandboxEgressLimiter, validateRequest(egressTestBodySchema), async (req, res, next) => {
  try {
    const { destinationUrl, destinationId, payload } = req.body;

    // ════════════════════════════════════════════════════════════════════════
    // Resolve the target URL + optional auth header.
    //   - destinationId → look up an owned destination, decrypt its stored
    //     token (token-based types only) into an Authorization: Bearer header.
    //   - destinationUrl → manual entry, no stored credential.
    // ════════════════════════════════════════════════════════════════════════
    let targetUrl = destinationUrl;
    const outboundHeaders = { "Content-Type": "application/json" };

    if (destinationId) {
      const destResult = await query(
        `SELECT target_url, destination_type, api_token_encrypted
         FROM destinations
         WHERE id = $1 AND user_id = $2`,
        [destinationId, req.user.id]
      );
      if (destResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: "Destination not found" });
      }
      const dest = destResult.rows[0];
      targetUrl = dest.target_url;

      if (dest.destination_type !== "webhook" && dest.api_token_encrypted) {
        try {
          outboundHeaders["Authorization"] = `Bearer ${decrypt(dest.api_token_encrypted)}`;
        } catch (decryptErr) {
          return res.status(500).json({
            success: false,
            error: "Failed to decrypt the stored token for this destination.",
          });
        }
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // GUARD 1: SSRF Blacklist Protection
    // ════════════════════════════════════════════════════════════════════════
    const { isValid, error } = validateWebhookUrl(targetUrl);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: "Destination URL points to internal or restricted resource. " + (error || ""),
      });
    }

    const startTime = Date.now();
    let outboundResponse;
    let responseText = "";
    let statusCode = 500;

    // ════════════════════════════════════════════════════════════════════════
    // GUARD 2 & 3: Request Timeout (3000ms) + Error Handling
    // ════════════════════════════════════════════════════════════════════════
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      try {
        outboundResponse = await fetch(targetUrl, {
          method: "POST",
          headers: outboundHeaders,
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        statusCode = outboundResponse.status;
        responseText = await outboundResponse.text();
      } catch (timeoutErr) {
        clearTimeout(timeoutId);
        if (timeoutErr.name === "AbortError") {
          return res.status(504).json({
            success: false,
            error: "Request timeout: destination took longer than 3 seconds to respond",
            durationMs: Date.now() - startTime,
          });
        }
        throw timeoutErr;
      }
    } catch (err) {
      const durationMs = Date.now() - startTime;
      
      // Distinguish between timeout and other network errors
      if (err.name === "AbortError") {
        return res.status(504).json({
          success: false,
          error: "Request timeout: destination took longer than 3 seconds to respond",
          durationMs,
        });
      }

      return res.status(502).json({
        success: false,
        error: `Outbound connection failed: ${err.message}`,
        durationMs,
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

    const leadResult = await query(
      `SELECT gl.*, ub.plan_type, ub.tier
       FROM ghl_leads gl
       JOIN user_billing ub ON ub.user_id = gl.user_id
       WHERE gl.id = $1 AND gl.user_id = $2`,
      [id, req.user.id]
    );
    if (leadResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Lead not found" });
    }

    const lead = leadResult.rows[0];

    await query(
      `UPDATE ghl_leads
       SET delivery_status = 'PENDING', retry_count = 0, last_delivery_error = NULL
       WHERE id = $1 AND user_id = $2`,
      [id, req.user.id]
    );

    // Re-enqueue through the BullMQ dispatcher so delivery is logged
    // with request_payload in webhook_logs (the legacy processQueue path did not).
    await webhookQueue.add(
      "dispatch",
      {
        userId: lead.user_id,
        payload: lead.raw_payload ?? {},
        contactId: lead.contact_id,
        leadId: lead.id,
        isTest: lead.is_test ?? false,
        source: "refire",
        flow_id: lead.flow_id ?? null,
        plan_type: lead.plan_type ?? "free",
      },
      { attempts: 1, removeOnComplete: true, removeOnFail: false }
    );

    return res.json({ success: true, message: "Lead re-queued for delivery" });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/upgrade-user
 *
 * Admin / testing route to manually upgrade a user's plan and fire the
 * tier-specific welcome email.  Accepts { email, newPlan } in the body.
 *
 * - Validates newPlan against the allowed tier list.
 * - Updates the user's plan_type in Postgres.
 * - Fires sendTierUpgradeEmail() with the resolved user name.
 *
 * Protected by JWT and admin check.
 */
router.post("/upgrade-user", authenticate, requireAdmin, adminLimiter, async (req, res, next) => {
  try {
    const { email, newPlan } = req.body;

    if (!email || !newPlan) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: email, newPlan",
      });
    }

    const allowedPlans = ['free', 'basic', 'pro', 'plus'];
    if (!allowedPlans.includes(newPlan)) {
      return res.status(400).json({
        success: false,
        message: `Invalid plan. Must be one of: ${allowedPlans.join(', ')}`,
      });
    }

    // Update the user's plan in the database.
    // plan_type lives in user_billing (split out of users in migration 002),
    // so we update there — that's the column requirePlan and /me actually read.
    const result = await query(
      `UPDATE user_billing ub
       SET plan_type = $1, tier = $2
       FROM users u
       WHERE ub.user_id = u.id AND u.email = $3
       RETURNING u.id, u.email, u.first_name, u.last_name, ub.plan_type`,
      [newPlan, tierFromPlan(newPlan), email.trim().toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No user found with that email address",
      });
    }

    const user = result.rows[0];
    const userName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email.split('@')[0];

    // ── Invalidate Redis plan cache immediately ─────────────────────────
    redisClient.del(planCacheKey(user.id)).catch((err) =>
      console.error('[admin] Failed to invalidate plan cache:', err.message)
    );

    // Fire the tier-specific welcome email (non-blocking — don't let a
    // Resend failure roll back the plan upgrade)
    sendTierUpgradeEmail(user.email, userName, newPlan).catch((err) =>
      console.error('[admin] Failed to send upgrade email:', err)
    );

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`⬆️  PLAN UPGRADED: ${user.email} → ${newPlan}`);
    console.log(`${'═'.repeat(60)}\n`);

    return res.json({
      success: true,
      message: `User upgraded to ${newPlan}`,
      user: {
        id: user.id,
        email: user.email,
        plan_type: user.plan_type,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/upgrade-users-batch
 *
 * Batch upgrade multiple users to a plan. Accepts { newPlan, emails: [email1, email2, ...] }
 *
 * Protected by JWT and admin check.
 */
router.post("/upgrade-users-batch", authenticate, requireAdmin, adminLimiter, async (req, res, next) => {
  try {
    const { newPlan, emails } = req.body;

    if (!newPlan || !emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: newPlan (string), emails (non-empty array)",
      });
    }

    const allowedPlans = ['free', 'basic', 'pro', 'plus'];
    if (!allowedPlans.includes(newPlan)) {
      return res.status(400).json({
        success: false,
        message: `Invalid plan. Must be one of: ${allowedPlans.join(', ')}`,
      });
    }

    const normalizedEmails = emails.map((e) => e.trim().toLowerCase());

    // plan_type is authoritative in user_billing (users.plan_type is a legacy
    // dead column re-added by connection.js but never read by application code).
    const result = await query(
      `UPDATE user_billing ub
       SET plan_type = $1, tier = $2
       FROM users u
       WHERE ub.user_id = u.id AND u.email = ANY($3::text[])
       RETURNING u.id, u.email, u.first_name, u.last_name, ub.plan_type`,
      [newPlan, tierFromPlan(newPlan), normalizedEmails]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No users found with the provided email addresses",
      });
    }

    // Invalidate Redis plan cache for all updated users
    await Promise.all(
      result.rows.map((user) =>
        redisClient.del(planCacheKey(user.id)).catch((err) =>
          console.error('[admin] Failed to invalidate plan cache for', user.id, ':', err.message)
        )
      )
    );

    // Send upgrade emails (non-blocking)
    result.rows.forEach((user) => {
      const userName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email.split('@')[0];
      sendTierUpgradeEmail(user.email, userName, newPlan).catch((err) =>
        console.error('[admin] Failed to send upgrade email to', user.email, ':', err)
      );
    });

    const notFound = normalizedEmails.filter(
      (email) => !result.rows.some((r) => r.email === email)
    );

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`⬆️  BATCH UPGRADE: ${result.rows.length} user(s) → ${newPlan}`);
    result.rows.forEach((user) => {
      console.log(`   • ${user.email}`);
    });
    if (notFound.length > 0) {
      console.log(`⚠️  Not found: ${notFound.join(', ')}`);
    }
    console.log(`${'═'.repeat(60)}\n`);

    return res.json({
      success: true,
      message: `Upgraded ${result.rows.length} user(s) to ${newPlan}`,
      upgraded: result.rows.map((u) => ({ id: u.id, email: u.email, plan_type: u.plan_type })),
      notFound,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/invalidate-plan-cache
 *
 * Force-expires the Redis plan cache for a user so requirePlan picks up a
 * manual DB upgrade immediately instead of waiting up to 15 minutes.
 *
 * Body: { email } or { user_id }
 * Protected by JWT and admin check.
 */
router.post("/invalidate-plan-cache", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { email, user_id } = req.body;

    if (!email && !user_id) {
      return res.status(400).json({ success: false, message: "Provide email or user_id" });
    }

    let userId = user_id;
    if (!userId) {
      const result = await query("SELECT id FROM users WHERE email = $1", [email.trim().toLowerCase()]);
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: "No user found with that email" });
      }
      userId = result.rows[0].id;
    }

    await redisClient.del(planCacheKey(userId));

    return res.json({ success: true, message: `Plan cache cleared for user ${userId}` });
  } catch (err) {
    next(err);
  }
});

export default router;
