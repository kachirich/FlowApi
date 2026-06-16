import Stripe from 'stripe';
import { query } from '../db/connection.js';
import { redisClient } from '../middleware/rateLimiter.js';
import { planCacheKey } from '../middleware/requirePlan.js';
import { enqueueNotification, NOTIFICATION_TYPES } from '../services/notifications.js';

// Lazy load Stripe instance to avoid ES module hoisting traps
let stripe;

/**
 * POST /api/billing/checkout
 *
 * Creates a Stripe Checkout Session for a new subscription with a 3-day
 * free trial. Returns the hosted checkout URL so the frontend can redirect.
 *
 * Body: { userEmail }
 */
export const createCheckoutSession = async (req, res) => {
  try {
    if (!stripe) stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

    const userId = req.user?.id;
    const userEmail = req.user?.email;
    const { priceId } = req.body;

    if (!userId || !userEmail) {
      return res.status(401).json({ error: 'Unauthorized: User identity missing' });
    }

    if (!priceId) {
      return res.status(400).json({ error: 'priceId is required' });
    }

    let unitAmount = 2900;
    let productName = 'FlowAPI Gateway Basic';

    if (priceId === 'pro' || priceId === 'price_pro') {
      unitAmount = 9900;
      productName = 'FlowAPI Gateway Pro';
    } else if (priceId === 'plus' || priceId === 'price_plus') {
      unitAmount = 24900;
      productName = 'FlowAPI Gateway Enterprise Plus';
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'paypal', 'amazon_pay'],
      mode: 'subscription',
      customer_email: userEmail,
      client_reference_id: userId,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: productName,
            },
            unit_amount: unitAmount,
            recurring: { interval: 'month' },
          },
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 3,
      },
      success_url: `${FRONTEND_URL}/dashboard?success=true`,
      cancel_url: `${FRONTEND_URL}/dashboard?canceled=true`,
    });

    return res.status(200).json({ success: true, url: session.url });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return res.status(500).json({ error: 'Failed to create checkout session', details: error.message });
  }
};

/**
 * POST /api/billing/webhook
 *
 * Handles incoming Stripe webhook events. Verifies the request signature
 * using STRIPE_WEBHOOK_SECRET, then dispatches on event type.
 *
 * IMPORTANT: This route must receive the raw body (not JSON-parsed).
 */
export const handleStripeWebhook = async (req, res) => {
  if (!stripe) stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  const signature = req.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, signature, endpointSecret);
  } catch (err) {
    console.error('[stripe-webhook] ⚠️  Signature verification failed:', err.message);
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      console.log('[stripe-webhook] ✅ checkout.session.completed —', session.id);

      const customerId = session.customer;
      const subscriptionId = session.subscription;
      const userId = session.client_reference_id || session.metadata?.userId;

      if (userId) {
        try {
          await query(
            `UPDATE user_billing
             SET stripe_customer_id = $1, stripe_subscription_id = $2, plan_type = $3, subscription_status = $4
             WHERE user_id = $5`,
            [customerId, subscriptionId, 'pro', 'active', userId]
          );
          // Invalidate cached plan so the next request reads fresh from Postgres
          redisClient.del(planCacheKey(userId)).catch((e) =>
            console.error(`[stripe-webhook] Redis cache invalidation error:`, e.message)
          );
          console.log(`[stripe-webhook] ✅ Success: User ${userId} upgraded to Pro`);

          // Fire feature-announcement email
          const planTier = session.metadata?.plan_type || 'pro';
          enqueueNotification(userId, NOTIFICATION_TYPES.FEATURE_ANNOUNCEMENT, {
            subject: `Welcome to FlowGateway ${planTier === 'plus' ? 'Enterprise' : 'Growth'} — your new features are live`,
            headline: `Your ${planTier === 'plus' ? 'Enterprise' : 'Growth'} features are now active`,
            plan: planTier,
            cta_label: 'Open Dashboard',
          }).catch((e) => console.error('[stripe-webhook] Feature announcement email failed:', e.message));
        } catch (dbErr) {
          console.error(`[stripe-webhook] ❌ Database error updating user ${userId}:`, dbErr.message);
        }
      } else {
        console.warn(`[stripe-webhook] ⚠️ No internal userId found on session ${session.id}`);
      }
      break;
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      const status = subscription.status;
      const subscriptionId = subscription.id;
      
      let planType = 'free';
      if (status === 'active' || status === 'trialing') {
         planType = 'pro';
      }

      try {
        const subUpdateResult = await query(
          "UPDATE user_billing SET subscription_status = $1, plan_type = $2 WHERE stripe_subscription_id = $3 RETURNING user_id",
          [status, planType, subscriptionId]
        );
        // Invalidate cached plan for the affected user
        if (subUpdateResult.rows[0]?.user_id) {
          redisClient.del(planCacheKey(subUpdateResult.rows[0].user_id)).catch((e) =>
            console.error("[stripe-webhook] Redis cache invalidation error:", e.message)
          );
        }
        console.log(`[stripe-webhook] ✅ Success: Subscription ${subscriptionId} updated to ${status} (${planType})`);
      } catch (dbErr) {
        console.error(`[stripe-webhook] ❌ Database error updating subscription ${subscriptionId}:`, dbErr.message);
      }
      break;
    }
    default:
      console.log(`[stripe-webhook] Unhandled event type: ${event.type}`);
  }

  return res.status(200).json({ received: true });
};
