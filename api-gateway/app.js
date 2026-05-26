/**
 * app.js — Express Application Factory
 *
 * Exports the fully-wired Express app WITHOUT calling app.listen().
 * Used by both server.js (production) and supertest (integration tests).
 */
import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { rateLimiter, requestLogger, authenticate } from "./middleware/index.js";
import adminRoutes from "./routes/admin.js";
import webhookRoutes from "./routes/webhooks.js";
import catchRoutes from "./routes/catch.js";
import authRoutes from "./routes/auth.js";
import leadsRoutes from "./routes/leads.js";
import workflowRoutes from "./routes/workflow.js";
import stripeRoutes from "./routes/stripe.js";
import billingRoutes from "./routes/billing.js";
import routes from "./routes/index.js";

const app = express();
app.set("trust proxy", 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
    },
  },
}));

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-api-key", "x-trusted-device-token"]
}));

// Stripe Webhook — MUST come before express.json() to retain raw body
app.use("/api/stripe", stripeRoutes);

// Billing Webhook — MUST come before express.json() to retain raw body
app.use("/api/billing", billingRoutes);

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));

// Admin dashboard API
app.use("/api/admin", adminRoutes);

// Webhook receivers
app.use("/api/webhooks", webhookRoutes);

// Dynamic Dispatcher
app.use("/api/catch", catchRoutes);

// Lead simulation
app.use("/api/leads", leadsRoutes);

// Workflow overrides
app.use("/api/workflow", workflowRoutes);

// Auth routes
app.use("/api/auth", authRoutes);

// Public fallback routes
app.use(routes);

// Centralised error handler
app.use((err, _req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      status: 413,
      error: "Payload Too Large",
      message: "Payload exceeds 100kb limit"
    });
  }

  res.status(status).json({
    status,
    error: err.name || "Internal Server Error",
    message: err.message,
  });
});

export default app;
