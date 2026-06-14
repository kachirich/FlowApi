/**
 * routes/v1/leads.js — Public lead ingestion API (v1)
 *
 * POST /api/v1/leads
 *   Auth: x-api-key (Bearer) via apiKeyAuth.
 *   Accepts ANY JSON object shape — the smart extractor in leadIngest handles
 *   arbitrary nesting from any CRM/form provider. Routes the lead to the API
 *   key's assigned Flow (if any), otherwise falls back to all of the user's
 *   active destinations.
 */
import { Router } from "express";
import { apiKeyAuth } from "../../middleware/apiKeyAuth.js";
import { verifySignature } from "../../middleware/verifySignature.js";
import meteredLimiter from "../../middleware/meteredLimiter.js";
import { ingestLead } from "../../services/leadIngest.js";

const router = Router();

router.post("/", apiKeyAuth, verifySignature, async (req, res, next) => {
  try {
    // meteredLimiter reads the owning user from req.webhookKey (same as the
    // catch path), so bridge req.user -> req.webhookKey here.
    req.webhookKey = { userId: req.user.id, id: req.user.key_id };

    const limiterError = await new Promise((resolve) => {
      meteredLimiter(req, res, (err) => resolve(err || null));
    });
    if (res.headersSent) return; // limiter already sent a 429
    if (limiterError) throw limiterError;

    // Reject only empty / non-object bodies — otherwise accept any shape.
    const payload = req.body;
    if (
      !payload ||
      typeof payload !== "object" ||
      Array.isArray(payload) ||
      Object.keys(payload).length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Request body must be a non-empty JSON object.",
      });
    }

    let result;
    try {
      result = await ingestLead({
        userId: req.user.id,
        payload,
        source: "v1_api",
        tier: req.user.tier,
        plan_type: req.user.plan_type,
        flowId: req.user.flow_id || null,
      });
    } catch (ingestErr) {
      if (ingestErr.status === 429) {
        return res.status(429).json({
          success: false,
          message: ingestErr.message,
        });
      }
      throw ingestErr;
    }

    return res.status(200).json({
      success: true,
      lead_id: result.lead_id,
      contact_id: result.contact_id,
      score: result.score,
      queued: true,
    });
  } catch (error) {
    console.error("[v1/leads] Error ingesting lead:", error);
    next(error);
  }
});

export default router;
