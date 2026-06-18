import crypto from "crypto";

/**
 * Generate a cryptographically secure, random 32-character hex API key.
 *
 * Uses Node's built-in `crypto.randomBytes` for 128 bits of entropy,
 * encoded as a lowercase hex string (32 chars).
 *
 * @returns {string} A 32-character hexadecimal API key.
 */
export function generateApiKey() {
  return crypto.randomBytes(16).toString("hex");
}
