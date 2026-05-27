import { Queue, Worker, UnrecoverableError } from "bullmq";
import { URL } from "url";
import dns from "dns/promises";
import axios from "axios";
import { query } from "../db/connection.js";

const redisUrl = process.env.REDIS_URL || "redis://redis:6379";
const parsed = new URL(redisUrl);
const connection = {
  host: parsed.hostname,
  port: parseInt(parsed.port || "6379", 10),
  username: parsed.username || undefined,
  password: parsed.password || undefined,
  maxRetriesPerRequest: null,
};

// ── Initialize Queue ────────────────────────────────────────────────────────
export const webhookQueue = new Queue("webhook-dispatch", { connection });

// ── Initialize Worker ────────────────────────────────────────────────────────
export const worker = new Worker(
  "webhook-dispatch",
  async (job) => {
    const { webhook, payload, headers, method, contactId, isTest } = job.data;
    const targetUrl = webhook.target_url;

    if (!targetUrl) {
      throw new Error("No destination URL configured for this API Key.");
    }

    // ── Build Merged Headers ────────────────────────────────────────────
    const mergedHeaders = { "Content-Type": "application/json" };
    
    // Explicitly block system-critical headers (case-insensitive checks)
    const blocklistedHeaders = ["host", "content-length", "connection"];
    
    // Authoritative State Check for Custom Headers Privilege
    const planRes = await query("SELECT plan_type FROM users WHERE id = $1", [webhook.user_id]);
    const authoritativePlan = planRes.rows[0]?.plan_type || 'free';
    
    if (authoritativePlan !== 'free' && authoritativePlan !== 'basic') {
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
        timeout: 15000,
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
         SET delivery_status = 'DELIVERED', status = $1, last_delivery_error = NULL 
         WHERE contact_id = $2`,
        [String(destStatus), contactId]
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
             last_delivery_error = $3,
             status = $4
         WHERE contact_id = $5`,
        [nextStatus, nextRetryCount, err.message, String(statusCode), contactId]
      ).catch(() => {});

      // Throw again to trigger BullMQ's automatic retry
      throw err;
    }
  },
  { connection }
);

// ── Worker Final Failure Listener ────────────────────────────────────────────
worker.on("failed", async (job, err) => {
  if (!job) return;

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
  }
});
