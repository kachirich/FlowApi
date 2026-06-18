import { query } from "../db/connection.js";

/**
 * Request-logging middleware.
 *
 * Captures the client's IP address, HTTP method, request path, and the
 * eventual response status code, then persists the record to the
 * `request_logs` table in PostgreSQL.
 *
 * Logging is non-blocking — a failed INSERT will NOT reject the client
 * request; the error is written to stderr instead.
 */
export default function requestLogger(req, res, next) {
  // Hook into the response "finish" event so we can capture the status code
  // after the route handler has run.
  res.on("finish", () => {
    // Use req.ip — Express resolves this correctly per the trust proxy setting.
    // Reading X-Forwarded-For directly allows spoofed IPs to poison the log.
    const ip = req.ip || '127.0.0.1';

    query(
      `INSERT INTO request_logs (ip_address, method, path, status_code)
       VALUES ($1, $2, $3, $4)`,
      [ip, req.method, req.originalUrl, res.statusCode],
    ).catch((err) => {
      console.error("[requestLogger] Failed to log request:", err.message);
    });
  });

  next();
}
