import { query } from '../db/connection.js';
import { getPlanType } from './index.js';

/**
 * Metered Rate Limiter Middleware
 *
 * Enforces monthly request quotas based on the user's billing tier.
 * Expects `req.webhookKey.userId` to be set by upstream auth middleware (ghlAuth).
 *
 * Tiers:
 *   free/basic  — 10,000 requests/month
 *   pro         — 100,000 requests/month
 *   plus        — Unlimited
 */
export default async function meteredLimiter(req, res, next) {
  try {
    const userId = req.webhookKey?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Cannot identify webhook owner',
      });
    }

    // ── Step A: Billing Cycle Check ──────────────────────────────────────
    const userResult = await query(
      'SELECT monthly_request_count, billing_cycle_reset FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: User not found',
      });
    }

    const user = userResult.rows[0];
    const planType = await getPlanType(userId) || 'free';
    let currentCount = user.monthly_request_count || 0;
    const cycleReset = new Date(user.billing_cycle_reset);
    const now = new Date();

    // If 30 days have elapsed since last reset, roll the odometer back to 0
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    if (now - cycleReset >= thirtyDaysMs) {
      await query(
        'UPDATE users SET monthly_request_count = 0, billing_cycle_reset = $1 WHERE id = $2',
        [now.toISOString(), userId]
      );
      currentCount = 0;
    }

    // ── Step B: Plan Limit Enforcement ───────────────────────────────────
    let limit = 10000;                   // free / basic
    if (planType === 'pro') limit = 100000;
    if (planType === 'plus') limit = Infinity;

    if (currentCount >= limit) {
      return res.status(429).json({
        success: false,
        message: 'Monthly quota exceeded. Please upgrade your plan to continue processing webhooks.',
      });
    }

    // ── Step C: Increment Odometer ───────────────────────────────────────
    await query(
      'UPDATE users SET monthly_request_count = monthly_request_count + 1 WHERE id = $1',
      [userId]
    );

    next();
  } catch (err) {
    console.error('[meteredLimiter] Error enforcing quota:', err.message);
    next(err);
  }
}
