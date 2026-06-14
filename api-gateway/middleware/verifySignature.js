import crypto from 'crypto';

/**
 * verifySignature — optional HMAC-SHA256 request signing.
 *
 * Runs AFTER apiKeyAuth so req.user carries { require_signature, signing_secret }.
 * Opt-in per key: when require_signature !== true this is a no-op.
 *
 * When enabled, the client must send:
 *   x-flowapi-timestamp : unix epoch milliseconds
 *   x-flowapi-signature : hex( HMAC-SHA256(signing_secret, `${timestamp}.${rawBody}`) )
 *
 * The raw request body is captured by the json `verify` hook in app.js
 * (req.rawBody). Replay attacks are mitigated by rejecting timestamps older
 * than 5 minutes; the comparison is constant-time.
 */
const MAX_SKEW_MS = 5 * 60 * 1000; // 5 minutes

function reject(res, message) {
  return res.status(401).json({ success: false, message });
}

export const verifySignature = (req, res, next) => {
  // Opt-in only — unsigned keys behave exactly as before.
  if (req.user?.require_signature !== true) return next();

  const signature = req.headers['x-flowapi-signature'];
  const timestamp = req.headers['x-flowapi-timestamp'];

  if (!signature || !timestamp) {
    return reject(res, 'Signature required');
  }

  // Replay protection — reject stale or unparseable timestamps.
  const ageMs = Math.abs(Date.now() - parseInt(timestamp, 10));
  if (Number.isNaN(ageMs) || ageMs > MAX_SKEW_MS) {
    return reject(res, 'Stale timestamp');
  }

  const secret = req.user.signing_secret;
  if (!secret) {
    // require_signature is on but the secret is missing — fail closed.
    return reject(res, 'Signature verification unavailable');
  }

  const rawBody = req.rawBody ?? '';
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

  const expectedBuf = Buffer.from(expected, 'utf8');
  const providedBuf = Buffer.from(String(signature), 'utf8');

  if (
    expectedBuf.length !== providedBuf.length ||
    !crypto.timingSafeEqual(expectedBuf, providedBuf)
  ) {
    return reject(res, 'Invalid signature');
  }

  next();
};

export default verifySignature;
