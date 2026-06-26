import jwt from "jsonwebtoken";
import speakeasy from "speakeasy";
import { query } from "../db/connection.js";

/**
 * Step-up authentication for sensitive actions (API-key / webhook-key creation,
 * key revocation). Must run AFTER `authenticate` (needs req.user.id) and BEFORE
 * any body-replacing validator, since it reads `totpToken` off the raw body.
 *
 * Passes when the request carries a valid `x-trusted-device-token` for this
 * user (minted by a prior step-up within 72h); otherwise it requires the user
 * to have 2FA enabled and to supply a valid TOTP code (`totpToken` in the body
 * or `totptoken` header). On success it mints a fresh 72h trusted-device token
 * at `res.locals.trustedDeviceToken` for the handler to return so the client
 * can skip the OTP next time.
 *
 * This centralises the pattern that was previously hand-rolled (and applied
 * inconsistently) across admin.js — most importantly, it closes the gap where
 * POST /api/keys accepted a `totpToken` from the UI but never verified it.
 */
export default async function stepUpAuth(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const trustedToken = req.headers["x-trusted-device-token"];
    let deviceTrusted = false;
    if (trustedToken) {
      try {
        const decoded = jwt.verify(trustedToken, process.env.JWT_SECRET);
        if (decoded?.userId === userId) deviceTrusted = true;
      } catch {
        // invalid/expired trusted-device token → fall through to OTP
      }
    }

    if (!deviceTrusted) {
      const totpToken = req.body?.totpToken || req.headers.totptoken;

      const { rows } = await query(
        "SELECT two_factor_secret, two_factor_enabled FROM user_auth WHERE user_id = $1",
        [userId]
      );
      const user = rows[0];
      if (!user || !user.two_factor_enabled || !user.two_factor_secret) {
        return res.status(403).json({
          success: false,
          error: "Two-factor authentication must be enabled for this action",
        });
      }
      if (!totpToken) {
        return res.status(401).json({ success: false, error: "Unauthorized: 2FA code required" });
      }

      const verified = speakeasy.totp.verify({
        secret: user.two_factor_secret,
        encoding: "base32",
        token: totpToken,
      });
      if (!verified) {
        return res.status(401).json({ success: false, error: "Invalid authenticator code" });
      }
    }

    // Mint a fresh trusted-device token for the handler to return.
    res.locals.trustedDeviceToken = jwt.sign({ userId }, process.env.JWT_SECRET, {
      expiresIn: "72h",
    });
    next();
  } catch (err) {
    next(err);
  }
}
