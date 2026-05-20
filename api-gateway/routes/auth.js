import { Router } from "express";
import crypto from "crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import { query } from "../db/connection.js";
import { authenticate } from "../middleware/index.js";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "24h";
const SALT_ROUNDS = 12;


/**
 * POST /api/auth/register
 *
 * Accepts { email, password } in the request body.
 * - Hashes the password with bcrypt.
 * - Inserts the user into the users table in PostgreSQL.
 * - Returns a signed JWT and user details on success.
 */
router.post("/register", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // ── Input validation ───────────────────────────────────────────────────
    if (!email || !password) {
      return res.status(400).json({
        status: 400,
        error: "Bad Request",
        message: "Email and password are required",
      });
    }

    // ── Check if user already exists ────────────────────────────────────────
    const checkResult = await query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );
    if (checkResult.rows.length > 0) {
      return res.status(409).json({
        status: 409,
        error: "Conflict",
        message: "A user with this email already exists",
      });
    }

    // ── Hash the password ────────────────--------------------------------──
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // ── Insert the user ────────────────────────────────────────────────────
    const insertResult = await query(
      "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email",
      [email, passwordHash]
    );

    const user = insertResult.rows[0];

    // ── Guard: secret not configured ─────────────────────────────────────
    if (!JWT_SECRET) {
      const error = new Error("JWT_SECRET is not configured on the server");
      error.name = "Internal Server Error";
      error.status = 500;
      return next(error);
    }

    // ── Generate JWT ────────────────────────────────----------------───────
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.status(201).json({
      status: 201,
      message: "Registration successful",
      token,
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/login
 *
 * Accepts { email, password } in the request body.
 * - Looks up the user by email in PostgreSQL.
 * - Verifies the password with bcrypt.
 * - Returns a signed JWT on success.
 * - Returns 401 Unauthorized on any credential mismatch.
 */
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // ── Input validation ───────────────────────────────────────────────────
    if (!email || !password) {
      return res.status(400).json({
        status: 400,
        error: "Bad Request",
        message: "Email and password are required",
      });
    }

    // ── Look up user ───────────────────────────────────────────────────────
    const result = await query(
      "SELECT id, email, password_hash, two_factor_enabled, two_factor_secret FROM users WHERE email = $1",
      [email]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({
        status: 401,
        error: "Unauthorized",
        message: "Invalid email or password",
      });
    }

    // ── Verify password ────────────────────────────────────────────────────
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({
        status: 401,
        error: "Unauthorized",
        message: "Invalid email or password",
      });
    }

    // ── Check if 2FA is enabled ────────────────────────────────────────────
    if (user.two_factor_enabled && user.two_factor_secret) {
      return res.json({
        status: 200,
        requires2FA: true,
        userId: user.id,
        message: "Two-factor authentication required",
      });
    }

    // ── Guard: secret not configured ─────────────────────────────────────
    if (!JWT_SECRET) {
      const error = new Error("JWT_SECRET is not configured on the server");
      error.name = "Internal Server Error";
      error.status = 500;
      return next(error);
    }

    // ── Generate JWT ───────────────────────────────────────────────────────
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.json({
      status: 200,
      message: "Login successful",
      token,
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/2fa/generate
 *
 * Generates a two-factor secret and QR code for the authenticated user.
 * Protected by JWT.
 */
router.post("/2fa/generate", authenticate, async (req, res, next) => {
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

    // Save temporary secret (secret.base32) to the user's row
    await query(
      "UPDATE users SET two_factor_secret = $1, two_factor_enabled = false WHERE id = $2",
      [secret.base32, userId]
    );

    // Generate QR Code URL
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    return res.json({
      success: true,
      secret: secret.base32,
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
router.post("/2fa/enable", authenticate, async (req, res, next) => {
  try {
    const { token } = req.body;
    const userId = req.user.id;

    if (!token) {
      return res.status(400).json({ success: false, message: "Token is required" });
    }

    // Look up the secret
    const userResult = await query(
      "SELECT two_factor_secret FROM users WHERE id = $1",
      [userId]
    );
    const user = userResult.rows[0];

    if (!user || !user.two_factor_secret) {
      return res.status(400).json({
        success: false,
        message: "Two-factor authentication has not been generated for this user",
      });
    }

    // Verify token
    const verified = speakeasy.totp.verify({
      secret: user.two_factor_secret,
      encoding: "base32",
      token,
    });

    if (!verified) {
      return res.status(400).json({
        success: false,
        message: "Invalid authenticator code. Please try again.",
      });
    }

    // Enable 2FA in DB
    await query(
      "UPDATE users SET two_factor_enabled = true WHERE id = $1",
      [userId]
    );

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
router.post("/login/verify", async (req, res, next) => {
  try {
    const { userId, token } = req.body;

    if (!userId || !token) {
      return res.status(400).json({
        status: 400,
        error: "Bad Request",
        message: "userId and 2FA token are required",
      });
    }

    // Look up the user
    const result = await query(
      "SELECT id, email, password_hash, two_factor_secret, two_factor_enabled FROM users WHERE id = $1",
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

    // Verify token
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

    // Generate JWT
    if (!JWT_SECRET) {
      const error = new Error("JWT_SECRET is not configured on the server");
      error.name = "Internal Server Error";
      error.status = 500;
      return next(error);
    }

    const jwtToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
      },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    return res.json({
      status: 200,
      message: "Login successful",
      token: jwtToken,
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (err) {
    next(err);
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   Guest Session — Ignition Route
   ═══════════════════════════════════════════════════════════════════════════ */

function calculateLeadScore(payload) {
  let score = 50;
  // Safely extract values regardless of nested GHL structures
  const email = (payload.email || payload.Email || "").toLowerCase();
  const phone = payload.phone || payload.Phone || "";
  const company = payload.companyName || payload.company || "";
  const firstName = (payload.first_name || payload.firstName || "").toLowerCase();

  if (email.endsWith("@gmail.com") || email.endsWith("@yahoo.com") || email.endsWith("@hotmail.com")) {
    score -= 15;
  } else if (email.includes("@")) {
    score += 25; // Business domain
  }

  if (phone.length > 7) score += 15;
  if (company.length > 2) score += 10;
  if (firstName.includes("test") || firstName === "") score -= 30;

  return Math.max(0, Math.min(100, score));
}

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
router.post("/guest", async (req, res, next) => {
  try {
    const { first_name, last_name, email } = req.body;

    // ── Input validation ───────────────────────────────────────────────────
    if (!first_name || !last_name || !email) {
      return res.status(400).json({
        status: 400,
        error: "Bad Request",
        message: "first_name, last_name, and email are required",
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
        status: 400,
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
        status: 404,
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

export default router;
