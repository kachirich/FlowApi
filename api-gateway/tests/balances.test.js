/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  FlowAPI — Per-destination metering & credit balance suite
 *
 *  Requires live PostgreSQL + Redis. Outbound HTTP is mocked (axios) and DNS
 *  is bypassed via isTest, so dispatch tests are hermetic.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

vi.mock("axios", () => ({
  default: vi.fn(async () => ({ status: 200, data: { ok: true } })),
}));

import app from "../app.js";
import { query, closePool, initializeDatabase } from "../db/connection.js";
import { dispatchLead } from "../services/WebhookDispatcher.js";

const JWT_SECRET = process.env.JWT_SECRET;
const PW = "$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012";
const stamp = Date.now();

const users = {}; // label -> { id, token, email }

async function makeUser(label, { tier = "growth", isAdmin = false, strategy = "broadcast" } = {}) {
  const email = `bal_${label}_${stamp}@flowapi-test.dev`;
  const r = await query(
    `INSERT INTO users (email, password_hash, plan_type, tier, is_admin, routing_strategy)
     VALUES ($1, $2, 'pro', $3, $4, $5) RETURNING id`,
    [email, PW, tier, isAdmin, strategy]
  );
  const id = r.rows[0].id;
  users[label] = { id, email, token: jwt.sign({ id, email }, JWT_SECRET, { expiresIn: "1h" }) };
  return users[label];
}

async function makeDest(userId, name, { active = true } = {}) {
  const r = await query(
    `INSERT INTO destinations (user_id, name, target_url, daily_cap, is_active)
     VALUES ($1, $2, 'https://example.com/buyer', 0, $3) RETURNING id`,
    [userId, name, active]
  );
  return r.rows[0].id;
}

async function setBalance(destId, userId, { is_metered = true, exhausted_action = "continue", balance = 0, total_purchased = 0 }) {
  await query(
    `INSERT INTO destination_balances (destination_id, user_id, is_metered, exhausted_action, balance, total_purchased)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (destination_id) DO UPDATE SET
       is_metered=$3, exhausted_action=$4, balance=$5, total_purchased=$6`,
    [destId, userId, is_metered, exhausted_action, balance, total_purchased]
  );
}

const auth = (label) => `Bearer ${users[label].token}`;

beforeAll(async () => {
  await initializeDatabase();
  await makeUser("broker", { tier: "growth", isAdmin: false });
  await makeUser("admin", { tier: "growth", isAdmin: true });
  await makeUser("sandbox", { tier: "sandbox" });
  await makeUser("other", { tier: "growth" });
  await makeUser("summary", { tier: "growth" });
  await makeUser("debit", { tier: "growth", strategy: "broadcast" });
  await makeUser("pause", { tier: "growth", strategy: "broadcast" });
  await makeUser("cont", { tier: "growth", strategy: "broadcast" });
});

afterAll(async () => {
  const emails = Object.values(users).map((u) => u.email);
  await query("DELETE FROM users WHERE email = ANY($1)", [emails]).catch(() => {});
  await closePool();
});

describe("Balance settings & gating", () => {
  it("enables metering via PUT settings (Growth tier)", async () => {
    const dest = await makeDest(users.broker.id, "Settings Dest");
    const res = await request(app)
      .put(`/api/destinations/${dest}/balance/settings`)
      .set("Authorization", auth("broker"))
      .send({ is_metered: true });
    expect(res.status).toBe(200);
    expect(res.body.is_metered).toBe(true);
  });

  it("toggles exhausted_action pause then continue", async () => {
    const dest = await makeDest(users.broker.id, "Action Dest");
    const r1 = await request(app).put(`/api/destinations/${dest}/balance/settings`).set("Authorization", auth("broker")).send({ exhausted_action: "pause" });
    expect(r1.status).toBe(200);
    expect(r1.body.exhausted_action).toBe("pause");
    const r2 = await request(app).put(`/api/destinations/${dest}/balance/settings`).set("Authorization", auth("broker")).send({ exhausted_action: "continue" });
    expect(r2.body.exhausted_action).toBe("continue");
  });

  it("Sandbox tier gets 403 on enable metering", async () => {
    const dest = await makeDest(users.sandbox.id, "Sandbox Dest");
    const res = await request(app)
      .put(`/api/destinations/${dest}/balance/settings`)
      .set("Authorization", auth("sandbox"))
      .send({ is_metered: true });
    expect(res.status).toBe(403);
  });
});

describe("Dispatcher metering", () => {
  it("debits one credit after a successful delivery", async () => {
    const dest = await makeDest(users.debit.id, "Debit Dest");
    await setBalance(dest, users.debit.id, { balance: 5, total_purchased: 5 });

    const result = await dispatchLead(users.debit.id, { email: "a@corp.com" }, `bal_debit_${stamp}`, true, null);
    expect(result.success).toBe(true);

    const b = await query("SELECT balance, total_consumed FROM destination_balances WHERE destination_id=$1", [dest]);
    expect(b.rows[0].balance).toBe(4);
    expect(b.rows[0].total_consumed).toBe(1);

    const tx = await query("SELECT * FROM balance_transactions WHERE destination_id=$1 AND type='debit'", [dest]);
    expect(tx.rows.length).toBe(1);
  });

  it("skips a paused destination with zero balance (PAUSED_NO_CREDITS)", async () => {
    const dest = await makeDest(users.pause.id, "Pause Dest");
    await setBalance(dest, users.pause.id, { balance: 0, exhausted_action: "pause", total_purchased: 100 });

    const result = await dispatchLead(users.pause.id, { email: "b@corp.com" }, `bal_pause_${stamp}`, true, null);
    expect(result.success).toBe(false); // nothing delivered

    const logs = await query(
      "SELECT response_error FROM webhook_logs WHERE destination_id=$1 ORDER BY created_at DESC LIMIT 1",
      [dest]
    );
    expect(logs.rows[0].response_error).toBe("PAUSED_NO_CREDITS");

    const b = await query("SELECT balance, total_consumed FROM destination_balances WHERE destination_id=$1", [dest]);
    expect(b.rows[0].balance).toBe(0);
    expect(b.rows[0].total_consumed).toBe(0);

    const tx = await query("SELECT * FROM balance_transactions WHERE destination_id=$1 AND type='debit'", [dest]);
    expect(tx.rows.length).toBe(0);
  });

  it("still delivers when balance=0 and action=continue", async () => {
    const dest = await makeDest(users.cont.id, "Continue Dest");
    await setBalance(dest, users.cont.id, { balance: 0, exhausted_action: "continue", total_purchased: 100 });

    const result = await dispatchLead(users.cont.id, { email: "c@corp.com" }, `bal_cont_${stamp}`, true, null);
    expect(result.success).toBe(true);

    const b = await query("SELECT balance, total_consumed FROM destination_balances WHERE destination_id=$1", [dest]);
    expect(b.rows[0].balance).toBe(0); // GREATEST keeps it at 0
    expect(b.rows[0].total_consumed).toBe(1);
  });
});

describe("Top-up & admin credit", () => {
  it("top-up-request returns booking_url and inserts a PENDING transaction", async () => {
    const dest = await makeDest(users.broker.id, "TopUp Dest");
    const res = await request(app)
      .post(`/api/destinations/${dest}/balance/top-up-request`)
      .set("Authorization", auth("broker"))
      .send({ pack: "growth" });
    expect(res.status).toBe(200);
    expect(res.body.booking_url).toBe("https://cal.com/flowgateway/credits");
    expect(res.body.credits).toBe(2000);

    const tx = await query("SELECT * FROM balance_transactions WHERE destination_id=$1 AND type='credit'", [dest]);
    expect(tx.rows.length).toBe(1);
    expect(tx.rows[0].note).toMatch(/PENDING/);
    expect(tx.rows[0].amount).toBe(2000);
  });

  it("admin-credit adds balance for an admin; non-admin gets 403", async () => {
    const adminDest = await makeDest(users.admin.id, "Admin Dest");
    const ok = await request(app)
      .post(`/api/destinations/${adminDest}/balance/admin-credit`)
      .set("Authorization", auth("admin"))
      .send({ amount: 1000, pack_name: "manual" });
    expect(ok.status).toBe(200);
    expect(ok.body.balance).toBe(1000);
    expect(ok.body.total_purchased).toBe(1000);

    const brokerDest = await makeDest(users.broker.id, "Broker NonAdmin Dest");
    const denied = await request(app)
      .post(`/api/destinations/${brokerDest}/balance/admin-credit`)
      .set("Authorization", auth("broker"))
      .send({ amount: 1000 });
    expect(denied.status).toBe(403);
  });
});

describe("Ownership & summary", () => {
  it("non-owner gets 404 on balance routes", async () => {
    const dest = await makeDest(users.broker.id, "Owned Dest");
    const get = await request(app).get(`/api/destinations/${dest}/balance`).set("Authorization", auth("other"));
    expect(get.status).toBe(404);
    const put = await request(app).put(`/api/destinations/${dest}/balance/settings`).set("Authorization", auth("other")).send({ is_metered: true });
    expect(put.status).toBe(404);
  });

  it("GET /api/balance/summary returns correct totals", async () => {
    const d1 = await makeDest(users.summary.id, "Sum Dest 1");
    const d2 = await makeDest(users.summary.id, "Sum Dest 2");
    await setBalance(d1, users.summary.id, { is_metered: true, exhausted_action: "continue", balance: 100, total_purchased: 100 });
    await setBalance(d2, users.summary.id, { is_metered: true, exhausted_action: "pause", balance: 0, total_purchased: 50 });

    const res = await request(app).get("/api/balance/summary").set("Authorization", auth("summary"));
    expect(res.status).toBe(200);
    expect(res.body.total_balance).toBe(100);
    expect(res.body.metered_count).toBe(2);
    expect(res.body.paused_count).toBe(1);
  });
});
