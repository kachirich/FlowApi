/**
 * routes/destinationBalance.js — per-destination lead metering & credit balances.
 *
 * Mounted at BOTH /api/destinations (for /:id/balance/*) and /api/balance (for
 * /summary). JWT-authenticated. Metering features are gated to the Growth and
 * Enterprise *tiers* (users.tier) — note we gate on tier, not plan_type, because
 * "growth"/"enterprise" are tier values (plan_type is free/basic/pro/plus).
 */
import { Router } from "express";
import authenticate from "../middleware/auth.js";
import { query } from "../db/connection.js";
import {
  validateRequest,
  balanceSettingsSchema,
  topUpRequestSchema,
  adminCreditSchema,
} from "../middleware/validateRequest.js";
import { CREDIT_PACKS } from "../constants/creditPacks.js";
import { invalidateMeteringCache } from "../services/destinationMetering.js";

const router = Router();

router.use(authenticate);

/* ── Guards ─────────────────────────────────────────────────────────────── */

// Gate metering features to Growth / Enterprise tiers (Sandbox is excluded).
async function requireMeteringTier(req, res, next) {
  try {
    const r = await query("SELECT tier FROM user_billing WHERE user_id = $1", [req.user.id]);
    const tier = r.rows[0]?.tier || "sandbox";
    req.user.tier = tier;
    if (tier !== "growth" && tier !== "enterprise") {
      return res.status(403).json({
        success: false,
        error: "Upgrade required",
        message: "Lead metering requires the Growth or Enterprise plan.",
      });
    }
    next();
  } catch (err) {
    next(err);
  }
}

// Verify the destination exists AND belongs to the requesting user.
async function verifyOwnership(req, res, next) {
  try {
    const r = await query(
      "SELECT id FROM destinations WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user.id]
    );
    if (r.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Destination not found" });
    }
    next();
  } catch (err) {
    next(err);
  }
}

// admin-only (broker admin) gate.
async function requireAdmin(req, res, next) {
  try {
    const r = await query("SELECT is_admin FROM users WHERE id = $1", [req.user.id]);
    if (r.rows[0]?.is_admin !== true) {
      return res.status(403).json({ success: false, message: "Admin privileges required" });
    }
    next();
  } catch (err) {
    next(err);
  }
}

/* ── GET /api/balance/summary ───────────────────────────────────────────── */
router.get("/summary", requireMeteringTier, async (req, res, next) => {
  try {
    const r = await query(
      `SELECT
         COALESCE(SUM(CASE WHEN is_metered THEN balance ELSE 0 END), 0)::int AS total_balance,
         COUNT(*) FILTER (WHERE is_metered)::int AS metered_count,
         COUNT(*) FILTER (WHERE is_metered AND exhausted_action = 'pause' AND balance = 0)::int AS paused_count
       FROM destination_balances
       WHERE user_id = $1`,
      [req.user.id]
    );
    const row = r.rows[0] || { total_balance: 0, metered_count: 0, paused_count: 0 };
    return res.status(200).json({
      success: true,
      total_balance: row.total_balance,
      metered_count: row.metered_count,
      paused_count: row.paused_count,
    });
  } catch (err) {
    next(err);
  }
});

/* ── GET /api/destinations/:id/balance ──────────────────────────────────── */
router.get("/:id/balance", requireMeteringTier, verifyOwnership, async (req, res, next) => {
  try {
    const r = await query(
      "SELECT * FROM destination_balances WHERE destination_id = $1",
      [req.params.id]
    );

    if (r.rowCount === 0) {
      return res.status(200).json({
        is_metered: false,
        exhausted_action: "continue",
        balance: 0,
        total_purchased: 0,
        total_consumed: 0,
        low_balance: false,
        paused: false,
      });
    }

    const b = r.rows[0];
    const low_balance = b.balance > 0 && b.balance < Math.ceil(b.total_purchased * 0.1);
    const paused = b.is_metered && b.exhausted_action === "pause" && b.balance === 0;

    return res.status(200).json({
      is_metered: b.is_metered,
      exhausted_action: b.exhausted_action,
      balance: b.balance,
      total_purchased: b.total_purchased,
      total_consumed: b.total_consumed,
      low_balance,
      paused,
    });
  } catch (err) {
    next(err);
  }
});

/* ── PUT /api/destinations/:id/balance/settings ─────────────────────────── */
router.put(
  "/:id/balance/settings",
  requireMeteringTier,
  verifyOwnership,
  validateRequest(balanceSettingsSchema),
  async (req, res, next) => {
    try {
      const { is_metered, exhausted_action } = req.body;

      // requireMeteringTier already blocks Sandbox; this is defence-in-depth.
      if (is_metered === true && req.user.tier !== "growth" && req.user.tier !== "enterprise") {
        return res.status(403).json({
          success: false,
          message: "Lead metering requires the Growth or Enterprise plan.",
        });
      }

      const r = await query(
        `INSERT INTO destination_balances (destination_id, user_id, is_metered, exhausted_action)
         VALUES ($1, $2, COALESCE($3, FALSE), COALESCE($4, 'continue'))
         ON CONFLICT (destination_id) DO UPDATE SET
           is_metered = COALESCE($3, destination_balances.is_metered),
           exhausted_action = COALESCE($4, destination_balances.exhausted_action),
           updated_at = NOW()
         RETURNING *`,
        [
          req.params.id,
          req.user.id,
          is_metered === undefined ? null : is_metered,
          exhausted_action === undefined ? null : exhausted_action,
        ]
      );

      await invalidateMeteringCache(req.params.id);

      const b = r.rows[0];
      return res.status(200).json({
        success: true,
        is_metered: b.is_metered,
        exhausted_action: b.exhausted_action,
        balance: b.balance,
        total_purchased: b.total_purchased,
        total_consumed: b.total_consumed,
      });
    } catch (err) {
      next(err);
    }
  }
);

/* ── GET /api/destinations/:id/balance/transactions ─────────────────────── */
router.get(
  "/:id/balance/transactions",
  requireMeteringTier,
  verifyOwnership,
  async (req, res, next) => {
    try {
      const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
      const offset = parseInt(req.query.offset, 10) || 0;

      const r = await query(
        `SELECT id, type, amount, pack_name, lead_id, note, created_at
         FROM balance_transactions
         WHERE destination_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [req.params.id, limit, offset]
      );

      return res.status(200).json({ success: true, transactions: r.rows });
    } catch (err) {
      next(err);
    }
  }
);

/* ── POST /api/destinations/:id/balance/top-up-request ──────────────────── */
router.post(
  "/:id/balance/top-up-request",
  requireMeteringTier,
  verifyOwnership,
  validateRequest(topUpRequestSchema),
  async (req, res, next) => {
    // TODO: Replace this handler with a Stripe checkout session once
    // Stripe/LemonSqueezy verification is complete. The endpoint contract
    // (request body + response shape) stays the same — only the internals change.
    try {
      const { pack } = req.body;
      const packDef = CREDIT_PACKS[pack];

      await query(
        `INSERT INTO balance_transactions (destination_id, user_id, type, amount, pack_name, note)
         VALUES ($1, $2, 'credit', $3, $4, 'PENDING - awaiting payment confirmation')`,
        [req.params.id, req.user.id, packDef.credits, pack]
      );

      return res.status(200).json({
        success: true,
        pack,
        credits: packDef.credits,
        booking_url: "https://cal.com/flowgateway/credits",
        message: "Request received — we will confirm within 24 hours",
      });
    } catch (err) {
      next(err);
    }
  }
);

/* ── POST /api/destinations/:id/balance/admin-credit ────────────────────── */
router.post(
  "/:id/balance/admin-credit",
  verifyOwnership,
  requireAdmin,
  validateRequest(adminCreditSchema),
  async (req, res, next) => {
    try {
      const { amount, pack_name, note } = req.body;

      // Atomic create-or-increment in a single statement.
      const r = await query(
        `INSERT INTO destination_balances (destination_id, user_id, balance, total_purchased)
         VALUES ($1, $2, $3, $3)
         ON CONFLICT (destination_id) DO UPDATE SET
           balance = destination_balances.balance + $3,
           total_purchased = destination_balances.total_purchased + $3,
           updated_at = NOW()
         RETURNING *`,
        [req.params.id, req.user.id, amount]
      );

      await query(
        `INSERT INTO balance_transactions (destination_id, user_id, type, amount, pack_name, note)
         VALUES ($1, $2, 'credit', $3, $4, $5)`,
        [req.params.id, req.user.id, amount, pack_name || null, note || null]
      );

      await invalidateMeteringCache(req.params.id);

      const b = r.rows[0];
      return res.status(200).json({
        success: true,
        is_metered: b.is_metered,
        exhausted_action: b.exhausted_action,
        balance: b.balance,
        total_purchased: b.total_purchased,
        total_consumed: b.total_consumed,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
