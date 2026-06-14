/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  FlowAPI — HMAC Signatures + x-api-key Header Test Suite
 *
 *  Covers:
 *    1. require_signature=false → works without signature headers
 *    2. require_signature=true  + no signature → 401
 *    3. require_signature=true  + valid signature → 200
 *    4. tampered body with the old (now-wrong) signature → 401
 *    5. stale timestamp (>5 min) → 401
 *    6. x-api-key header (not Bearer) authenticates → 200
 *
 *  Requires live PostgreSQL + Redis (repo convention). No outbound HTTP is
 *  triggered: keys route to zero destinations, so dispatch short-circuits.
 *  Each scenario uses its own API key so the 1h edge cache never collides.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import crypto from "crypto";

import app from "../app.js";
import { query, closePool, initializeDatabase } from "../db/connection.js";

const PW_HASH = "$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012";
const EMAIL = `sig_test_${Date.now()}@flowapi-test.dev`;

let userId;
const keys = {}; // label -> { raw, secret }

/** Insert an api_keys row with a known raw key, returning the raw token. */
async function makeKey({ secret = null, requireSig = false } = {}) {
  const raw = `flow_live_${crypto.randomBytes(16).toString("hex")}`;
  const keyHash = crypto.createHash("sha256").update(raw).digest("hex");
  await query(
    `INSERT INTO api_keys (user_id, name, key_hash, prefix, last_four, signing_secret, require_signature)
     VALUES ($1, 'sig-test', $2, 'flow_live_', $3, $4, $5)`,
    [userId, keyHash, raw.slice(-4), secret, requireSig]
  );
  return raw;
}

const sign = (secret, ts, rawBody) =>
  crypto.createHmac("sha256", secret).update(`${ts}.${rawBody}`).digest("hex");

beforeAll(async () => {
  await initializeDatabase();

  const u = await query(
    `INSERT INTO users (email, password_hash, plan_type, tier)
     VALUES ($1, $2, 'free', 'sandbox') RETURNING id`,
    [EMAIL, PW_HASH]
  );
  userId = u.rows[0].id;

  // Generous lead cap so ingestion is never throttled during the suite
  await query(
    `INSERT INTO lead_counters (user_id, daily_lead_cap, daily_leads_received, last_reset_date)
     VALUES ($1, 100000, 0, CURRENT_DATE)
     ON CONFLICT (user_id) DO UPDATE SET daily_lead_cap = 100000, daily_leads_received = 0`,
    [userId]
  );

  const secret = crypto.randomBytes(32).toString("hex");
  keys.unsigned = { raw: await makeKey(), secret: null };
  keys.signed = { raw: await makeKey({ secret, requireSig: true }), secret };
});

afterAll(async () => {
  await query("DELETE FROM users WHERE email = $1", [EMAIL]).catch(() => {});
  await closePool();
});

describe("x-api-key header + HMAC signatures", () => {
  it("1. require_signature=false → works without signature headers", async () => {
    const res = await request(app)
      .post("/api/v1/leads")
      .set("Authorization", `Bearer ${keys.unsigned.raw}`)
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ email: "a@corp.com", first_name: "Ada" }));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, queued: true });
    await query("DELETE FROM ghl_leads WHERE contact_id = $1", [res.body.contact_id]);
  });

  it("6. x-api-key header (not Bearer) authenticates → 200", async () => {
    const res = await request(app)
      .post("/api/v1/leads")
      .set("x-api-key", keys.unsigned.raw)
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ email: "header@corp.com", first_name: "Grace" }));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    await query("DELETE FROM ghl_leads WHERE contact_id = $1", [res.body.contact_id]);
  });

  it("2. require_signature=true + no signature → 401", async () => {
    const res = await request(app)
      .post("/api/v1/leads")
      .set("x-api-key", keys.signed.raw)
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ email: "b@corp.com" }));

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/signature required/i);
  });

  it("3. require_signature=true + valid signature → 200", async () => {
    const body = JSON.stringify({ email: "valid@corp.com", first_name: "Lin" });
    const ts = String(Date.now());
    const signature = sign(keys.signed.secret, ts, body);

    const res = await request(app)
      .post("/api/v1/leads")
      .set("x-api-key", keys.signed.raw)
      .set("x-flowapi-timestamp", ts)
      .set("x-flowapi-signature", signature)
      .set("Content-Type", "application/json")
      .send(body);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    await query("DELETE FROM ghl_leads WHERE contact_id = $1", [res.body.contact_id]);
  });

  it("4. tampered body with correct old signature → 401", async () => {
    const original = JSON.stringify({ email: "orig@corp.com" });
    const ts = String(Date.now());
    const signature = sign(keys.signed.secret, ts, original);

    // Send a DIFFERENT body but reuse the signature computed over `original`.
    const tampered = JSON.stringify({ email: "attacker@corp.com" });
    const res = await request(app)
      .post("/api/v1/leads")
      .set("x-api-key", keys.signed.raw)
      .set("x-flowapi-timestamp", ts)
      .set("x-flowapi-signature", signature)
      .set("Content-Type", "application/json")
      .send(tampered);

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid signature/i);
  });

  it("5. stale timestamp (>5min) → 401", async () => {
    const body = JSON.stringify({ email: "stale@corp.com" });
    const ts = String(Date.now() - 6 * 60 * 1000); // 6 minutes ago
    const signature = sign(keys.signed.secret, ts, body);

    const res = await request(app)
      .post("/api/v1/leads")
      .set("x-api-key", keys.signed.raw)
      .set("x-flowapi-timestamp", ts)
      .set("x-flowapi-signature", signature)
      .set("Content-Type", "application/json")
      .send(body);

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/stale timestamp/i);
  });
});
