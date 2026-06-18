import { Router } from "express";
import authenticate from "../middleware/auth.js";
import { query } from "../db/connection.js";

const router = Router();

/**
 * POST /api/workflow/mock-bypass
 *
 * Circuit Breaker — bypasses the downstream processing pipeline when the
 * AI provider is rate-limited or unavailable. Directly writes a hardcoded
 * lead_score and override message to the guest_sessions table so the React
 * frontend's polling loop resolves without waiting.
 *
 * Protected by JWT — only authenticated clients can trigger the bypass.
 * The session_id is provided in the request body.
 *
 * Expected JSON body: { session_id: string }
 */
router.post("/mock-bypass", authenticate, async (req, res, next) => {
  const { session_id: sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({
      success: false,
      message: "Missing required field: session_id",
    });
  }

  try {
    const result = await query(
      `UPDATE guest_sessions
          SET lead_score         = $1,
              ai_welcome_message = $2
        WHERE session_id = $3
          AND ai_welcome_message IS NULL`,
      [
        99,
        "SYSTEM OVERRIDE: Agentic AI cooling down. Manual bypass engaged. Lead captured successfully.",
        sessionId,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message:
          "No pending session found — either the session_id is invalid or AI has already responded.",
      });
    }

    console.log("\n" + "═".repeat(60));
    console.log(`⚡ CIRCUIT BREAKER: Bypass applied for session ${sessionId.slice(0, 16)}…`);
    console.log("═".repeat(60) + "\n");

    return res.status(200).json({
      success: true,
      message: "Circuit breaker engaged — session updated with override values",
      data: {
        session_id: sessionId,
        lead_score: 99,
        bypass: true,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
