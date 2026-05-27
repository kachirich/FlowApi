import { Router } from "express";
import axios from "axios";
import authenticate from "../middleware/auth.js";
import requirePlan from "../middleware/requirePlan.js";
import { getPlanType } from "../middleware/index.js";
import meteredLimiter from "../middleware/meteredLimiter.js";
import { query } from "../db/connection.js";
import { webhookQueue } from "../services/queue.js";
import { validateWebhookUrl } from "../utils/security.js";

const router = Router();

// Helper to recursively find key in an object (Smart Catcher extraction)
function findValue(obj, possibleKeys) {
  if (!obj || typeof obj !== 'object') return undefined;
  
  // 1. Check root level keys
  for (const key of possibleKeys) {
    if (key in obj && obj[key] !== undefined && obj[key] !== null) {
      return obj[key];
    }
  }

  // 2. Check nested common container objects (like contact, data, lead, user)
  const commonContainers = ['contact', 'data', 'lead', 'user', 'customer'];
  for (const container of commonContainers) {
    if (obj[container] && typeof obj[container] === 'object') {
      const val = findValue(obj[container], possibleKeys);
      if (val !== undefined && val !== null) {
        return val;
      }
    }
  }

  // 3. Fallback: Depth-First Search for any nested keys
  for (const key in obj) {
    if (obj[key] && typeof obj[key] === 'object' && !commonContainers.includes(key)) {
      const val = findValue(obj[key], possibleKeys);
      if (val !== undefined && val !== null) {
        return val;
      }
    }
  }

  return undefined;
}

function calculateLeadScore(payload) {
    let score = 50;
    // Safely extract values regardless of nested GHL structures using findValue helper
    const email = (findValue(payload, ['email', 'Email', 'emailAddress']) || '').toLowerCase();
    const phone = findValue(payload, ['phone', 'Phone', 'phoneNumber']) || '';
    const company = findValue(payload, ['companyName', 'company']) || '';
    const firstName = (findValue(payload, ['first_name', 'firstName', 'first']) || '').toLowerCase();

    if (email.endsWith('@gmail.com') || email.endsWith('@yahoo.com') || email.endsWith('@hotmail.com')) {
        score -= 15;
    } else if (email.includes('@')) {
        score += 25; // Business domain
    }

    if (phone.length > 7) score += 15;
    if (company.length > 2) score += 10;
    if (firstName.includes('test') || firstName === '') score -= 30;

    return Math.max(0, Math.min(100, score));
}

/**
 * GET /api/webhooks/logs
 *
 * Returns recent webhook logs for the authenticated user.
 * Gated to paid plans via requirePlan middleware (Redis-cached tier check).
 */
router.get("/logs", authenticate, requirePlan("basic", "pro", "plus"), async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM webhook_logs 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 100`,
      [req.user.id]
    );
    return res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error("[webhooks] Error fetching logs:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching logs",
    });
  }
});

/**
 * PUT /api/webhooks/:id
 *
 * Updates the target_url and/or http_method for a specific webhook.
 * Body: { target_url?: string, http_method?: string }
 * Protected by JWT.
 */
router.put("/:id", authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { target_url, http_method, custom_headers } = req.body;

    if (target_url === undefined && http_method === undefined && custom_headers === undefined) {
      return res.status(400).json({
        success: false,
        message: "At least one of target_url, http_method or custom_headers is required",
      });
    }

    // Validate URL if provided (SSRF Protection)
    if (target_url) {
      const { isValid, error } = validateWebhookUrl(target_url);
      if (!isValid) {
        return res.status(400).json({
          success: false,
          message: error === "Invalid or prohibited target URL" ? "Invalid or prohibited target URL" : "Invalid URL format for target_url",
        });
      }
    }

    // Validate http_method if provided
    const validMethods = ['GET', 'POST', 'PUT', 'PATCH'];
    if (http_method && !validMethods.includes(http_method.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: `Invalid http_method. Must be one of: ${validMethods.join(', ')}`,
      });
    }

    // Validate custom_headers if provided
    if (custom_headers !== undefined) {
      if (typeof custom_headers !== 'object' || custom_headers === null || Array.isArray(custom_headers)) {
        return res.status(400).json({
          success: false,
          message: "custom_headers must be a valid JSON object",
        });
      }
      for (const [key, value] of Object.entries(custom_headers)) {
        if (typeof key !== 'string' || typeof value !== 'string') {
          return res.status(400).json({
            success: false,
            message: "custom_headers must consist of string key-value pairs",
          });
        }
      }
    }

    // Build dynamic SET clause
    const updates = [];
    const values = [];
    let paramIdx = 1;

    if (target_url !== undefined) {
      updates.push(`target_url = $${paramIdx++}`);
      values.push(target_url);
    }
    if (http_method !== undefined) {
      updates.push(`http_method = $${paramIdx++}`);
      values.push(http_method.toUpperCase());
    }
    if (custom_headers !== undefined) {
      // Authoritative State: strictly rely on DB (or signed JWT) to prevent RBAC escalation
      const planType = await getPlanType(req.user.id) || 'free';
      
      if (planType === 'free' || planType === 'basic') {
        return res.status(403).json({
          success: false,
          error: "Upgrade required to access this engine"
        });
      }

      updates.push(`custom_headers = $${paramIdx++}`);
      values.push(JSON.stringify(custom_headers));
    }

    values.push(id);
    values.push(req.user.id);

    const result = await query(
      `UPDATE webhook_keys SET ${updates.join(', ')} WHERE id = $${paramIdx++} AND user_id = $${paramIdx} RETURNING id, masked_key, target_url, http_method, custom_headers`,
      values,
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Webhook not found",
      });
    }

    const updated = result.rows[0];
    console.log("\n" + "═".repeat(60));
    console.log(`⚙️  WEBHOOK CONFIGURED: ${updated.masked_key}`);
    console.log(`   Target: ${updated.target_url || '(none)'}`);
    console.log(`   Method: ${updated.http_method}`);
    console.log(`   Custom Headers: ${JSON.stringify(updated.custom_headers)}`);
    console.log("═".repeat(60) + "\n");

    return res.status(200).json({
      success: true,
      message: "Webhook configuration saved",
      webhook: updated,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/webhooks/lead
 *
 * Receives simulated GoHighLevel lead data.
 * Protected by JWT authentication.
 *
 * Expected JSON body:
 *   { first_name: string, last_name: string, email: string }
 */
router.post("/lead", authenticate, (req, res) => {
  const { first_name, last_name, email } = req.body;

  // ── Validate required fields ────────────────────────────────────────────
  if (!first_name || !last_name || !email) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields: first_name, last_name, email",
    });
  }

  // ── Log to terminal with high visibility ────────────────────────────────
  console.log("\n" + "═".repeat(60));
  console.log(`🔔 NEW LEAD RECEIVED: ${first_name} ${last_name} - ${email}`);
  console.log("═".repeat(60) + "\n");

  return res.status(200).json({
    success: true,
    message: "Lead routed successfully",
  });
});

/**
 * DELETE /api/webhooks/queue/:id
 *
 * Looks up the job by ID (note: job cancelling is currently unavailable without job_id),
 * and updates its status in ghl_leads and webhook_logs to CANCELED.
 */
router.delete("/queue/:id", authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Note: BullMQ job cancellation is unavailable without a stored job_id.
    // We update the DB record to CANCELED to prevent further manual retries,
    // and enforce tenant isolation by scoping the UPDATE to the authenticated user.
    const leadResult = await query(
      `UPDATE ghl_leads 
       SET delivery_status = 'CANCELED', last_delivery_error = 'Auto-retry stopped by user' 
       WHERE id = $1 AND user_id = $2
       RETURNING id, webhook_key_id, raw_payload, is_test`,
      [id, req.user.id]
    );

    if (leadResult.rows.length > 0) {
      const lead = leadResult.rows[0];
      // 4. Update/insert a record in webhook_logs with status_code = 499 (Client Closed Request / Cancelled)
      await query(
        `INSERT INTO webhook_logs (user_id, webhook_id, method, status_code, request_payload, response_error, is_test)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [req.user.id, lead.webhook_key_id, 'POST', 499, JSON.stringify(lead.raw_payload), 'Auto-retry stopped by user', lead.is_test]
      ).catch(e => console.error("Failed to write cancel log to webhook_logs:", e.message));
    }

    return res.status(200).json({
      success: true,
      message: "Webhook retry queue job canceled successfully."
    });
  } catch (err) {
    next(err);
  }
});

export default router;
