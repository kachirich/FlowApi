import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { redisClient } from '../middleware/rateLimiter.js';
import { query } from '../db/connection.js';

/**
 * Creates a NEW OAuth2Client instance per invocation.
 *
 * ⚠️  CRITICAL — This must NOT be cached in a module-level singleton because
 *    `setCredentials()` mutates the instance.  A shared client causes
 *    concurrent requests to overwrite each other's tokens (global state
 *    pollution → User A receives User B's identity).
 */
const createOAuth2Client = () =>
  new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback'
  );


export const googleLogin = async (req, res) => {
  try {
    const oAuth2Client = createOAuth2Client();
    const authorizeUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['email', 'profile'],
    });
    res.redirect(authorizeUrl);
  } catch (error) {
    console.error('Google login error:', error);
    res.status(500).json({ error: 'Failed to generate Google Auth URL' });
  }
};

export const googleCallback = async (req, res) => {
  try {
    const code = req.query.code;
    if (!code) {
      return res.status(400).send('Authorization code missing');
    }

    // ── Per-request client — never shared across concurrent callbacks ────
    const oAuth2Client = createOAuth2Client();
    const { tokens } = await oAuth2Client.getToken(code);

    // Verify the ID token to get user info — no setCredentials() needed;
    // verifyIdToken only requires the raw id_token string.
    const ticket = await oAuth2Client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    
    if (!payload || !payload.email) {
      return res.status(400).send('Failed to fetch user email from Google');
    }

    const email = payload.email;

    // Upsert User
    let userResult = await query("SELECT id, email FROM users WHERE email = $1", [email]);
    let user;

    if (userResult.rows.length > 0) {
      user = userResult.rows[0];
    } else {
      // Insert new user with dummy password_hash
      const insertResult = await query(
        "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email",
        [email, "PASSWORDLESS_ACCOUNT"]
      );
      user = insertResult.rows[0];
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is missing from process.env!");
      return res.status(500).send('Server misconfiguration: missing JWT secret');
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.cookie('jwt', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    });

    // Redirect back to frontend
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
    return res.redirect(`${FRONTEND_URL}/login`);
  } catch (error) {
    console.error('Google callback error:', error);
    res.status(500).send('Authentication failed');
  }
};

export const logout = async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(400).json({ error: 'Bad Request: Missing token' });
  }

  const token = authHeader.split(' ')[1];

  try {
    await redisClient.setEx(`blacklist:${token}`, 604800, 'revoked');
    return res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ error: 'Failed to process logout' });
  }
};
