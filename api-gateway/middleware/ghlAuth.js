import bcrypt from "bcrypt";
import { query } from "../db/connection.js";

export default async function ghlAuthenticate(req, res, next) {
  // Accept key from header OR query parameter (generated URLs use ?x-api-key=)
  const incomingKey = req.headers["x-api-key"] || req.query["x-api-key"];

  if (!incomingKey) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized: Missing API key",
    });
  }

  // Check against dynamically generated keys in the database using bcrypt
  try {
    const result = await query("SELECT id, api_key, masked_key, target_url, http_method, user_id FROM webhook_keys");
    
    for (const row of result.rows) {
      const isMatch = await bcrypt.compare(incomingKey, row.api_key);
      if (isMatch) {
        // Attach the webhook key metadata to the request for downstream use
        req.webhookKey = {
          id: row.id,
          maskedKey: row.masked_key,
          targetUrl: row.target_url,
          httpMethod: row.http_method,
          userId: row.user_id
        };
        return next();
      }
    }
  } catch (err) {
    console.error("[auth] Error validating webhook key against DB:", err.message);
  }

  return res.status(401).json({
    success: false,
    message: "Unauthorized: Invalid API key",
  });
}
