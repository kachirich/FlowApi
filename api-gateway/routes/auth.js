import { Router } from "express";
import crypto from "crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import { query } from "../db/connection.js";
import { authenticate } from "../middleware/index.js";
import { authRateLimiter, stepUpLimiter, otpGenerationLimiter, otpVerificationLimiter, redisClient } from "../middleware/rateLimiter.js";
import { sendOtp, verifyOtp, sendStepUpOtp, register, login, forgotPassword, resetPassword, verifyResetOtp } from "../controllers/auth.controller.js";
import { googleLogin, googleCallback, logout } from "../controllers/googleAuth.controller.js";
import { sendTokenResponse } from "../utils/authUtils.js";
import { calculateLeadScore } from "../services/leadIngest.js";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const SALT_ROUNDS = 12;


/**
 * POST /api/auth/2fa/generate
 *
 * Generates a two-factor secret and QR code for the authenticated user.
 * Protected by JWT.
 */
router.post("/2fa/generate", authenticate, otpGenerationLimiter, async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Look up the user's email
    const userResult = await query("SELECT email FROM users WHERE id = $1", [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    const userEmail = userResult.rows[0].email;

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `FlowAPI Gateway (${userEmail})`,
    });

    // Save temporary secret to Redis for 10 minutes (do not persist in DB yet)
    await redisClient.setex(`2fa_setup:${userId}`, 600, secret.base32);

    // Generate QR Code URL
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    return res.json({
      success: true,
      qrCodeUrl,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/2fa/enable
 *
 * Verifies a 6-digit TOTP code to officially enable two-factor authentication.
 * Body: { token }
 * Protected by JWT.
 */
router.post("/2fa/enable", authenticate, otpVerificationLimiter, async (req, res, next) => {
  try {
    const { token } = req.body;
    const userId = req.user.id;

    if (!token) {
      return res.status(400).json({ success: false, message: "Token is required" });
    }

    // Look up the temporary secret from Redis
    const tempSecret = await redisClient.get(`2fa_setup:${userId}`);

    if (!tempSecret) {
      return res.status(400).json({
        success: false,
        message: "Two-factor authentication setup session expired or not started. Please generate a new QR code.",
      });
    }

    // Verify token
    const verified = speakeasy.totp.verify({
      secret: tempSecret,
      encoding: "base32",
      token,
    });

    if (!verified) {
      return res.status(400).json({
        success: false,
        message: "Invalid authenticator code. Please try again.",
      });
    }

    // Enable 2FA in DB and permanently save the secret
    await query(
      "UPDATE user_auth SET two_factor_secret = $1, two_factor_enabled = TRUE WHERE user_id = $2",
      [tempSecret, userId]
    );

    // Clean up temporary secret
    await redisClient.del(`2fa_setup:${userId}`);

    return res.json({
      success: true,
      message: "Two-factor authentication successfully enabled",
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/login/verify
 *
 * Completes standard login if 2FA is enabled.
 * Body: { userId, token }
 * Public.
 */
router.post("/login/verify", otpVerificationLimiter, async (req, res, next) => {
  try {
    const { challenge_token, token } = req.body;

    if (!challenge_token || !token) {
      return res.status(400).json({
        status: 400,
        error: "Bad Request",
        message: "challenge_token and 2FA token are required",
      });
    }

    // Look up userId from the short-lived Redis challenge key
    const userId = await redisClient.get(`2fa_challenge:${challenge_token}`);
    if (!userId) {
      return res.status(401).json({
        status: 401,
        error: "Unauthorized",
        message: "Challenge token expired or invalid. Please log in again.",
      });
    }

    // Look up the user
    const result = await query(
      `SELECT u.id, u.email, u.first_name, u.last_name,
              ua.two_factor_secret, ua.two_factor_enabled
       FROM users u
       JOIN user_auth ua ON ua.user_id = u.id
       WHERE u.id = $1`,
      [userId]
    );
    const user = result.rows[0];

    if (!user || !user.two_factor_enabled) {
      return res.status(404).json({
        status: 404,
        error: "Not Found",
        message: "User or two-factor settings not found",
      });
    }

    // Verify TOTP token
    const verified = speakeasy.totp.verify({
      secret: user.two_factor_secret,
      encoding: "base32",
      token,
    });

    if (!verified) {
      return res.status(401).json({
        status: 401,
        error: "Unauthorized",
        message: "Invalid authenticator code",
      });
    }

    // Consume the challenge key
    await redisClient.del(`2fa_challenge:${challenge_token}`);

    return sendTokenResponse(user, 200, res, 'Login successful');
  } catch (err) {
    next(err);
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   Guest Session — Ignition Route
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * POST /api/auth/guest
 *
 * Creates a new guest session for the Live Tech Demo flow.
 * - Accepts { first_name, last_name, email, phone, companyName } in the request body.
 * - Hashes the email with bcrypt for security.
 * - Generates a cryptographic session_id.
 * - Calculates the dynamic lead score natively.
 * - Inserts into guest_sessions.
 * - Returns the session_id, token, and computed lead score.
 */
router.post("/guest", authRateLimiter, async (req, res, next) => {
  try {
    const { first_name, last_name, email } = req.body;

    // ── Input validation ───────────────────────────────────────────────────
    if (!first_name || !last_name || !email) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "first_name, last_name, and email are required",
      });
    }

    const emailFormatRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailFormatRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "A valid email address is required",
      });
    }

    // ── Guard: secret not configured ─────────────────────────────────────
    if (!JWT_SECRET) {
      const error = new Error("JWT_SECRET is not configured on the server");
      error.name = "Internal Server Error";
      error.status = 500;
      return next(error);
    }

    // ── Hash the email for security ────────────────────────────────────────
    const emailHash = await bcrypt.hash(email, SALT_ROUNDS);

    const sessionId = crypto.randomBytes(32).toString("hex");

    // ── Calculate dynamic lead score ───────────────────────────────────────
    const leadScore = calculateLeadScore(req.body);

    // ── Insert into guest_sessions ─────────────────────────────────────────
    const result = await query(
      `INSERT INTO guest_sessions (first_name, last_name, email, session_id, lead_score, ai_welcome_message)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, first_name, last_name, email, session_id, lead_score, ai_welcome_message, created_at`,
      [first_name, last_name, emailHash, sessionId, leadScore, "[SYSTEM] FlowAPI Gateway active. Listening for payloads..."]
    );

    const session = result.rows[0];

    // ── Mint a JWT containing the session_id ───────────────────────────────
    const token = jwt.sign(
      {
        guest_id: session.id,
        session_id: sessionId,
        email,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.status(201).json({
      status: 201,
      message: "Guest session created",
      session_id: sessionId,
      token,
      lead_score: leadScore,
    });
  } catch (err) {
    next(err);
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   Guest Session — Status / Polling Route
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * GET /api/auth/guest/status
 *
 * JWT-protected. Returns the full guest_sessions row for the session_id
 * encoded in the caller's token. The frontend polls this endpoint to check
 * whether lead_score and ai_welcome_message have been populated.
 */
router.get("/guest/status", authenticate, async (req, res, next) => {
  try {
    const { session_id } = req.user;

    if (!session_id) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Token does not contain a session_id — use a guest JWT",
      });
    }

    const result = await query(
      `SELECT id, first_name, last_name, email, session_id,
              lead_score, ai_welcome_message, created_at
       FROM guest_sessions
       WHERE session_id = $1`,
      [session_id]
    );

    const session = result.rows[0];

    if (!session) {
      return res.status(404).json({
        success: false,
        error: "Not Found",
        message: "Guest session not found",
      });
    }

    return res.json({
      status: 200,
      session,
    });
  } catch (err) {
    next(err);
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   OTP (Email) Routes
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * POST /api/auth/otp/send
 *
 * Sends an OTP via Email (Nodemailer).
 * Rate-limited to max 5 requests per hour.
 */
router.post("/otp/send", otpGenerationLimiter, sendOtp);

/**
 * POST /api/auth/otp/verify
 *
 * Verifies the OTP and issues a JWT session token.
 */
router.post("/otp/verify", otpVerificationLimiter, verifyOtp);

/**
 * POST /api/auth/step-up-otp
 *
 * Sends a Step-Up 2FA OTP for sensitive actions (like webhook generation).
 * Protected by JWT.
 */
router.post("/step-up-otp", authenticate, otpGenerationLimiter, sendStepUpOtp);

/* ═══════════════════════════════════════════════════════════════════════════
   Google Auth & Logout
   ═══════════════════════════════════════════════════════════════════════════ */

router.get("/google", googleLogin);
router.get("/google/callback", googleCallback);
router.post("/logout", (req, res) => {
  const token = req.cookies?.jwt;
  if (token) {
    redisClient.setex(`blacklist:${token}`, 86400, 'revoked').catch(() => {});
  }
  res.clearCookie('jwt', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });
  return res.status(200).json({ success: true, message: 'Logged out successfully' });
});

router.post("/register", authRateLimiter, register);
router.post("/login", authRateLimiter, login);

/**
 * GET /api/auth/me
 *
 * Fetches the freshest user data from the database.
 * Protected by JWT.
 */
router.get("/me", authenticate, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.is_admin,
              ub.plan_type, ub.tier, ub.lifetime_webhooks_created,
              ua.two_factor_enabled,
              us.has_completed_onboarding
       FROM users u
       JOIN user_billing  ub ON ub.user_id = u.id
       JOIN user_auth     ua ON ua.user_id = u.id
       JOIN user_settings us ON us.user_id = u.id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const user = result.rows[0];
    user.name = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email.split('@')[0];

    return res.json({
      success: true,
      user,
    });
  } catch (err) {
    next(err);
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   Password Reset
   ═══════════════════════════════════════════════════════════════════════════ */

router.post("/forgot-password", otpGenerationLimiter, forgotPassword);
router.post("/verify-reset-otp", otpVerificationLimiter, verifyResetOtp);
router.post("/reset-password", otpVerificationLimiter, resetPassword);

/* ═══════════════════════════════════════════════════════════════════════════
   GDPR — Right to be Forgotten (Account Deletion)
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * DELETE /api/auth/me
 *
 * Permanently deletes the authenticated user and all associated data.
 * ON DELETE CASCADE in the schema handles webhook_keys, ghl_leads,
 * webhook_logs, and otps automatically.
 */
router.delete("/me", authenticate, async (req, res, next) => {
  try {
    await query("DELETE FROM users WHERE id = $1", [req.user.id]);
    return res.status(200).json({
      success: true,
      message: "Account and all associated data have been permanently deleted.",
    });
  } catch (err) {
    next(err);
  }
});

export default router;
