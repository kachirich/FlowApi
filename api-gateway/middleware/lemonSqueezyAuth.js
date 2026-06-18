import crypto from "crypto";

export default function lemonSqueezyAuth(req, res, next) {
  const secret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
  const signature = req.headers['x-signature'];

  if (!signature || !secret) {
    return res.status(401).json({ error: "Unauthorized: Missing signature or secret" });
  }

  try {
    const hmac = crypto.createHmac('sha256', secret);
    const digest = Buffer.from(hmac.update(req.body).digest('hex'), 'utf8');
    const signatureBuffer = Buffer.from(signature, 'utf8');

    if (digest.length !== signatureBuffer.length || !crypto.timingSafeEqual(digest, signatureBuffer)) {
      return res.status(401).json({ error: "Unauthorized: Invalid signature" });
    }
    
    next();
  } catch (error) {
    console.error("[LemonSqueezy Auth] Error:", error);
    return res.status(401).json({ error: "Unauthorized: Signature verification failed" });
  }
}
