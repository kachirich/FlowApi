import { Router } from "express";
import express from "express";
import { query } from "../db/connection.js";
import lemonSqueezyAuth from "../middleware/lemonSqueezyAuth.js";

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
        let planType = 'plus'; // Default to plus
        
        // Dynamically infer tier if possible
        if (data && data.attributes && data.attributes.first_order_item && data.attributes.first_order_item.product_name) {
          const productName = data.attributes.first_order_item.product_name.toLowerCase();
          if (productName.includes('basic')) planType = 'basic';
          else if (productName.includes('pro')) planType = 'pro';
          else if (productName.includes('plus')) planType = 'plus';
        } else if (data && data.attributes && data.attributes.product_name) {
          const productName = data.attributes.product_name.toLowerCase();
          if (productName.includes('basic')) planType = 'basic';
          else if (productName.includes('pro')) planType = 'pro';
          else if (productName.includes('plus')) planType = 'plus';
        }

        // 5. Database Update
        await query("UPDATE users SET plan_type = $1 WHERE id = $2", [planType, userId]);
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
