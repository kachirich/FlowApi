import { Router } from "express";
import { authenticate } from "../middleware/index.js";

const router = Router();

/**
 * POST /api/leads/simulate
 *
 * JWT-protected route that fires a mock lead payload to the configured
 * destination webhook for enrichment testing, then returns the response
 * back to the frontend.
 */
router.post("/simulate", authenticate, async (req, res, next) => {
  const destinationUrl = process.env.DESTINATION_WEBHOOK_URL;

  if (!destinationUrl) {
    return res.status(503).json({
      status: 503,
      error: "Service Unavailable",
      message: "No DESTINATION_WEBHOOK_URL configured on the server.",
    });
  }

  try {
    const leadPayload = {
      name: "Sarah Tech",
      email: "sarah.tech@example.com",
      source: "Dashboard",
      tags: ["manual_trigger"],
      triggered_by: req.user?.email || req.user?.id,
      triggered_at: new Date().toISOString(),
    };

    console.log("[leads] Simulating lead enrichment →", destinationUrl);

    const webhookRes = await fetch(destinationUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(leadPayload),
    });

    const webhookData = await webhookRes.text();

    // Try to parse as JSON; fall back to raw text
    let parsed;
    try {
      parsed = JSON.parse(webhookData);
    } catch {
      parsed = { raw: webhookData };
    }

    console.log("[leads] Destination webhook responded:", webhookRes.status);

    return res.json({
      status: 200,
      message: "Lead enrichment triggered successfully",
      lead: leadPayload,
      webhook: {
        status: webhookRes.status,
        data: parsed,
      },
    });
  } catch (err) {
    // If the destination is unreachable, return a clear error instead of crashing
    if (err.cause?.code === "ECONNREFUSED") {
      return res.status(502).json({
        status: 502,
        error: "Bad Gateway",
        message: "Destination webhook is unreachable — is your endpoint online?",
      });
    }
    next(err);
  }
});

export default router;
