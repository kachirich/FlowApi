import { Router } from "express";
import axios from "axios";
import authenticate from "../middleware/auth.js";
import requirePlan from "../middleware/requirePlan.js";
import { getPlanType } from "../middleware/index.js";
import meteredLimiter from "../middleware/meteredLimiter.js";
import { planFor } from "../config/plans.js";
import { query } from "../db/connection.js";
import { webhookQueue } from "../services/queue.js";
import { validateRequest, webhookConfigBodySchema } from "../middleware/validateRequest.js";
import { findValue, calculateLeadScore } from "../services/leadIngest.js";

const router = Router();

/**
 * GET /api/webhooks/logs
 *
 * Returns recent webhook logs for the authenticated user.
 * Gated to paid plans via requirePlan middleware (Redis-cached tier check).
 */
router.get("/logs", authenticate, requirePlan("growth", "enterprise"), async (req, res) => {
  try {
    const result = await query(
      `SELECT id, user_id, webhook_id, destination_id, method, status_code,
              request_payload, response_error, is_test, created_at
       FROM webhook_logs
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
router.put("/:id", authenticate, validateRequest(webhookConfigBodySchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { target_url, http_method, custom_headers } = req.body;

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

      if (!planFor(planType).customHeaders) {
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
 * DELETE /api/webhooks/queue/:id
 *
 * Looks up the job by ID (note: job cancelling is currently unavailable without job_id),
 * and updates its status in ghl_leads and webhook_logs to CANCELED.
 */
router.delete("/queue/:id", authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Attempt real BullMQ job removal if we have a stored job ID
    const jobLookup = await query(
      'SELECT bullmq_job_id FROM ghl_leads WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    if (jobLookup.rows[0]?.bullmq_job_id) {
      const job = await webhookQueue.getJob(jobLookup.rows[0].bullmq_job_id);
      await job?.remove().catch(() => {});
    }

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
