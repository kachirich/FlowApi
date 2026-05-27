import bcrypt from 'bcrypt';
import { redisClient } from '../middleware/rateLimiter.js';
import { sendEmailVerification } from '../services/email.service.js';
import jwt from 'jsonwebtoken';
import { query } from '../db/connection.js';
import blocklist from 'disposable-email-blocklist';

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

    // Generate a 6-digit numeric OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Store in PostgreSQL with 10 minute expiration
    await query(
      "INSERT INTO otps (email, code, expires_at) VALUES ($1, $2, NOW() + INTERVAL '10 minutes')",
      [email, code]
    );

    // Send email via Nodemailer
    await sendEmailVerification(email, code, 'login');

    return res.status(200).json({ success: true, status: 'pending' });
  } catch (error) {
    console.error('Error sending OTP:', error);
    return res.status(400).json({ error: error.message });
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

    // Generate a 6-digit numeric OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Clear any previous OTPs for this email to prevent spam/clutter
    await query("DELETE FROM otps WHERE email = $1", [email]);

    // Store in PostgreSQL with 5 minute expiration (tighter window for step-up)
    await query(
      "INSERT INTO otps (email, code, expires_at) VALUES ($1, $2, NOW() + INTERVAL '5 minutes')",
      [email, code]
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

    // Strict Dual-Check with expiration
    const otpResult = await query(
      "SELECT id FROM otps WHERE email = $1 AND code = $2 AND expires_at > $3",
      [email, code, currentTime]
    );

    if (otpResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired OTP' });
    }

    // OTP verified successfully, immediately destroy it to prevent reuse
    await query("DELETE FROM otps WHERE email = $1", [email]);

    // Upsert User
    let userResult = await query("SELECT id, email, first_name, last_name FROM users WHERE email = $1", [email]);
    let user;

    if (userResult.rows.length > 0) {
      user = userResult.rows[0];
    } else {
      // Insert new user with dummy password_hash (passwordless account)
      const insertResult = await query(
        "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email",
        [email, "PASSWORDLESS_ACCOUNT"]
      );
      user = insertResult.rows[0];
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is missing from process.env!");
      return res.status(500).json({ error: "Server misconfiguration: missing JWT secret" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    return res.status(200).json({ success: true, message: 'OTP verified successfully', token, user });
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

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is missing from process.env!");
      return res.status(500).json({ error: "Server misconfiguration: missing JWT secret" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    return res.status(201).json({ success: true, message: 'Account created successfully', token, user });
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

    const userResult = await query("SELECT id, email, password_hash, first_name, last_name, profile_pic FROM users WHERE email = $1", [email]);
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];

    // Check passwordless bypass
    if (user.password_hash === 'PASSWORDLESS_ACCOUNT') {
       return res.status(401).json({ error: 'Please sign in with Google or Email OTP' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is missing from process.env!");
      return res.status(500).json({ error: "Server misconfiguration: missing JWT secret" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    // Filter sensitive info
    delete user.password_hash;

    return res.status(200).json({ success: true, message: 'Logged in successfully', token, user });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Failed to authenticate' });
  }
};

// ── Verify Reset OTP (Step 2 — non-destructive check) ─────────────────────
export const verifyResetOtp = async (req, res) => {
  try {
    const rawEmail = req.body.email;
    const code = req.body.code || req.body.otp;

    if (!rawEmail || !code) {
      return res.status(400).json({ error: 'Email and code are required' });
    }

    const email = normalizeEmail(rawEmail);
    const currentTime = new Date();

    const otpResult = await query(
      "SELECT id FROM otps WHERE email = $1 AND code = $2 AND expires_at > $3",
      [email, code, currentTime]
    );

    if (otpResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset code' });
    }

    // OTP is valid — do NOT delete it yet. Step 3 will consume it.
    return res.status(200).json({ success: true, message: 'Code verified' });
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
      // Generate a 6-digit OTP
      const code = Math.floor(100000 + Math.random() * 900000).toString();

      // Clear any previous OTPs for this email
      await query("DELETE FROM otps WHERE email = $1", [email]);

      // Store in PostgreSQL with 10 minute expiration
      await query(
        "INSERT INTO otps (email, code, expires_at) VALUES ($1, $2, NOW() + INTERVAL '10 minutes')",
        [email, code]
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
    const { newPassword } = req.body;
    const code = req.body.code || req.body.otp;
    const rawEmail = req.body.email;

    if (!rawEmail || !code || !newPassword) {
      return res.status(400).json({ error: 'Email, code, and new password are required' });
    }

    const email = normalizeEmail(rawEmail);

    // Strict Password Policy Enforcement
    const passwordRegex = /^(?=.*[0-9])(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters long, contain at least one number, and one special character.'
      });
    }

    // Verify OTP with strict dual-check and expiration
    const currentTime = new Date();
    const otpResult = await query(
      "SELECT id FROM otps WHERE email = $1 AND code = $2 AND expires_at > $3",
      [email, code, currentTime]
    );

    if (otpResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired reset code' });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update user's password
    const updateResult = await query("UPDATE users SET password_hash = $1 WHERE email = $2", [passwordHash, email]);

    if (updateResult.rowCount === 0) {
      return res.status(400).json({ error: 'User not found or password not updated' });
    }

    // Immediately destroy the OTP
    await query("DELETE FROM otps WHERE email = $1", [email]);

    return res.status(200).json({ success: true, message: 'Password reset successfully. You can now sign in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ error: 'Failed to reset password' });
  }
};
