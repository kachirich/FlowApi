import { Router } from "express";
import express from "express";
import { query } from "../db/connection.js";
import lemonSqueezyAuth from "../middleware/lemonSqueezyAuth.js";
import { redisClient } from "../middleware/rateLimiter.js";
import { planCacheKey } from "../middleware/requirePlan.js";

const router = Router();

// 1. Webhook Route & 2. Raw Body Requirement & 3. Security Verification via Middleware
router.post("/webhook", express.raw({ type: 'application/json' }), lemonSqueezyAuth, async (req, res) => {
  try {
    // 4. Payload Parsing
    const payload = JSON.parse(req.body.toString('utf8'));
    const { meta, data } = payload;
    const eventName = meta.event_name;

    if (eventName === 'order_created' || eventName === 'subscription_created') {
      const userId = meta.custom_data?.user_id;
      
      if (userId) {
        // Infer the tier from the LemonSqueezy product name (legacy names map
        // via tierFromPlan: basic/pro→growth, plus→enterprise). Default growth.
        const productName = (
          data?.attributes?.first_order_item?.product_name ||
          data?.attributes?.product_name ||
          ''
        ).toLowerCase();
        let tier = 'growth';
        if (productName.includes('plus') || productName.includes('enterprise')) tier = 'enterprise';
        else if (productName.includes('sandbox') || productName.includes('free')) tier = 'sandbox';

        // 5. Database Update — tier drives the daily lead cap (rateLimiter) and
        //    all downstream gating.
        await query(
          "UPDATE user_billing SET tier = $1 WHERE user_id = $2",
          [tier, userId]
        );

        // 6. Invalidate cached plan so downstream middleware sees the new tier immediately
        redisClient.del(planCacheKey(userId)).catch((err) =>
          console.error('[billing-webhook] Redis cache invalidation error:', err.message)
        );
      }
    }

    // 6. Acknowledge
    return res.status(200).send("OK");
  } catch (err) {
    console.error("[Billing Webhook] Error:", err);
    // Always return a 200 OK immediately upon receipt
    return res.status(200).send("OK");
  }
});

export default router;
