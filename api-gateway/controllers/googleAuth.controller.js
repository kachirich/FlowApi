import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { redisClient } from '../middleware/rateLimiter.js';
import { query } from '../db/connection.js';
import { generateAuthCookie } from '../utils/authUtils.js';

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

    const givenName  = payload.given_name  || null;
    const familyName = payload.family_name || null;
    const picture    = payload.picture     || null;

    // Upsert User
    let userResult = await query(
      "SELECT id, email, first_name, last_name, profile_pic FROM users WHERE email = $1",
      [email]
    );
    let user;

    if (userResult.rows.length > 0) {
      user = userResult.rows[0];

      // Backfill name/picture for accounts created before these fields existed.
      if (user.first_name === null) {
        await query(
          `UPDATE users SET first_name = $2, last_name = $3, profile_pic = $4
           WHERE id = $1 AND first_name IS NULL`,
          [user.id, givenName, familyName, picture]
        );
        user.first_name = givenName;
        user.last_name = familyName;
        user.profile_pic = picture;
      }
    } else {
      // Insert new user. is_passwordless lives in user_auth (migration 002 split
      // it out of users); the fn_create_user_satellites trigger auto-creates the
      // user_auth row on INSERT, then we flip is_passwordless to TRUE.
      const insertResult = await query(
        `INSERT INTO users (email, password_hash, first_name, last_name, profile_pic)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, email, first_name, last_name, profile_pic`,
        [email, "PASSWORDLESS_ACCOUNT", givenName, familyName, picture]
      );
      user = insertResult.rows[0];

      await query(
        `UPDATE user_auth SET is_passwordless = TRUE WHERE user_id = $1`,
        [user.id]
      );
    }

    generateAuthCookie(user, res);

    // Redirect back to frontend
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
    return res.redirect(`${FRONTEND_URL}/dashboard`);
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
