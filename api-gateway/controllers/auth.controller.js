import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { sendTokenResponse } from '../utils/authUtils.js';
import { redisClient } from '../middleware/rateLimiter.js';

// TTL for the one-time password-reset proof token stored in Redis (10 minutes).
const RESET_TOKEN_TTL = 600;
import { sendEmailVerification } from '../services/email.service.js';
import jwt from 'jsonwebtoken';
import { query } from '../db/connection.js';
import blocklist from 'disposable-email-blocklist';
import { enqueueNotification, NOTIFICATION_TYPES, DAY_MS } from '../services/notifications.js';

const normalizeEmail = (rawEmail) => {
  if (!rawEmail || typeof rawEmail !== 'string') return rawEmail;
  let email = rawEmail.trim().toLowerCase();
  const [localPart, domain] = email.split('@');
  if (!domain) return email;

  const plusIndex = localPart.indexOf('+');
  const cleanLocal = plusIndex !== -1 ? localPart.substring(0, plusIndex) : localPart;

  return `${cleanLocal}@${domain}`;
};

export const sendOtp = async (req, res) => {
  try {
    const rawEmail = req.body.email;

    if (!rawEmail) {
      return res.status(400).json({ error: 'Email is required' });
    }

    if (!rawEmail.includes('@')) {
      return res.status(400).json({ error: 'Invalid email address format' });
    }

    const email = normalizeEmail(rawEmail);
    const domain = email.split('@')[1];

    if (blocklist.includes(domain)) {
      return res.status(400).json({ error: 'Please use a permanent email address' });
    }

    // Check if existing user has verified OTP within the last 7 days — skip OTP if so
    const recentVerify = await query(
      `SELECT u.id, u.email, u.first_name, u.last_name
       FROM users u
       JOIN user_auth ua ON ua.user_id = u.id
       WHERE u.email = $1 AND ua.last_otp_verified_at > NOW() - INTERVAL '7 days'`,
      [email]
    );

    if (recentVerify.rows.length > 0) {
      const user = recentVerify.rows[0];
      return sendTokenResponse(user, 200, res, 'Signed in successfully');
    }

    // Clear any previous OTPs for this email
    await query("DELETE FROM otps WHERE email = $1", [email]);

    // Generate a cryptographically secure 6-digit OTP
    const code = crypto.randomInt(100000, 1000000).toString();
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');

    // Store hashed code — never persist the raw OTP
    await query(
      "INSERT INTO otps (email, code_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL '10 minutes')",
      [email, codeHash]
    );

    // Send email via Nodemailer
    await sendEmailVerification(email, code, 'login');

    return res.status(200).json({ success: true, status: 'pending' });
  } catch (error) {
    console.error('Error sending OTP:', error);
    return res.status(500).json({ error: 'Failed to send OTP' });
  }
};

export const sendStepUpOtp = async (req, res) => {
  try {
    const email = req.user.email; // Extracted from JWT token via authenticate middleware

    if (!email) {
      return res.status(401).json({ error: 'Unauthorized: No email attached to token' });
    }

    const trustedToken = req.headers['x-trusted-device-token'];
    if (trustedToken) {
      try {
        const decoded = jwt.verify(trustedToken, process.env.JWT_SECRET);
        if (decoded && decoded.userId === req.user.id) {
          return res.status(200).json({ success: true, bypassed: true });
        }
      } catch (err) {
        // Token invalid/expired, ignore and send OTP
      }
    }

    // Generate a cryptographically secure 6-digit OTP
    const code = crypto.randomInt(100000, 1000000).toString();
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');

    // Clear any previous OTPs for this email to prevent spam/clutter
    await query("DELETE FROM otps WHERE email = $1", [email]);

    // Store hashed code — never persist the raw OTP (tighter 5-minute window for step-up)
    await query(
      "INSERT INTO otps (email, code_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL '5 minutes')",
      [email, codeHash]
    );

    // Send email via Nodemailer
    await sendEmailVerification(email, code, 'login');

    return res.status(200).json({ success: true, message: 'OTP Sent' });
  } catch (error) {
    console.error('Error sending Step-Up OTP:', error);
    return res.status(500).json({ error: 'Failed to send OTP' });
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const rawEmail = req.body.email;
    const { code } = req.body;

    if (!rawEmail || !code) {
      return res.status(400).json({ error: 'Email and code are required' });
    }

    const email = normalizeEmail(rawEmail);

    // Calculate current time in Node.js to avoid PostgreSQL timezone mismatches
    const currentTime = new Date();

    // Hash the user-supplied code and compare against the stored hash
    const inputHash = crypto.createHash('sha256').update(code).digest('hex');

    // Strict dual-check with expiration
    const otpResult = await query(
      "SELECT id FROM otps WHERE email = $1 AND code_hash = $2 AND expires_at > $3",
      [email, inputHash, currentTime]
    );

    if (otpResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired OTP' });
    }

    // OTP verified successfully, immediately destroy it to prevent reuse
    // Delete by id (not by email) to close the race condition where two
    // concurrent verify requests both pass the SELECT before either DELETEs.
    await query("DELETE FROM otps WHERE id = $1", [otpResult.rows[0].id]);

    // Upsert User
    let userResult = await query("SELECT id, email, first_name, last_name FROM users WHERE email = $1", [email]);
    let user;

    if (userResult.rows.length > 0) {
      user = userResult.rows[0];
      // Update OTP verification timestamp
      await query("UPDATE user_auth SET last_otp_verified_at = NOW() WHERE user_id = $1", [user.id]);
    } else {
      // Insert new passwordless user — trigger auto-creates satellite rows
      const insertResult = await query(
        "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email",
        [email, "PASSWORDLESS_ACCOUNT"]
      );
      user = insertResult.rows[0];

      // Set passwordless + OTP timestamp on the auto-created user_auth row
      await query(
        "UPDATE user_auth SET is_passwordless = TRUE, last_otp_verified_at = NOW() WHERE user_id = $1",
        [user.id]
      );

      // Schedule onboarding drip (day 0 immediately, day 3, day 7)
      const newUserId = user.id;
      Promise.all([
        enqueueNotification(newUserId, NOTIFICATION_TYPES.ONBOARDING, { day: 0 }),
        enqueueNotification(newUserId, NOTIFICATION_TYPES.ONBOARDING, { day: 3 }, { delay: 3 * DAY_MS }),
        enqueueNotification(newUserId, NOTIFICATION_TYPES.ONBOARDING, { day: 7 }, { delay: 7 * DAY_MS }),
      ]).catch(err => console.error('[auth] Onboarding drip schedule failed:', err.message));
    }

    return sendTokenResponse(user, 200, res, 'OTP verified successfully');
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return res.status(400).json({ error: error.message });
  }
};

export const register = async (req, res) => {
  try {
    const { password, firstName, lastName } = req.body;
    const rawEmail = req.body.email;

    if (!rawEmail || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const email = normalizeEmail(rawEmail);
    const domain = email.split('@')[1];

    if (blocklist.includes(domain)) {
      return res.status(400).json({ error: 'Please use a permanent email address' });
    }

    // Strict Password Policy Enforcement
    const passwordRegex = /^(?=.*[0-9])(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters long, contain at least one number, and one special character.'
      });
    }

    // Check if user exists
    const existingUser = await query("SELECT id FROM users WHERE email = $1", [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Generate avatar
    const profilePic = `https://ui-avatars.com/api/?name=${encodeURIComponent(firstName)}+${encodeURIComponent(lastName)}&background=random`;

    // Insert user
    const insertResult = await query(
      "INSERT INTO users (email, password_hash, first_name, last_name, profile_pic) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, first_name, last_name, profile_pic",
      [email, passwordHash, firstName, lastName, profilePic]
    );

    const user = insertResult.rows[0];

    const newUserId = user.id;
    Promise.all([
      enqueueNotification(newUserId, NOTIFICATION_TYPES.ONBOARDING, { day: 0 }),
      enqueueNotification(newUserId, NOTIFICATION_TYPES.ONBOARDING, { day: 3 }, { delay: 3 * DAY_MS }),
      enqueueNotification(newUserId, NOTIFICATION_TYPES.ONBOARDING, { day: 7 }, { delay: 7 * DAY_MS }),
    ]).catch(err => console.error('[auth] Onboarding drip failed:', err.message));

    return sendTokenResponse(user, 201, res, 'Account created successfully');
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Failed to create account' });
  }
};

export const login = async (req, res) => {
  try {
    const { password } = req.body;
    const rawEmail = req.body.email;

    if (!rawEmail || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const email = normalizeEmail(rawEmail);

    const userResult = await query(
      `SELECT u.id, u.email, u.password_hash, u.first_name, u.last_name, u.profile_pic,
              ua.two_factor_enabled, ua.two_factor_secret, ua.is_passwordless
       FROM users u
       JOIN user_auth ua ON ua.user_id = u.id
       WHERE u.email = $1`,
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];

    // Check passwordless sentinel
    if (user.is_passwordless) {
       return res.status(401).json({ error: 'Please sign in with Google or Email OTP' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // 2FA challenge — do not issue JWT yet
    if (user.two_factor_enabled) {
      const challengeToken = crypto.randomUUID();
      await redisClient.setex(`2fa_challenge:${challengeToken}`, 300, user.id);
      return res.status(200).json({ requires_2fa: true, challenge_token: challengeToken });
    }

    return sendTokenResponse(user, 200, res, 'Logged in successfully');
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Failed to authenticate' });
  }
};

// ── Verify Reset OTP (Step 2) ──────────────────────────────────────────────
// Consumes the OTP immediately on success and mints a short-lived Redis proof
// token. Step 3 (resetPassword) checks this token — not the OTP — so a
// replayed OTP cannot be used to reset the password a second time.
export const verifyResetOtp = async (req, res) => {
  try {
    const rawEmail = req.body.email;
    const code = req.body.code || req.body.otp;

    if (!rawEmail || !code) {
      return res.status(400).json({ error: 'Email and code are required' });
    }

    const email = normalizeEmail(rawEmail);
    const currentTime = new Date();

    const inputHash = crypto.createHash('sha256').update(code).digest('hex');
    const otpResult = await query(
      "SELECT id FROM otps WHERE email = $1 AND code_hash = $2 AND expires_at > $3",
      [email, inputHash, currentTime]
    );

    if (otpResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset code' });
    }

    // Consume the OTP immediately — prevent any replay.
    await query("DELETE FROM otps WHERE email = $1", [email]);

    // Mint a single-use proof token valid for RESET_TOKEN_TTL seconds.
    const resetToken = crypto.randomBytes(32).toString('hex');
    await redisClient.setex(`pwd_reset:${email}`, RESET_TOKEN_TTL, resetToken);

    return res.status(200).json({ success: true, message: 'Code verified', reset_token: resetToken });
  } catch (error) {
    console.error('Verify reset OTP error:', error);
    return res.status(500).json({ error: 'Failed to verify code' });
  }
};

// ── Forgot Password ───────────────────────────────────────────────────────
export const forgotPassword = async (req, res) => {
  try {
    const rawEmail = req.body.email;

    if (!rawEmail) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const email = normalizeEmail(rawEmail);

    // Always return success to prevent email enumeration attacks
    const userResult = await query("SELECT id FROM users WHERE email = $1", [email]);

    if (userResult.rows.length > 0) {
      // Generate a cryptographically secure 6-digit OTP
      const code = crypto.randomInt(100000, 1000000).toString();
      const codeHash = crypto.createHash('sha256').update(code).digest('hex');

      // Clear any previous OTPs for this email
      await query("DELETE FROM otps WHERE email = $1", [email]);

      // Store hashed code — never persist the raw OTP
      await query(
        "INSERT INTO otps (email, code_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL '10 minutes')",
        [email, codeHash]
      );

      // Dispatch via email service
      await sendEmailVerification(email, code, 'reset');
    }

    // Generic success message regardless of whether user exists
    return res.status(200).json({
      success: true,
      message: 'If an account exists with that email, a reset code has been sent.'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ error: 'Failed to process request' });
  }
};

// ── Reset Password ────────────────────────────────────────────────────────
export const resetPassword = async (req, res) => {
  try {
    const { newPassword, reset_token } = req.body;
    const rawEmail = req.body.email;

    if (!rawEmail || !reset_token || !newPassword) {
      return res.status(400).json({ error: 'Email, reset_token, and new password are required' });
    }

    const email = normalizeEmail(rawEmail);

    // Strict Password Policy Enforcement
    const passwordRegex = /^(?=.*[0-9])(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters long, contain at least one number, and one special character.'
      });
    }

    // Verify the single-use Redis proof token issued by verifyResetOtp.
    const storedToken = await redisClient.get(`pwd_reset:${email}`);
    if (!storedToken || storedToken !== reset_token) {
      return res.status(401).json({ error: 'Invalid or expired reset session. Please restart the password reset flow.' });
    }

    // Consume the proof token immediately — single-use.
    await redisClient.del(`pwd_reset:${email}`);

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update user's password
    const updateResult = await query("UPDATE users SET password_hash = $1 WHERE email = $2", [passwordHash, email]);

    if (updateResult.rowCount === 0) {
      return res.status(400).json({ error: 'User not found or password not updated' });
    }

    return res.status(200).json({ success: true, message: 'Password reset successfully. You can now sign in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ error: 'Failed to reset password' });
  }
};
