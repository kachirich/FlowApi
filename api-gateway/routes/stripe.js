import { Router } from "express";
import express from "express";
import { handleStripeWebhook, createCheckoutSession } from "../controllers/stripe.controller.js";
import { authenticate } from "../middleware/index.js";

const router = Router();

/**
 * POST /api/stripe/webhook
 * 
 * MUST bypass the global express.json() parser. 
 * express.raw ensures the Stripe signature verification buffer remains intact.
 */
router.post("/webhook", express.raw({ type: "application/json" }), handleStripeWebhook);

/**
 * POST /api/stripe/checkout
 * 
 * Standard JSON endpoint for creating a checkout session.
 */
router.post("/create-checkout-session", express.json(), authenticate, createCheckoutSession);

export default router;
