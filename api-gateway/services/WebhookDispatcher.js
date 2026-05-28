import axios from "axios";
import dns from "dns/promises";
import { URL } from "url";
import { query } from "../db/connection.js";
import redisClient from "../utils/redisClient.js";

// Atomic Lua script to check daily lead cap and increment in Redis
const CHECK_CAP_LUA = `
  local key = KEYS[1]
  local limit = tonumber(ARGV[1])
  local current = tonumber(redis.call('get', key) or "0")
  if current < limit then
      redis.call('incr', key)
      if current == 0 then
          redis.call('expire', key, 86400)
      end
      return 1
  else
      return 0
  end
`;

/**
 * Dispatches a lead to the appropriate outbound destination(s) based on the broker's strategy.
 * 
 * @param {string} userId - ID of the broker (user).
 * @param {object} payload - Lead payload data.
 * @param {string} contactId - Lead contact identifier.
 * @param {boolean} isTest - Whether this is a test lead.
 * @returns {Promise<object>} Dispatch result status.
 */
export async function dispatchLead(userId, payload, contactId, isTest = false) {
  // 1. Fetch broker's strategy
  const userRes = await query("SELECT routing_strategy, plan_type FROM users WHERE id = $1", [userId]);
  if (userRes.rowCount === 0) {
    return { success: false, error: "USER_NOT_FOUND", message: "Broker user not found." };
  }
  const routingStrategy = userRes.rows[0].routing_strategy || "round_robin";
  const planType = userRes.rows[0].plan_type || "free";

  // 2. Fetch active destinations
  const webhooksRes = await query(
    `SELECT id, target_url, http_method, daily_lead_cap, custom_headers 
     FROM webhook_keys 
     WHERE user_id = $1`,
    [userId]
  );
  const destinations = webhooksRes.rows.filter((w) => w.target_url);

  if (destinations.length === 0) {
    return { success: false, error: "NO_DESTINATIONS", message: "No active destinations configured." };
  }

  const todayStr = new Date().toISOString().split("T")[0];

  if (routingStrategy === "round_robin") {
    // Round Robin: Deliver strictly to the first available destination under cap
    for (const wh of destinations) {
      const cap = wh.daily_lead_cap ?? 10;
      const redisKey = `destination:leads:${wh.id}:${todayStr}`;

      // Check daily cap atomically in Redis
      const isUnderCap = await redisClient.eval(CHECK_CAP_LUA, {
        keys: [redisKey],
        arguments: [String(cap)],
      });

      if (isUnderCap === 1) {
        // Safe to attempt delivery
        try {
          const success = await attemptHttpRequest(wh, payload, planType, isTest);
          if (success) {
            // Write success log to DB
            await query(
              `INSERT INTO webhook_logs (user_id, webhook_id, method, status_code, request_payload, is_test)
               VALUES ($1, $2, $3, 200, $4, $5)`,
              [userId, wh.id, wh.http_method || "POST", JSON.stringify(payload), isTest]
            ).catch((e) => console.error("[Dispatcher] Failed to write success log:", e.message));

            // Update lead status
            await query(
              `UPDATE ghl_leads 
               SET delivery_status = 'DELIVERED', status = '200', webhook_key_id = $1, last_delivery_error = NULL
               WHERE contact_id = $2`,
              [wh.id, contactId]
            ).catch(() => {});

            return {
              success: true,
              strategy: "round_robin",
              destination: wh.target_url,
              destinationId: wh.id,
            };
          } else {
            throw new Error("HTTP request failed with non-2xx status code");
          }
        } catch (err) {
          // Decrement cap in Redis since delivery failed
          await redisClient.decr(redisKey).catch(() => {});

          // Write failure log to DB
          await query(
            `INSERT INTO webhook_logs (user_id, webhook_id, method, status_code, request_payload, response_error, is_test)
             VALUES ($1, $2, $3, 500, $4, $5, $6)`,
            [userId, wh.id, wh.http_method || "POST", JSON.stringify(payload), err.message, isTest]
          ).catch((e) => console.error("[Dispatcher] Failed to write failure log:", e.message));

          // Continue loop to try next destination
          console.warn(`[Dispatcher] Failed sending to ${wh.target_url}, trying next. Error: ${err.message}`);
        }
      }
    }

    // If loop finished and no delivery succeeded
    return {
      success: false,
      error: "NO_AVAILABLE_DESTINATIONS",
      message: "All buyer caps have been reached or deliveries failed.",
    };
  } else {
    // Broadcast: Deliver to ALL destinations under cap
    let deliveredCount = 0;
    for (const wh of destinations) {
      const cap = wh.daily_lead_cap ?? 10;
      const redisKey = `destination:leads:${wh.id}:${todayStr}`;

      const isUnderCap = await redisClient.eval(CHECK_CAP_LUA, {
        keys: [redisKey],
        arguments: [String(cap)],
      });

      if (isUnderCap === 1) {
        try {
          const success = await attemptHttpRequest(wh, payload, planType, isTest);
          if (success) {
            deliveredCount++;
            await query(
              `INSERT INTO webhook_logs (user_id, webhook_id, method, status_code, request_payload, is_test)
               VALUES ($1, $2, $3, 200, $4, $5)`,
              [userId, wh.id, wh.http_method || "POST", JSON.stringify(payload), isTest]
            ).catch((e) => console.error("[Dispatcher] Failed to write success log:", e.message));
          } else {
            throw new Error("HTTP request failed with non-2xx status code");
          }
        } catch (err) {
          await redisClient.decr(redisKey).catch(() => {});
          await query(
            `INSERT INTO webhook_logs (user_id, webhook_id, method, status_code, request_payload, response_error, is_test)
             VALUES ($1, $2, $3, 500, $4, $5, $6)`,
            [userId, wh.id, wh.http_method || "POST", JSON.stringify(payload), err.message, isTest]
          ).catch((e) => console.error("[Dispatcher] Failed to write failure log:", e.message));
        }
      }
    }

    if (deliveredCount > 0) {
      await query(
        `UPDATE ghl_leads 
         SET delivery_status = 'DELIVERED', status = '200', last_delivery_error = NULL
         WHERE contact_id = $1`,
        [contactId]
      ).catch(() => {});

      return { success: true, strategy: "broadcast", deliveredCount };
    }

    return {
      success: false,
      error: "NO_AVAILABLE_DESTINATIONS",
      message: "All buyer caps have been reached or deliveries failed.",
    };
  }
}

/**
 * Performs DNS Rebinding protection check and triggers the outgoing HTTP POST call.
 */
async function attemptHttpRequest(webhook, payload, planType, isTest = false) {
  const targetUrl = webhook.target_url;
  const parsedUrl = new URL(targetUrl);
  
  // DNS Rebinding protection (bypass only if isTest is explicitly true)
  if (!isTest) {
    const resolved = await dns.lookup(parsedUrl.hostname);
    const ip = resolved.address;
    
    if (
      ip.startsWith("127.") ||
      ip.startsWith("10.") ||
      ip.startsWith("192.168.") ||
      ip.startsWith("169.254.") ||
      ip === "0.0.0.0"
    ) {
      throw new Error("DNS Rebinding Blocked: Target URL resolves to an internal address.");
    }
  }

  // Setup headers (include custom headers if Pro/Plus)
  const mergedHeaders = { "Content-Type": "application/json" };
  const blocklistedHeaders = ["host", "content-length", "connection"];
  
  if (planType !== "free" && planType !== "basic") {
    if (webhook.custom_headers && typeof webhook.custom_headers === "object") {
      for (const [key, value] of Object.entries(webhook.custom_headers)) {
        if (!blocklistedHeaders.includes(key.toLowerCase())) {
          mergedHeaders[key] = value;
        }
      }
    }
  }

  const response = await axios({
    method: (webhook.http_method || "POST").toLowerCase(),
    url: targetUrl,
    data: payload,
    headers: mergedHeaders,
    timeout: 15000,
  });

  return response.status >= 200 && response.status < 300;
}
