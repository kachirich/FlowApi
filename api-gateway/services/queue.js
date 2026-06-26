import { Queue, Worker, UnrecoverableError } from "bullmq";
import IORedis from "ioredis";
import { URL } from "url";
import dns from "dns/promises";
import axios from "axios";
import { query } from "../db/connection.js";
import { enqueueNotification } from "./notification.queue.js";
import { dedupCheck, NOTIFICATION_TYPES } from "./notification.service.js";
import { planFor } from "../config/plans.js";

const redisUrl = process.env.REDIS_URL || "redis://redis:6379";
const parsed = new URL(redisUrl);

// Explicitly create an IORedis (ioredis) connection so BullMQ uses ioredis
// internals. Passing plain options lets BullMQ auto-detect the client type;
// when the `redis` (node-redis) package is also present BullMQ 5.x picks that
// client, which lacks the `defineCommand` API BullMQ still needs internally.
const connection = new IORedis({
  host: parsed.hostname,
  port: parseInt(parsed.port || "6379", 10),
  ...(parsed.username ? { username: parsed.username } : {}),
  ...(parsed.password ? { password: parsed.password } : {}),
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// ── Initialize Queue ────────────────────────────────────────────────────────
export const webhookQueue = new Queue("webhook-dispatch", { connection });

// ── Initialize Worker ────────────────────────────────────────────────────────
export const worker = new Worker(
  "webhook-dispatch",
  async (job) => {
    const { webhook, payload, headers, method, contactId, isTest, userId, flow_id, tier: jobTier } = job.data;

    // Destination/flow routing path: jobs enqueued without a single `webhook`
    // target (e.g. /api/v1/leads) fan out via the smart dispatcher, which
    // resolves the flow's (or user's) destinations and handles its own retries.
    if (!webhook) {
      const { dispatchLead } = await import("./WebhookDispatcher.js");
      const result = await dispatchLead(userId, payload, contactId, isTest, flow_id ?? null, job.data.leadId ?? null);
      if (!result || !result.success) {
        throw new Error(result?.message || "Lead dispatch failed");
      }
      return result;
    }

    const targetUrl = webhook.target_url;

    if (!targetUrl) {
      throw new Error("No destination URL configured for this API Key.");
    }

    // ── Build Merged Headers ────────────────────────────────────────────
    const mergedHeaders = { "Content-Type": "application/json" };
    
    // Explicitly block system-critical headers (case-insensitive checks)
    const blocklistedHeaders = ["host", "content-length", "connection"];
    
    // tier is included in the job payload at enqueue time (leadIngest.js)
    const authoritativeTier = jobTier || 'sandbox';

    if (planFor(authoritativeTier).customHeaders) {
      if (webhook.custom_headers && typeof webhook.custom_headers === "object") {
        for (const [key, value] of Object.entries(webhook.custom_headers)) {
          if (!blocklistedHeaders.includes(key.toLowerCase())) {
            mergedHeaders[key] = value;
          }
        }
      }
    }

    console.log(`[Worker] Dispatching job ${job.id} for webhook ${webhook.id} (Attempt ${job.attemptsMade + 1}/${job.opts.attempts || 1})`);

    try {
      const parsedUrl = new URL(targetUrl);
      const resolved = await dns.lookup(parsedUrl.hostname);
      const ip = resolved.address;
      
      if (
        ip.startsWith("127.") ||
        ip.startsWith("10.") ||
        ip.startsWith("192.168.") ||
        ip.startsWith("169.254.") ||
        ip === "0.0.0.0"
      ) {
        throw new UnrecoverableError("DNS Rebinding Blocked: Target URL resolves to an internal address.");
      }

      const forwardResponse = await axios({
        method: (method || "POST").toLowerCase(),
        url: targetUrl,
        data: payload,
        headers: mergedHeaders,
        // Cap outbound calls at 8s so a slow downstream cannot hold a worker slot.
        timeout: 8000,
        validateStatus: () => true, // don't throw axios error on 4xx/5xx to inspect status
      });

      const destStatus = forwardResponse.status;
      const isSuccess = destStatus >= 200 && destStatus < 300;

      if (!isSuccess) {
        let details = "";
        if (forwardResponse.data) {
          if (typeof forwardResponse.data === "string") {
            details = forwardResponse.data;
          } else if (typeof forwardResponse.data === "object") {
            details = forwardResponse.data.message || forwardResponse.data.error || JSON.stringify(forwardResponse.data);
          }
        }
        if (!details && forwardResponse.statusText) {
          details = forwardResponse.statusText;
        }
        const errMsg = `Destination returned ${destStatus}${details ? ": " + details : ""}`;
        throw new Error(errMsg);
      }

      // ── Write 200 Success to Logs ──────────────────────────────────────────
      await query(
        `INSERT INTO webhook_logs (user_id, webhook_id, method, status_code, request_payload, response_error, is_test)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [webhook.user_id, webhook.id, method, destStatus, JSON.stringify(payload), null, isTest]
      ).catch((e) => console.error("[Worker] Failed to write success log:", e.message));

      // Update lead delivery status
      await query(
        `UPDATE ghl_leads
         SET delivery_status = 'DELIVERED', last_delivery_error = NULL
         WHERE contact_id = $1`,
        [contactId]
      ).catch(() => {});

      return { success: true, status: destStatus };
    } catch (err) {
      // ── Determine failure status and write DB state ──────────────────────────
      const nextRetryCount = job.attemptsMade + 1;
      const maxAttempts = job.opts.attempts || 1;
      const isFinalFailure = err instanceof UnrecoverableError || nextRetryCount >= maxAttempts;
      const nextStatus = isFinalFailure ? "FAILED" : "RETRYING";

      let statusCode = 500;
      if (err.message.includes("returned")) {
        // Extract status code from our thrown error message (e.g., "returned 401")
        const match = err.message.match(/returned (\d+)/);
        if (match) {
          statusCode = parseInt(match[1], 10);
        }
      }

      await query(
        `UPDATE ghl_leads
         SET delivery_status = $1,
             retry_count = $2,
             last_delivery_error = $3
         WHERE contact_id = $4`,
        [nextStatus, nextRetryCount, err.message, contactId]
      ).catch(() => {});

      // Throw again to trigger BullMQ's automatic retry
      throw err;
    }
  },
  // Process up to 5 dispatch jobs in parallel instead of strictly serial (the
  // default of 1), so a single slow downstream doesn't stall the whole queue.
  { connection, concurrency: 5 }
);

// ── Worker Final Failure Listener ────────────────────────────────────────────
worker.on("failed", async (job, err) => {
  if (!job) return;

  // Destination/flow routing jobs have no single `webhook` to log against;
  // dispatchLead() owns their logging and lead-status writes.
  if (!job.data?.webhook) return;

  const attempts = job.opts.attempts || 1;
  if (job.attemptsMade >= attempts) {
    const { webhook, payload, method, contactId, isTest } = job.data;
    console.error(`[Worker] Job ${job.id} failed after all retries:`, err.message);

    let statusCode = 500;
    if (err.message.includes("returned")) {
      const match = err.message.match(/returned (\d+)/);
      if (match) {
        statusCode = parseInt(match[1], 10);
      }
    }

    // Write final error log
    await query(
      `INSERT INTO webhook_logs (user_id, webhook_id, method, status_code, request_payload, response_error, is_test)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        webhook.user_id,
        webhook.id,
        method,
        statusCode,
        JSON.stringify(payload),
        `Failed after all retries: ${err.message}`,
        isTest,
      ]
    ).catch((e) => console.error("[Worker] Failed to write final failure log:", e.message));

    // Guarantee delivery status is FAILED
    await query(
      `UPDATE ghl_leads
       SET delivery_status = 'FAILED', last_delivery_error = $1, status = $2
       WHERE contact_id = $3`,
      [`Failed after all retries: ${err.message}`, String(statusCode), contactId]
    ).catch(() => {});

    // Delivery failure notification (one per lead, 24h dedup)
    if (webhook.user_id && contactId) {
      const dedupKey = `notif:failure:${contactId}`;
      dedupCheck(dedupKey, 24 * 3600).then(async (already) => {
        if (already) return;
        // Fetch lead email for context
        const leadRes = await query(
          'SELECT email FROM ghl_leads WHERE contact_id = $1',
          [contactId]
        ).catch(() => ({ rows: [] }));
        await enqueueNotification(webhook.user_id, NOTIFICATION_TYPES.DELIVERY_FAILURE, {
          destination_name: webhook.id,
          lead_email: leadRes.rows[0]?.email || null,
          attempts: job.attemptsMade,
          error_message: err.message,
        }).catch(() => {});
      }).catch(() => {});
    }
  }
});
