import 'dotenv/config';
import request from 'supertest';
import express from 'express';
import app from '../app.js';
import { query, initializeDatabase } from '../db/connection.js';
import redisClient, { connectRedis } from '../utils/redisClient.js';

async function run() {
  console.log('Starting WebhookDispatcher / Round-Robin verification tests...');

  // Start dummy receivers
  const receiverApp1 = express();
  receiverApp1.use(express.json());
  let received1 = [];
  receiverApp1.post('/dest1', (req, res) => {
    received1.push(req.body);
    res.status(200).json({ received: true });
  });
  const server1 = receiverApp1.listen(4501);

  const receiverApp2 = express();
  receiverApp2.use(express.json());
  let received2 = [];
  receiverApp2.post('/dest2', (req, res) => {
    received2.push(req.body);
    res.status(200).json({ received: true });
  });
  const server2 = receiverApp2.listen(4502);

  try {
    await initializeDatabase();
    await connectRedis();

    // 1. Setup Test Broker User
    const email = 'dispatcher_test@example.com';
    await query("DELETE FROM users WHERE email = $1", [email]);
    const userResult = await query(
      `INSERT INTO users (email, password_hash, plan_type, routing_strategy) 
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [email, 'HASH', 'pro', 'round_robin']
    );
    const userId = userResult.rows[0].id;

    // Generate API Key for Inbound Ingestion
    const keyRes = await request(app)
      .post('/api/keys')
      .set('Authorization', `Bearer ${jwtSign(userId, email)}`);
    const apiKey = keyRes.body.key.raw_key;
    console.log('Test User and API Key configured.');

    // 2. Setup 2 Webhook Destinations
    // Destination 1: http://localhost:4501/dest1, Cap: 1
    // Destination 2: http://localhost:4502/dest2, Cap: 2
    await query("DELETE FROM webhook_keys WHERE user_id = $1", [userId]);
    const wkResult1 = await query(
      `INSERT INTO webhook_keys (user_id, api_key, masked_key, webhook_url, target_url, daily_lead_cap)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [userId, 'key_dummy1', 'masked_1', 'http://dummy1', 'http://localhost:4501/dest1', 1]
    );
    const dest1Id = wkResult1.rows[0].id;

    const wkResult2 = await query(
      `INSERT INTO webhook_keys (user_id, api_key, masked_key, webhook_url, target_url, daily_lead_cap)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [userId, 'key_dummy2', 'masked_2', 'http://dummy2', 'http://localhost:4502/dest2', 2]
    );
    const dest2Id = wkResult2.rows[0].id;

    console.log('Webhook Destinations configured.');

    // Clear Redis keys for these destinations
    const todayStr = new Date().toISOString().split("T")[0];
    await redisClient.del(`destination:leads:${dest1Id}:${todayStr}`);
    await redisClient.del(`destination:leads:${dest2Id}:${todayStr}`);

    // Test 1: Ingest Lead 1 -> Should go to Dest 1 (first destination)
    console.log('Sending Lead 1...');
    const res1 = await request(app)
      .post('/api/leads/inbound')
      .set('Authorization', `Bearer ${apiKey}`)
      .send({ email: 'lead1@example.com', first_name: 'Lead', last_name: 'One', flow_api_test: true });

    if (res1.status !== 200 || !res1.body.success || res1.body.destination !== 'http://localhost:4501/dest1') {
      throw new Error(`Lead 1 failed: ${JSON.stringify(res1.body)}`);
    }
    console.log('✅ Lead 1 successfully routed to Destination 1.');

    // Test 2: Ingest Lead 2 -> Dest 1 is capped (limit 1). Should go to Dest 2 (under cap 2).
    console.log('Sending Lead 2...');
    const res2 = await request(app)
      .post('/api/leads/inbound')
      .set('Authorization', `Bearer ${apiKey}`)
      .send({ email: 'lead2@example.com', first_name: 'Lead', last_name: 'Two', flow_api_test: true });

    if (res2.status !== 200 || !res2.body.success || res2.body.destination !== 'http://localhost:4502/dest2') {
      throw new Error(`Lead 2 failed: ${JSON.stringify(res2.body)}`);
    }
    console.log('✅ Lead 2 successfully routed to Destination 2.');

    // Test 3: Ingest Lead 3 -> Dest 1 capped, Dest 2 has 1 lead. Should go to Dest 2.
    console.log('Sending Lead 3...');
    const res3 = await request(app)
      .post('/api/leads/inbound')
      .set('Authorization', `Bearer ${apiKey}`)
      .send({ email: 'lead3@example.com', first_name: 'Lead', last_name: 'Three', flow_api_test: true });

    if (res3.status !== 200 || !res3.body.success || res3.body.destination !== 'http://localhost:4502/dest2') {
      throw new Error(`Lead 3 failed: ${JSON.stringify(res3.body)}`);
    }
    console.log('✅ Lead 3 successfully routed to Destination 2.');

    // Test 4: Ingest Lead 4 -> Both Dest 1 (cap 1) and Dest 2 (cap 2) are now capped out.
    // Should return NO_AVAILABLE_DESTINATIONS with 422 status.
    console.log('Sending Lead 4 (expecting cap rejection)...');
    const res4 = await request(app)
      .post('/api/leads/inbound')
      .set('Authorization', `Bearer ${apiKey}`)
      .send({ email: 'lead4@example.com', first_name: 'Lead', last_name: 'Four', flow_api_test: true });

    if (res4.status !== 422 || res4.body.success || res4.body.error !== 'NO_AVAILABLE_DESTINATIONS') {
      throw new Error(`Lead 4 did not return expected cap error: ${JSON.stringify(res4.body)}`);
    }
    console.log('✅ Lead 4 correctly rejected with NO_AVAILABLE_DESTINATIONS error.');

    console.log('🎉 All Round-Robin & Cap checks verified successfully!');
  } catch (err) {
    console.error('❌ Verification failed:', err);
    process.exitCode = 1;
  } finally {
    server1.close();
    server2.close();
    process.exit(process.exitCode || 0);
  }
}

import jwt from 'jsonwebtoken';

function jwtSign(userId, email) {
  return jwt.sign(
    { id: userId, email },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

run();
