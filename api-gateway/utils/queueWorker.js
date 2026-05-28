import axios from "axios";
import { query } from "../db/connection.js";

function getTranslatedErrorMessage(error) {
  if (error.response) {
    const status = error.response.status;
    if (status === 404) {
      return "Destination URL not found. Please verify you pasted the exact GoHighLevel webhook link and that it is currently active.";
    }
    if (status === 400) {
      return "The destination rejected the payload. Check your JSON mapping to ensure all required fields match their expectations.";
    }
    if (status === 401 || status === 403) {
      return "Access denied by destination. Check if your target URL requires a specific API key or authentication header.";
    }
    if (status >= 500) {
      return "The destination server is currently failing to process requests. This is an issue on their end.";
    }
  }
  return "Dispatch failed. Review the raw response log below for details.";
}

let isProcessing = false;

export async function processQueue() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    // Select leads that are PENDING or RETRYING
    const res = await query(`
      SELECT gl.*, 
             COALESCE(wk.target_url, d.target_url) AS target_url,
             COALESCE(wk.http_method, 'POST') AS http_method
      FROM ghl_leads gl
      LEFT JOIN webhook_keys wk ON gl.webhook_key_id = wk.id
      LEFT JOIN destinations d ON gl.destination_id = d.id
      WHERE gl.delivery_status IN ('PENDING', 'RETRYING')
      ORDER BY gl.created_at ASC
    `);

    for (const lead of res.rows) {
      const destinationUrl = lead.target_url;
      const enrichedPayload = {
        ...lead.raw_payload,
        AI_Lead_Score: lead.lead_score,
        scored_at: lead.created_at
      };

      if (!destinationUrl) {
        // No destination URL, mark as FAILED immediately since it can't be delivered
        await query(`
          UPDATE ghl_leads 
          SET delivery_status = 'FAILED', 
              last_delivery_error = 'No destination URL configured for this API Key.'
          WHERE id = $1
        `, [lead.id]);
        continue;
      }

      try {
        const method = (lead.http_method || 'POST').toLowerCase();
        await axios({ method, url: destinationUrl, data: enrichedPayload, timeout: 5000 });
        
        // Success
        await query(`
          UPDATE ghl_leads 
          SET delivery_status = 'DELIVERED',
              status = '200',
              last_delivery_error = NULL
          WHERE id = $1
        `, [lead.id]);
        console.log(`[queue] Lead ${lead.id} successfully delivered to ${destinationUrl}`);
      } catch (err) {
        const nextRetryCount = lead.retry_count + 1;
        const translatedError = getTranslatedErrorMessage(err);
        const nextStatus = nextRetryCount >= 5 ? 'FAILED' : 'RETRYING';
        
        await query(`
          UPDATE ghl_leads 
          SET delivery_status = $1,
              retry_count = $2,
              last_delivery_error = $3,
              status = $4
          WHERE id = $5
        `, [
          nextStatus, 
          nextRetryCount, 
          translatedError, 
          err.response ? String(err.response.status) : '500', 
          lead.id
        ]);
        console.error(`[queue] Lead ${lead.id} delivery attempt ${nextRetryCount} failed: ${err.message}`);
      }
    }
  } catch (err) {
    console.error("[queue] Error processing queue:", err);
  } finally {
    isProcessing = false;
  }
}

export function startQueueWorker(intervalMs = 5000) {
  console.log(`[queue] Starting background queue worker with interval ${intervalMs}ms`);
  // Run immediately on start, then at the specified interval
  processQueue();
  setInterval(processQueue, intervalMs);
}
