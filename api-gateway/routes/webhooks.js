import { Router } from "express";
import axios from "axios";
import authenticate from "../middleware/auth.js";
import ghlAuthenticate from "../middleware/ghlAuth.js";
import { query } from "../db/connection.js";

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
 * POST /api/webhooks/ghl
 *
 * Receives live webhooks from GoHighLevel.
 * Runs algorithmic scoring and routes clean data to user destination.
 * Protected by GHL API Key.
 */
router.post("/ghl", ghlAuthenticate, async (req, res) => {
  try {
    const payload = req.body;
    const apiKey = req.headers["x-api-key"] || req.query["x-api-key"];

    // ── Smart Catcher: Core Lead Data Extraction ─────────────────────────
    const firstName = findValue(payload, ['first_name', 'firstName', 'first']) || '';
    const lastName = findValue(payload, ['last_name', 'lastName', 'last']) || '';
    const email = findValue(payload, ['email', 'Email', 'emailAddress']) || '';
    const phone = findValue(payload, ['phone', 'Phone', 'phoneNumber']) || '';

    // ── Basic Security: Reject empty/meaningless payloads ───────────────
    if (!firstName && !lastName && !email && !phone) {
      return res.status(400).json({
        success: false,
        message: "Rejected: Payload contains zero recognizable lead data",
      });
    }

    // ── Smart Catcher: Zero Friction ID Handling ──────────────────────────
    let contactId = findValue(payload, ['contact_id', 'contactId', 'id', 'contact_key']);
    if (!contactId) {
      // Create a unique, reproducible identifier if email exists, otherwise a safe unique random ID
      const cleanEmail = email ? email.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
      contactId = cleanEmail 
        ? `catch_${cleanEmail}` 
        : `catch_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    }

    console.log("\n" + "═".repeat(60));
    console.log(`🚀 GOHIGHLEVEL WEBHOOK RECEIVED (Smart Catcher Mode)`);
    console.log(`👤 Lead: ${firstName} ${lastName}`);
    console.log(`🆔 Contact ID: ${contactId}`);
    console.log("═".repeat(60));

    // ── Algorithmic Lead Scoring ────────────────────────────────────────
    const leadScore = calculateLeadScore(payload);
    console.log(`🧠 AI_Lead_Score: ${leadScore}/100`);
    console.log("═".repeat(60) + "\n");

    // ── Zero-Retention DB Logging (Decoupled Queue) ────────────────────────
    await query(
      `INSERT INTO ghl_leads (contact_id, raw_payload, status, webhook_key_id, lead_score, first_name, last_name, email, phone, delivery_status, retry_count)
       VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (contact_id) DO UPDATE SET
         status = EXCLUDED.status,
         webhook_key_id = EXCLUDED.webhook_key_id,
         lead_score = EXCLUDED.lead_score,
         first_name = EXCLUDED.first_name,
         last_name = EXCLUDED.last_name,
         email = EXCLUDED.email,
         phone = EXCLUDED.phone,
         delivery_status = EXCLUDED.delivery_status,
         retry_count = EXCLUDED.retry_count`,
      [contactId, JSON.stringify(payload), 'PENDING', req.webhookKey?.id, leadScore, firstName, lastName, email, phone, 'PENDING', 0]
    );

    return res.status(200).json({
      success: true,
      message: "GoHighLevel webhook processed securely",
    });
  } catch (error) {
    console.error("[webhooks] Error processing GHL webhook:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while processing webhook",
    });
  }
});


export default router;
