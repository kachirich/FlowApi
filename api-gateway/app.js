/**
 * app.js — Express Application Factory
 *
 * Exports the fully-wired Express app WITHOUT calling app.listen().
 * Used by both server.js (production) and supertest (integration tests).
 */
import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import cors from "cors";
import { requestLogger, authenticate } from "./middleware/index.js";
import adminRoutes from "./routes/admin.js";
import webhookRoutes from "./routes/webhooks.js";
import catchRoutes from "./routes/catch.js";
import authRoutes from "./routes/auth.js";
import leadsRoutes from "./routes/leads.js";
import v1LeadsRoutes from "./routes/v1/leads.js";
import flowRoutes from "./routes/flows.js";
import workflowRoutes from "./routes/workflow.js";
import stripeRoutes from "./routes/stripe.js";
import billingRoutes from "./routes/billing.js";
import apiKeyRoutes from "./routes/apiKeys.js";
import userRoutes from "./routes/users.js";
import destinationRoutes from "./routes/destinations.js";
import destBalanceRouter from "./routes/destinationBalance.js";
import notificationRoutes from "./routes/notifications.js";
import routes from "./routes/index.js";

const app = express();
app.set("trust proxy", true);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
    },
  },
}));

const defaultOrigins = [
  'http://localhost:3000',
  'https://flowgateway.dev',
  'https://www.flowgateway.dev'
];
const envOrigins = (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
const allowedOrigins = [...new Set([...defaultOrigins, ...envOrigins])];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, or our API keys traffic)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-api-key", "x-trusted-device-token"]
}));

app.use(cookieParser());

// Stripe Webhook — MUST come before express.json() to retain raw body
app.use("/api/stripe", stripeRoutes);

// Billing Webhook — MUST come before express.json() to retain raw body
app.use("/api/billing", billingRoutes);

// Public v1 ingestion — parse JSON AND retain the raw bytes so verifySignature
// can recompute the HMAC. Mounted before the global parser so body-parser
// captures rawBody here; the global express.json() then no-ops for this path.
app.use("/api/v1/leads", express.json({
  limit: "100kb",
  verify: (req, _res, buf) => { req.rawBody = buf.toString("utf8"); },
}));

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));
app.use(requestLogger);           // Log every request to PostgreSQL

// Admin dashboard API
app.use("/api/admin", adminRoutes);

// Webhook receivers
app.use("/api/webhooks", webhookRoutes);

// Dynamic Dispatcher
app.use("/api/catch", catchRoutes);

// Lead simulation (legacy)
app.use("/api/leads", leadsRoutes);

// Public lead ingestion API (v1)
app.use("/api/v1/leads", v1LeadsRoutes);

// Flow management
app.use("/api/flows", flowRoutes);

// Workflow overrides
app.use("/api/workflow", workflowRoutes);

// Auth routes
app.use("/api/auth", authRoutes);

// API Keys routes
app.use("/api/keys", apiKeyRoutes);

// Users routes
app.use("/api/users", userRoutes);

// Destinations routes
app.use("/api/destinations", destinationRoutes);

// Per-destination lead metering / credit balances
// (mounted on /api/destinations for /:id/balance/* and /api/balance for /summary)
app.use("/api/destinations", destBalanceRouter);
app.use("/api/balance", destBalanceRouter);

// Notification preferences + unsubscribe
app.use("/api/notifications", notificationRoutes);

// Public fallback routes
app.use(routes);

// Centralised error handler
app.use((err, req, res, next) => {
  // Always log the full raw error to the server console for Docker logs
  console.error(`[Global Error] ${req.method} ${req.originalUrl}`);
  console.error(err.stack || err.message);

  const status = err.status || err.statusCode || 500;
  
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      error: "Payload Too Large",
      message: "Payload exceeds 100kb limit"
    });
  }

  // If it's a 500-level infrastructure error, sanitize the response to prevent data leaks
  if (status >= 500) {
    return res.status(500).json({
      success: false,
      error: 'An unexpected server error occurred. Our team has been notified.'
    });
  }

  // If it's a known operational error (4xx), pass the message and status code through safely
  res.status(status).json({
    success: false,
    error: err.name || "Request Error",
    message: err.message,
  });
});

export default app;
