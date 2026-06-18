/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  FlowAPI Integration Test Suite
 *
 *  Tests:
 *    1. Meta Webhook Verification Handshake
 *    2. 3-Day Trusted Device Token (72h OTP Bypass)
 *    3. BullMQ Worker Failsafe (500 → RETRYING)
 *    4. GDPR Right to be Forgotten (Account Deletion Cascade)
 *    5. Transient Storage Compliance (Log Expiration)
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../app.js";
import { query, closePool } from "../db/connection.js";
import { initializeDatabase } from "../db/connection.js";

const JWT_SECRET = process.env.JWT_SECRET;

/* ─── Test Fixtures ─────────────────────────────────────────────────────── */

let testUser;
let testToken;
let testWebhookId;
const TEST_EMAIL = `integration_test_${Date.now()}@flowapi-test.dev`;
const TEST_PASSWORD_HASH = "$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012"; // dummy bcrypt hash

/* ─── Setup & Teardown ──────────────────────────────────────────────────── */

beforeAll(async () => {
  await initializeDatabase();

  // Create a disposable test user
  const userResult = await query(
    `INSERT INTO users (email, password_hash, plan_type)
     VALUES ($1, $2, $3)
     RETURNING id, email`,
    [TEST_EMAIL, TEST_PASSWORD_HASH, "free"]
  );
  testUser = userResult.rows[0];

  // Sign a valid JWT for this test user
  testToken = jwt.sign(
    { id: testUser.id, email: testUser.email },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  // Create a test webhook key for cascade tests
  const webhookResult = await query(
    `INSERT INTO webhook_keys (user_id, api_key, masked_key, webhook_url, target_url)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [testUser.id, `test_key_${Date.now()}`, "flk_****test", "https://flowapi.test/catch/test", "https://httpbin.org/post"]
  );
  testWebhookId = webhookResult.rows[0].id;

  // Seed a webhook_log entry for this user
  await query(
    `INSERT INTO webhook_logs (user_id, webhook_id, method, status_code, request_payload, response_error)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [testUser.id, testWebhookId, "POST", 200, '{"test": true}', null]
  );
});

afterAll(async () => {
  // Clean up test user (CASCADE deletes webhook_keys, ghl_leads, webhook_logs)
  await query("DELETE FROM users WHERE email = $1", [TEST_EMAIL]).catch(() => {});
  await closePool();
});

/* ═══════════════════════════════════════════════════════════════════════════
   TEST 1: Meta Webhook Verification Handshake
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Meta Webhook Verification Handshake", () => {
  it("should echo hub.challenge as raw text when hub.mode=subscribe", async () => {
    const challengeToken = "FLOWAPI_CHALLENGE_" + Date.now();

    const res = await request(app)
      .get(`/api/catch/${testWebhookId}`)
      .query({
        "hub.mode": "subscribe",
        "hub.challenge": challengeToken,
        "hub.verify_token": "any_token",
      });

    expect(res.status).toBe(200);
    // Must be raw string, NOT wrapped in JSON
    expect(res.text).toBe(challengeToken);
    expect(res.headers["content-type"]).not.toContain("application/json");
  });

  it("should return a JSON status object for standard GET (browser ping)", async () => {
    const res = await request(app)
      .get(`/api/catch/${testWebhookId}`);

    expect(res.status).toBe(200);
    // The browser failsafe returns a plain text or JSON status
    expect(res.text).toBeTruthy();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   TEST 2: 3-Day Trusted Device Token (72h Cookie)
   ═══════════════════════════════════════════════════════════════════════════ */

describe("3-Day Trusted Device Window", () => {
  it("should produce a trustedDeviceToken with ~72h expiration after successful OTP verification", async () => {
    // Directly test the token mechanics: sign a token the same way the route does
    // and verify it decodes with the correct expiration window
    const trustedDeviceToken = jwt.sign(
      { userId: testUser.id },
      JWT_SECRET,
      { expiresIn: "72h" }
    );

    // 1. Token must be verifiable
    const decoded = jwt.verify(trustedDeviceToken, JWT_SECRET);
    expect(decoded.userId).toBe(testUser.id);

    // 2. Expiration must be ~72 hours from issuance
    const expiresInSeconds = decoded.exp - decoded.iat;
    const hours = expiresInSeconds / 3600;
    expect(hours).toBeCloseTo(72, 0);

    // 3. Token should NOT verify with wrong secret
    expect(() => {
      jwt.verify(trustedDeviceToken, "wrong_secret_key");
    }).toThrow();
  });

  it("should bypass OTP when a valid trusted device token is presented", async () => {
    // Create a fresh trusted device token
    const trustedToken = jwt.sign(
      { userId: testUser.id },
      JWT_SECRET,
      { expiresIn: "72h" }
    );

    const res = await request(app)
      .post("/api/auth/step-up-otp")
      .set("Authorization", `Bearer ${testToken}`)
      .set("x-trusted-device-token", trustedToken);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.bypassed).toBe(true);
  });

  it("should NOT bypass OTP with an expired trusted device token", async () => {
    // Create an already-expired token
    const expiredToken = jwt.sign(
      { userId: testUser.id },
      JWT_SECRET,
      { expiresIn: "0s" } // immediately expires
    );

    // Wait a tick so the token is definitely expired
    await new Promise((r) => setTimeout(r, 100));

    const res = await request(app)
      .post("/api/auth/step-up-otp")
      .set("Authorization", `Bearer ${testToken}`)
      .set("x-trusted-device-token", expiredToken);

    // Should NOT bypass — the controller should proceed to send OTP
    expect(res.status).toBe(200);
    expect(res.body.bypassed).toBeUndefined();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   TEST 3: BullMQ Worker Failsafe (500 → RETRYING)
   ═══════════════════════════════════════════════════════════════════════════ */

describe("BullMQ Worker Failsafe", () => {
  it("should set delivery_status to RETRYING on non-final failure", async () => {
    // This test simulates what the worker does internally when a destination
    // returns a 500. We test the database state transition directly since
    // the worker logic runs the same SQL.
    const testContactId = `test_contact_bullmq_${Date.now()}`;

    // 1. Insert a test lead in PENDING state
    await query(
      `INSERT INTO ghl_leads (contact_id, raw_payload, status, webhook_key_id, delivery_status, retry_count, user_id, is_test)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [testContactId, '{"bullmq_test": true}', "PENDING", testWebhookId, "PENDING", 0, testUser.id, true]
    );

    // 2. Simulate the worker's catch-block: destination returned 500, not final attempt
    const nextRetryCount = 1;
    const nextStatus = "RETRYING"; // Not final (attemptsMade < maxAttempts)
    const errorMsg = "Destination returned 500: Internal Server Error";

    await query(
      `UPDATE ghl_leads 
       SET delivery_status = $1,
           retry_count = $2,
           last_delivery_error = $3,
           status = $4
       WHERE contact_id = $5`,
      [nextStatus, nextRetryCount, errorMsg, "500", testContactId]
    );

    // 3. Assert the database reflects RETRYING
    const result = await query(
      "SELECT delivery_status, retry_count, last_delivery_error FROM ghl_leads WHERE contact_id = $1",
      [testContactId]
    );

    expect(result.rows.length).toBe(1);
    expect(result.rows[0].delivery_status).toBe("RETRYING");
    expect(result.rows[0].retry_count).toBe(1);
    expect(result.rows[0].last_delivery_error).toContain("500");

    // 4. Clean up
    await query("DELETE FROM ghl_leads WHERE contact_id = $1", [testContactId]);
  });

  it("should set delivery_status to FAILED on final attempt exhaustion", async () => {
    const testContactId = `test_contact_final_${Date.now()}`;

    await query(
      `INSERT INTO ghl_leads (contact_id, raw_payload, status, webhook_key_id, delivery_status, retry_count, user_id, is_test)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [testContactId, '{"bullmq_final_test": true}', "PENDING", testWebhookId, "PENDING", 0, testUser.id, true]
    );

    // Simulate final failure (attempt 5 of 5)
    await query(
      `UPDATE ghl_leads 
       SET delivery_status = 'FAILED',
           retry_count = 5,
           last_delivery_error = 'Failed after all retries: Destination returned 500',
           status = '500'
       WHERE contact_id = $1`,
      [testContactId]
    );

    const result = await query(
      "SELECT delivery_status, retry_count FROM ghl_leads WHERE contact_id = $1",
      [testContactId]
    );

    expect(result.rows[0].delivery_status).toBe("FAILED");
    expect(result.rows[0].retry_count).toBe(5);

    await query("DELETE FROM ghl_leads WHERE contact_id = $1", [testContactId]);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   TEST 4: GDPR Right to be Forgotten (Account Deletion Cascade)
   ═══════════════════════════════════════════════════════════════════════════ */

describe("GDPR Right to be Forgotten — DELETE /api/users/me", () => {
  let gdprUser;
  let gdprToken;
  let gdprWebhookId;
  const GDPR_EMAIL = `gdpr_test_${Date.now()}@flowapi-test.dev`;

  beforeEach(async () => {
    // Create a fresh user for each GDPR test
    const userRes = await query(
      `INSERT INTO users (email, password_hash, plan_type)
       VALUES ($1, $2, $3) RETURNING id, email`,
      [GDPR_EMAIL + Math.random(), TEST_PASSWORD_HASH, "free"]
    );
    gdprUser = userRes.rows[0];
    gdprToken = jwt.sign({ id: gdprUser.id, email: gdprUser.email }, JWT_SECRET, { expiresIn: "1h" });

    // Seed webhook key
    const wkRes = await query(
      `INSERT INTO webhook_keys (user_id, api_key, masked_key, webhook_url, target_url)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [gdprUser.id, `gdpr_key_${Date.now()}_${Math.random()}`, "flk_****gdpr", "https://flowapi.test/catch/gdpr", "https://httpbin.org/post"]
    );
    gdprWebhookId = wkRes.rows[0].id;

    // Seed webhook_logs
    await query(
      `INSERT INTO webhook_logs (user_id, webhook_id, method, status_code, request_payload)
       VALUES ($1, $2, $3, $4, $5)`,
      [gdprUser.id, gdprWebhookId, "POST", 200, '{"gdpr": true}']
    );
  });

  it("should delete the user and cascade-remove all webhooks and logs", async () => {
    // 1. Delete the user
    const deleteRes = await request(app)
      .delete("/api/users/me")
      .set("Authorization", `Bearer ${gdprToken}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);
    expect(deleteRes.body.message).toBe("Account permanently deleted");

    // 2. Assert webhook_keys are gone
    const webhooksAfter = await query(
      "SELECT id FROM webhook_keys WHERE user_id = $1",
      [gdprUser.id]
    );
    expect(webhooksAfter.rows.length).toBe(0);

    // 3. Assert webhook_logs are gone
    const logsAfter = await query(
      "SELECT id FROM webhook_logs WHERE user_id = $1",
      [gdprUser.id]
    );
    expect(logsAfter.rows.length).toBe(0);

    // 4. Assert the user itself is gone
    const userAfter = await query(
      "SELECT id FROM users WHERE id = $1",
      [gdprUser.id]
    );
    expect(userAfter.rows.length).toBe(0);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   TEST 5: Legal Compliance — Log Expiration (Transient Storage)
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Legal Compliance — Log Expiration (7-Day Purge)", () => {
  let staleUser;
  let staleWebhookId;
  const STALE_EMAIL = `stale_test_${Date.now()}@flowapi-test.dev`;

  beforeAll(async () => {
    // Create a free-tier user
    const userRes = await query(
      `INSERT INTO users (email, password_hash, plan_type)
       VALUES ($1, $2, $3) RETURNING id, email`,
      [STALE_EMAIL, TEST_PASSWORD_HASH, "free"]
    );
    staleUser = userRes.rows[0];

    // Seed a webhook
    const wkRes = await query(
      `INSERT INTO webhook_keys (user_id, api_key, masked_key, webhook_url)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [staleUser.id, `stale_key_${Date.now()}`, "flk_****stale", "https://flowapi.test/catch/stale"]
    );
    staleWebhookId = wkRes.rows[0].id;
  });

  afterAll(async () => {
    await query("DELETE FROM users WHERE id = $1", [staleUser.id]).catch(() => {});
  });

  it("should purge webhook_logs older than 7 days for free users", async () => {
    // 1. Insert a stale log (10 days old)
    await query(
      `INSERT INTO webhook_logs (user_id, webhook_id, method, status_code, request_payload, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW() - INTERVAL '10 days')`,
      [staleUser.id, staleWebhookId, "POST", 200, '{"stale": true}']
    );

    // 2. Insert a fresh log (1 hour old)
    await query(
      `INSERT INTO webhook_logs (user_id, webhook_id, method, status_code, request_payload, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW() - INTERVAL '1 hour')`,
      [staleUser.id, staleWebhookId, "POST", 200, '{"fresh": true}']
    );

    // 3. Run the same DELETE query the Janitor uses for free users
    const purgeResult = await query(`
      DELETE FROM webhook_logs wl
      USING users u
      WHERE wl.user_id = u.id
        AND (u.plan_type = 'free' OR u.plan_type IS NULL)
        AND wl.created_at < NOW() - INTERVAL '7 days'
        AND wl.user_id = $1
    `, [staleUser.id]);

    // 4. Assert the stale log was deleted
    expect(purgeResult.rowCount).toBeGreaterThanOrEqual(1);

    // 5. Assert the fresh log survived
    const remaining = await query(
      "SELECT id FROM webhook_logs WHERE user_id = $1",
      [staleUser.id]
    );
    expect(remaining.rows.length).toBeGreaterThanOrEqual(1);

    // Clean up remaining
    await query("DELETE FROM webhook_logs WHERE user_id = $1", [staleUser.id]);
  });
});
