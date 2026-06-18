import jwt from "jsonwebtoken";
import redisClient from "../utils/redisClient.js";

const JWT_SECRET = process.env.JWT_SECRET;

export default async function authenticate(req, _res, next) {
  const token = req.cookies?.jwt || (req.headers.authorization?.startsWith('Bearer ') && req.headers.authorization.split(' ')[1]);

  // ── Missing token ──────────────────────────────────────────────────────
  if (!token) {
    const error = new Error("Authentication required — no token provided");
    error.name = "Unauthorized";
    error.status = 401;
    return next(error);
  }

  // ── Guard: secret not configured ───────────────────────────────────────
  if (!JWT_SECRET) {
    const error = new Error("JWT_SECRET is not configured on the server");
    error.name = "Internal Server Error";
    error.status = 500;
    return next(error);
  }

  // ── Verify token ───────────────────────────────────────────────────────
  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // ── Blacklist check ────────────────────────────────────────────────
    let revoked = null;
    try {
      revoked = await redisClient.get('blacklist:' + token);
    } catch (redisErr) {
      console.warn('[auth] Redis blacklist unavailable, proceeding without revocation check:', redisErr.message);
    }
    if (revoked) {
      const error = new Error("Token has been revoked");
      error.name = "Unauthorized";
      error.status = 401;
      return next(error);
    }

    req.user = decoded;
    next();
  } catch (err) {
    const error = new Error(
      err.name === "TokenExpiredError"
        ? "Token has expired"
        : "Token is invalid",
    );
    error.name = "Unauthorized";
    error.status = 401;
    next(error);
  }
}
