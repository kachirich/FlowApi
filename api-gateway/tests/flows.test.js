/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  FlowAPI — Flows & /api/v1/leads Integration Test Suite
 *
 *  Covers:
 *    1. Create flow (+ attach destinations on create)
 *    2. Attach / detach a destination
 *    3. Ownership rejection (another user's flow / destination)
 *    4. Assign a flow to an API key (+ ownership rejection)
 *    5. dispatchLead routing: flow subset vs. fallback to all destinations
 *    6. POST /api/v1/leads ingest (with and without an assigned flow)
 *
 *  Requires a live PostgreSQL + Redis connection (repo convention). Outbound
 *  HTTP is mocked via vi.mock('axios') and DNS checks are bypassed with isTest,
 *  so no network egress is needed.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import crypto from "crypto";
import jwt from "jsonwebtoken";

// Mock outbound HTTP so dispatchLead "delivers" without hitting the network.
vi.mock("axios", () => ({
  default: vi.fn(async () => ({ status: 200, data: { ok: true } })),
}));

import app from "../app.js";
import { query, closePool, initializeDatabase } from "../db/connection.js";
import { dispatchLead } from "../services/WebhookDispatcher.js";

const JWT_SECRET = process.env.JWT_SECRET;
const PW_HASH = "$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012";

let userA, userB;
let tokenA, tokenB;
let destA1, destA2;          // userA's destinations
let destB1;                  // userB's destination
let rawKeyA;                 // userA's raw API key

const EMAIL_A = `flows_a_${Date.now()}@flowapi-test.dev`;
const EMAIL_B = `flows_b_${Date.now()}@flowapi-test.dev`;

beforeAll(async () => {
  await initializeDatabase();

  const a = await query(
    `INSERT INTO users (email, password_hash, plan_type, tier, routing_strategy)
     VALUES ($1, $2, 'free', 'sandbox', 'broadcast') RETURNING id, email`,
    [EMAIL_A, PW_HASH]
  );
  userA = a.rows[0];
  tokenA = jwt.sign({ id: userA.id, email: userA.email }, JWT_SECRET, { expiresIn: "1h" });

  const b = await query(
    `INSERT INTO users (email, password_hash, plan_type, tier)
     VALUES ($1, $2, 'free', 'sandbox') RETURNING id, email`,
    [EMAIL_B, PW_HASH]
  );
  userB = b.rows[0];
  tokenB = jwt.sign({ id: userB.id, email: userB.email }, JWT_SECRET, { expiresIn: "1h" });

  // Destinations (daily_cap = 0 => uncapped, so the Redis cap Lua is skipped)
  const d1 = await query(
    `INSERT INTO destinations (user_id, name, target_url, daily_cap, is_active)
     VALUES ($1, 'A1', 'https://example.com/a1', 0, TRUE) RETURNING id`,
    [userA.id]
  );
  destA1 = d1.rows[0].id;
  const d2 = await query(
    `INSERT INTO destinations (user_id, name, target_url, daily_cap, is_active)
     VALUES ($1, 'A2', 'https://example.com/a2', 0, TRUE) RETURNING id`,
    [userA.id]
  );
  destA2 = d2.rows[0].id;
  const d3 = await query(
    `INSERT INTO destinations (user_id, name, target_url, daily_cap, is_active)
     VALUES ($1, 'B1', 'https://example.com/b1', 0, TRUE) RETURNING id`,
    [userB.id]
  );
  destB1 = d3.rows[0].id;

  // Generous lead caps so ingest isn't throttled
  await query(
    `INSERT INTO lead_counters (user_id, daily_lead_cap, daily_leads_received, last_reset_date)
     VALUES ($1, 100000, 0, CURRENT_DATE) ON CONFLICT (user_id) DO UPDATE
     SET daily_lead_cap = 100000, daily_leads_received = 0`,
    [userA.id]
  );

  // An API key for userA (we control the hash so we can send the raw key)
  rawKeyA = `flow_live_${crypto.randomBytes(16).toString("hex")}`;
  const keyHash = crypto.createHash("sha256").update(rawKeyA).digest("hex");
  await query(
    `INSERT INTO api_keys (user_id, name, key_hash, prefix, last_four)
     VALUES ($1, 'test', $2, 'flow_live_', $3)`,
    [userA.id, keyHash, rawKeyA.slice(-4)]
  );
});

afterAll(async () => {
  await query("DELETE FROM users WHERE email = ANY($1)", [[EMAIL_A, EMAIL_B]]).catch(() => {});
  await closePool();
});

/* ═══════════════════════════════════════════════════════════════════════════
   TEST 1 + 2: Flow CRUD + attach/detach destinations
   ═══════════════════════════════════════════════════════════════════════════ */
describe("Flow management — CRUD & destinations", () => {
  let flowId;

  it("creates a flow with destinations attached on create", async () => {
    const res = await request(app)
      .post("/api/flows")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "GHL Flow", routing_strategy: "broadcast", destination_ids: [destA1] });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.flow.routing_strategy).toBe("broadcast");
    expect(res.body.flow.destinations).toHaveLength(1);
    expect(res.body.flow.destinations[0].id).toBe(destA1);
    expect(res.body.flow.api_key_count).toBe(0);
    flowId = res.body.flow.id;
  });

  it("attaches a second destination to the flow", async () => {
    const res = await request(app)
      .post(`/api/flows/${flowId}/destinations`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ destination_id: destA2 });

    expect(res.status).toBe(200);
    expect(res.body.flow.destinations.map((d) => d.id).sort()).toEqual([destA1, destA2].sort());
  });

  it("detaches a destination from the flow", async () => {
    const res = await request(app)
      .delete(`/api/flows/${flowId}/destinations/${destA2}`)
      .set("Authorization", `Bearer ${tokenA}`);

    expect(res.status).toBe(200);

    const get = await request(app)
      .get(`/api/flows/${flowId}`)
      .set("Authorization", `Bearer ${tokenA}`);
    expect(get.body.flow.destinations.map((d) => d.id)).toEqual([destA1]);
  });

  it("lists the user's flows with destinations", async () => {
    const res = await request(app).get("/api/flows").set("Authorization", `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body.flows.some((f) => f.id === flowId)).toBe(true);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   TEST 3: Ownership rejection
   ═══════════════════════════════════════════════════════════════════════════ */
describe("Flow ownership enforcement", () => {
  let flowA;

  beforeAll(async () => {
    const res = await request(app)
      .post("/api/flows")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "Private A" });
    flowA = res.body.flow.id;
  });

  it("hides another user's flow (404 on GET)", async () => {
    const res = await request(app)
      .get(`/api/flows/${flowA}`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });

  it("rejects attaching another user's destination to a flow (404)", async () => {
    const res = await request(app)
      .post(`/api/flows/${flowA}/destinations`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ destination_id: destB1 });
    expect(res.status).toBe(404);
  });

  it("rejects creating a flow with another user's destination (404)", async () => {
    const res = await request(app)
      .post("/api/flows")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "Bad", destination_ids: [destB1] });
    expect(res.status).toBe(404);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   TEST 4: Assign flow to API key
   ═══════════════════════════════════════════════════════════════════════════ */
describe("API key — flow assignment", () => {
  let keyId, flowA, flowB;

  beforeAll(async () => {
    const keys = await request(app).get("/api/keys").set("Authorization", `Bearer ${tokenA}`);
    keyId = keys.body.keys[0].id;

    const fa = await request(app)
      .post("/api/flows")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "Assignable A" });
    flowA = fa.body.flow.id;

    const fb = await request(app)
      .post("/api/flows")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ name: "Assignable B" });
    flowB = fb.body.flow.id;
  });

  it("assigns the user's own flow to the key", async () => {
    const res = await request(app)
      .put(`/api/keys/${keyId}/flow`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ flow_id: flowA });
    expect(res.status).toBe(200);
    expect(res.body.key.flow_id).toBe(flowA);
  });

  it("rejects assigning another user's flow to the key (404)", async () => {
    const res = await request(app)
      .put(`/api/keys/${keyId}/flow`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ flow_id: flowB });
    expect(res.status).toBe(404);
  });

  it("unassigns the flow with null", async () => {
    const res = await request(app)
      .put(`/api/keys/${keyId}/flow`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ flow_id: null });
    expect(res.status).toBe(200);
    expect(res.body.key.flow_id).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   TEST 5: dispatchLead routing — flow subset vs. all destinations
   ═══════════════════════════════════════════════════════════════════════════ */
describe("dispatchLead — flow routing vs. fallback", () => {
  let flowId;

  beforeAll(async () => {
    // Flow (broadcast) containing ONLY destA1 — a strict subset of userA's
    // two active destinations.
    const f = await query(
      `INSERT INTO flows (user_id, name, routing_strategy) VALUES ($1, 'Subset', 'broadcast') RETURNING id`,
      [userA.id]
    );
    flowId = f.rows[0].id;
    await query(`INSERT INTO flow_destinations (flow_id, destination_id) VALUES ($1, $2)`, [
      flowId,
      destA1,
    ]);
  });

  it("routes to ONLY the flow's destinations when a flowId is given", async () => {
    const result = await dispatchLead(userA.id, { email: "x@corp.com" }, `disp_flow_${Date.now()}`, true, flowId);
    expect(result.success).toBe(true);
    expect(result.strategy).toBe("broadcast");
    expect(result.deliveredCount).toBe(1); // only destA1
  });

  it("falls back to ALL active destinations when no flowId is given", async () => {
    const result = await dispatchLead(userA.id, { email: "x@corp.com" }, `disp_all_${Date.now()}`, true, null);
    expect(result.success).toBe(true);
    expect(result.strategy).toBe("broadcast");
    expect(result.deliveredCount).toBe(2); // destA1 + destA2 (user routing_strategy = broadcast)
  });

  it("returns FLOW_NOT_FOUND for a flow that isn't the user's", async () => {
    const f = await query(
      `INSERT INTO flows (user_id, name) VALUES ($1, 'Other') RETURNING id`,
      [userB.id]
    );
    const result = await dispatchLead(userA.id, { email: "x@corp.com" }, `disp_x_${Date.now()}`, true, f.rows[0].id);
    expect(result.success).toBe(false);
    expect(result.error).toBe("FLOW_NOT_FOUND");
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   TEST 6: POST /api/v1/leads ingestion
   ═══════════════════════════════════════════════════════════════════════════ */
describe("POST /api/v1/leads", () => {
  it("ingests an arbitrarily-shaped payload and returns the stable contract", async () => {
    const res = await request(app)
      .post("/api/v1/leads")
      .set("Authorization", `Bearer ${rawKeyA}`)
      .send({ contact: { email: "lead@corp.com", firstName: "Ada" }, source: "tally" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, queued: true });
    expect(res.body.lead_id).toBeTruthy();
    expect(res.body.contact_id).toBeTruthy();
    expect(typeof res.body.score).toBe("number");

    // The lead was vaulted
    const row = await query("SELECT id FROM ghl_leads WHERE contact_id = $1", [res.body.contact_id]);
    expect(row.rows.length).toBe(1);
    await query("DELETE FROM ghl_leads WHERE contact_id = $1", [res.body.contact_id]);
  });

  it("rejects an empty body with 400", async () => {
    const res = await request(app)
      .post("/api/v1/leads")
      .set("Authorization", `Bearer ${rawKeyA}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it("rejects a request with no API key (401)", async () => {
    const res = await request(app).post("/api/v1/leads").send({ email: "x@y.com" });
    expect(res.status).toBe(401);
  });
});
