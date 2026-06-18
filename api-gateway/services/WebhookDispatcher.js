import axios from "axios";
import dns from "dns/promises";
import { URL } from "url";
import { query } from "../db/connection.js";
import redisClient from "../utils/redisClient.js";
import { webhookQueue } from "../services/queue.js";
import { getMeteringState, invalidateMeteringCache } from "./destinationMetering.js";

/**
 * Debit one credit from a metered destination after a CONFIRMED 2xx delivery.
 * Atomic single-statement update; records a debit transaction and busts cache.
 */
async function debitDestination(destinationId, userId, leadId) {
  await query(
    `UPDATE destination_balances
       SET balance = GREATEST(balance - 1, 0),
           total_consumed = total_consumed + 1,
           updated_at = NOW()
     WHERE destination_id = $1 AND is_metered = TRUE`,
    [destinationId]
  ).catch((e) => console.error("[Dispatcher] Credit debit failed:", e.message));

  await query(
    `INSERT INTO balance_transactions (destination_id, user_id, type, amount, lead_id, note)
     VALUES ($1, $2, 'debit', 1, $3, 'Lead delivered')`,
    [destinationId, userId, leadId]
  ).catch((e) => console.error("[Dispatcher] Debit transaction insert failed:", e.message));

  await invalidateMeteringCache(destinationId);
}

/**
 * Returns true if the destination is metered, out of credits, and set to pause.
 * Logs a PAUSED_NO_CREDITS marker and releases the reserved daily-cap slot.
 */
async function isPausedNoCredits(metering, wh, userId, payload, isTest, cap, redisKey) {
  if (!(metering.is_metered && metering.balance === 0 && metering.exhausted_action === "pause")) {
    return false;
  }
  if (cap > 0) {
    await redisClient.decr(redisKey).catch(() => {});
  }
  await query(
    `INSERT INTO webhook_logs (user_id, destination_id, method, status_code, request_payload, response_error, is_test)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [userId, wh.id, wh.http_method || "POST", 0, JSON.stringify(payload), "PAUSED_NO_CREDITS", isTest]
  ).catch((e) => console.error("[Dispatcher] Failed to write paused log:", e.message));
  return true;
}

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
 * @param {string|null} flowId - Optional flow id. When provided, destinations are
 *   resolved from the flow's attached subset and the flow's routing_strategy is
 *   used instead of the user-wide strategy. When null, behaviour is unchanged
 *   (all of the user's active destinations + the user's routing_strategy).
 * @returns {Promise<object>} Dispatch result status.
 */
export async function dispatchLead(userId, payload, contactId, isTest = false, flowId = null, leadId = null) {
  // 1. Fetch broker's strategy + billing context (joined from satellite tables)
  const userRes = await query(
    `SELECT us.routing_strategy, ub.plan_type, ub.tier
     FROM users u
     JOIN user_billing  ub ON ub.user_id = u.id
     JOIN user_settings us ON us.user_id = u.id
     WHERE u.id = $1`,
    [userId]
  );
  if (userRes.rowCount === 0) {
    return { success: false, error: "USER_NOT_FOUND", message: "Broker user not found." };
  }
  let routingStrategy = userRes.rows[0].routing_strategy || "round_robin";
  const planType = userRes.rows[0].plan_type || "free";
  const tier = userRes.rows[0].tier || "sandbox";

  // 2. Resolve active destinations — via the flow's subset when a flow is set,
  //    otherwise fall back to all of the user's active destinations.
  let destinations;
  if (flowId) {
    const flowRes = await query(
      "SELECT routing_strategy FROM flows WHERE id = $1 AND user_id = $2",
      [flowId, userId]
    );
    if (flowRes.rowCount === 0) {
      return { success: false, error: "FLOW_NOT_FOUND", message: "Flow not found." };
    }
    routingStrategy = flowRes.rows[0].routing_strategy || "round_robin";

    const flowDestRes = await query(
      `SELECT d.id, d.target_url, 'POST' AS http_method, d.daily_cap AS daily_lead_cap, '{}'::jsonb AS custom_headers
       FROM flow_destinations fd
       JOIN destinations d ON d.id = fd.destination_id
       WHERE fd.flow_id = $1 AND d.is_active = TRUE`,
      [flowId]
    );
    destinations = flowDestRes.rows;
  } else {
    const destinationsRes = await query(
      `SELECT id, target_url, 'POST' AS http_method, daily_cap AS daily_lead_cap, '{}'::jsonb AS custom_headers
       FROM destinations
       WHERE user_id = $1 AND is_active = TRUE`,
      [userId]
    );
    destinations = destinationsRes.rows;
  }

  if (destinations.length === 0) {
    return { success: false, error: "NO_DESTINATIONS", message: "No active destinations configured." };
  }

  const todayStr = new Date().toISOString().split("T")[0];

  if (routingStrategy === "round_robin") {
    for (const wh of destinations) {
      const cap = wh.daily_lead_cap ?? 0;
      const redisKey = `destination:leads:${wh.id}:${todayStr}`;

      let isUnderCap = 1;
      if (cap > 0) {
        isUnderCap = await redisClient.eval(CHECK_CAP_LUA, {
          keys: [redisKey],
          arguments: [String(cap)],
        });
      }

      if (isUnderCap === 1) {
        // Metering: daily cap → metering check → dispatch → debit on success.
        const metering = await getMeteringState(wh.id);
        if (await isPausedNoCredits(metering, wh, userId, payload, isTest, cap, redisKey)) {
          continue; // out of credits + pause: skip this buyer, not a failure
        }

        try {
          const success = await attemptHttpRequest(wh, payload, planType, isTest);
          if (success) {
            await query(
              `INSERT INTO webhook_logs (user_id, destination_id, method, status_code, request_payload, is_test)
               VALUES ($1, $2, $3, 200, $4, $5)`,
              [userId, wh.id, wh.http_method || "POST", JSON.stringify(payload), isTest]
            ).catch((e) => console.error("[Dispatcher] Failed to write success log:", e.message));

            await query(
              `UPDATE ghl_leads
               SET delivery_status = 'DELIVERED', destination_id = $1, last_delivery_error = NULL
               WHERE contact_id = $2`,
              [wh.id, contactId]
            ).catch(() => {});

            if (metering.is_metered) {
              await debitDestination(wh.id, userId, leadId);
            }

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
          if (cap > 0) {
            await redisClient.decr(redisKey).catch(() => {});
          }

          if (tier === 'sandbox') {
            await query(
              `INSERT INTO webhook_logs (user_id, destination_id, method, status_code, request_payload, response_error, is_test)
               VALUES ($1, $2, $3, 500, $4, $5, $6)`,
              [userId, wh.id, wh.http_method || "POST", JSON.stringify(payload), 'Failed - No Retries for Sandbox', isTest]
            ).catch((e) => console.error("[Dispatcher] Failed to write failure log:", e.message));

            await query(
              `UPDATE ghl_leads SET delivery_status = 'FAILED', last_delivery_error = 'Failed - No Retries for Sandbox' WHERE contact_id = $1`,
              [contactId]
            ).catch(() => {});

            console.warn(`[Dispatcher] Failed sending to ${wh.target_url}, trying next. Error: ${err.message}`);
          } else if (tier === 'growth') {
            await webhookQueue.add("dispatch", { webhook: wh, payload, method: wh.http_method || "POST", contactId, isTest }, { attempts: 3, backoff: { type: 'fixed', delay: 5000 } });
            await query(`UPDATE ghl_leads SET delivery_status = 'RETRYING', status = '500', last_delivery_error = $1 WHERE contact_id = $2`, [err.message, contactId]).catch(() => {});
            return { success: true, strategy: "round_robin", destination: wh.target_url, destinationId: wh.id, queued: true };
          } else if (tier === 'enterprise') {
            await webhookQueue.add("dispatch", { webhook: wh, payload, method: wh.http_method || "POST", contactId, isTest }, { attempts: 100, backoff: { type: 'exponential', delay: 5000 } });
            await query(`UPDATE ghl_leads SET delivery_status = 'RETRYING', status = '500', last_delivery_error = $1 WHERE contact_id = $2`, [err.message, contactId]).catch(() => {});
            return { success: true, strategy: "round_robin", destination: wh.target_url, destinationId: wh.id, queued: true };
          }
        }
      }
    }

    return {
      success: false,
      error: "NO_AVAILABLE_DESTINATIONS",
      message: "All buyer caps have been reached or deliveries failed.",
    };
  } else {
    // Broadcast: Deliver to ALL destinations under cap
    let deliveredCount = 0;
    for (const wh of destinations) {
      const cap = wh.daily_lead_cap ?? 0;
      const redisKey = `destination:leads:${wh.id}:${todayStr}`;

      let isUnderCap = 1;
      if (cap > 0) {
        isUnderCap = await redisClient.eval(CHECK_CAP_LUA, {
          keys: [redisKey],
          arguments: [String(cap)],
        });
      }

      if (isUnderCap === 1) {
        // Metering: daily cap → metering check → dispatch → debit on success.
        const metering = await getMeteringState(wh.id);
        if (await isPausedNoCredits(metering, wh, userId, payload, isTest, cap, redisKey)) {
          continue; // out of credits + pause: skip this buyer, not a failure
        }

        try {
          const success = await attemptHttpRequest(wh, payload, planType, isTest);
          if (success) {
            deliveredCount++;
            await query(
              `INSERT INTO webhook_logs (user_id, destination_id, method, status_code, request_payload, is_test)
               VALUES ($1, $2, $3, 200, $4, $5)`,
              [userId, wh.id, wh.http_method || "POST", JSON.stringify(payload), isTest]
            ).catch((e) => console.error("[Dispatcher] Failed to write success log:", e.message));

            if (metering.is_metered) {
              await debitDestination(wh.id, userId, leadId);
            }
          } else {
            throw new Error("HTTP request failed with non-2xx status code");
          }
        } catch (err) {
          if (cap > 0) {
            await redisClient.decr(redisKey).catch(() => {});
          }

          if (tier === 'sandbox') {
            await query(
              `INSERT INTO webhook_logs (user_id, destination_id, method, status_code, request_payload, response_error, is_test)
               VALUES ($1, $2, $3, 500, $4, $5, $6)`,
              [userId, wh.id, wh.http_method || "POST", JSON.stringify(payload), 'Failed - No Retries for Sandbox', isTest]
            ).catch((e) => console.error("[Dispatcher] Failed to write failure log:", e.message));
          } else if (tier === 'growth') {
            await webhookQueue.add("dispatch", { webhook: wh, payload, method: wh.http_method || "POST", contactId, isTest }, { attempts: 3, backoff: { type: 'fixed', delay: 5000 } });
            deliveredCount++;
          } else if (tier === 'enterprise') {
            await webhookQueue.add("dispatch", { webhook: wh, payload, method: wh.http_method || "POST", contactId, isTest }, { attempts: 100, backoff: { type: 'exponential', delay: 5000 } });
            deliveredCount++;
          }
        }
      }
    }

    if (deliveredCount > 0) {
      await query(
        `UPDATE ghl_leads
         SET delivery_status = 'DELIVERED', last_delivery_error = NULL
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
