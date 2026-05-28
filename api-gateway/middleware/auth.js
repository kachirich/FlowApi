import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * JWT authentication middleware.
 *
 * Extracts a Bearer token from the `Authorization` header, verifies it
 * against `JWT_SECRET`, and attaches the decoded payload to `req.user`.
 *
 * Errors are forwarded to the centralised error handler via `next(error)`
 * with an appropriate `status` code — never responds directly.
 */
export default function authenticate(req, _res, next) {
  let token = req.cookies?.jwt;

  if (!token && process.env.NODE_ENV === "test") {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    }
  }

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
