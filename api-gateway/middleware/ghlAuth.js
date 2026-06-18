import crypto from "crypto";
import { query } from "../db/connection.js";

/**
 * ghlAuthenticate — validates the x-api-key header against webhook_keys.
 *
 * Uses a constant-time SHA-256 hash lookup (O(1)) instead of iterating every
 * row with bcrypt.compare (O(n)). Requires the api_key_hash column added by
 * migration 011_webhook_key_hash.sql.
 *
 * NOTE: Only accepts the key from the x-api-key request header. Query-string
 * delivery (?x-api-key=...) is intentionally dropped — query strings appear in
 * server access logs and browser history.
 */
export default async function ghlAuthenticate(req, res, next) {
  const incomingKey = req.headers["x-api-key"];

  if (!incomingKey || typeof incomingKey !== "string" || !incomingKey.trim()) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized: Missing API key",
    });
  }

  try {
    const keyHash = crypto.createHash("sha256").update(incomingKey.trim()).digest("hex");

    const result = await query(
      `SELECT id, masked_key, target_url, http_method, user_id
         FROM webhook_keys
        WHERE api_key_hash = $1`,
      [keyHash]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Invalid API key",
      });
    }

    const row = result.rows[0];
    req.webhookKey = {
      id: row.id,
      maskedKey: row.masked_key,
      targetUrl: row.target_url,
      httpMethod: row.http_method,
      userId: row.user_id,
    };

    return next();
  } catch (err) {
    console.error("[ghlAuth] Error validating webhook key:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}
