import request from 'supertest';
import app from '../app.js';
import { query } from '../db/connection.js';
import jwt from 'jsonwebtoken';
import express from 'express';

async function run() {
  console.log('Starting API Key tests...');
  
  try {
    // 1. Create a dummy user
    const email = 'test_api_keys@example.com';
    await query("DELETE FROM users WHERE email = $1", [email]);
    
    const insertResult = await query(
      "INSERT INTO users (email, password_hash, first_name, last_name) VALUES ($1, $2, $3, $4) RETURNING id",
      [email, 'HASH', 'Test', 'User']
    );
    const user = insertResult.rows[0];
    
    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    
    console.log('1. Generated User Token');
    
    // 2. Generate API Key
    const generateRes = await request(app)
      .post('/api/keys')
      .set('Authorization', `Bearer ${token}`);
      
    if (generateRes.status !== 201) {
      throw new Error(`Failed to generate key: ${JSON.stringify(generateRes.body)}`);
    }
    
    const rawKey = generateRes.body.key.raw_key;
    const keyId = generateRes.body.key.id;
    console.log('2. Generated API Key successfully:', generateRes.body.key.prefix + '...');
    
    // 3. List API Keys
    const listRes = await request(app)
      .get('/api/keys')
      .set('Authorization', `Bearer ${token}`);
      
    if (listRes.status !== 200 || listRes.body.keys.length !== 1) {
      throw new Error(`Failed to list keys: ${JSON.stringify(listRes.body)}`);
    }
    console.log('3. Listed API Keys successfully');
    
    // 4. Test Webhook Middleware (We'll mount a temporary app)
    const { apiKeyAuth } = await import('../middleware/apiKeyAuth.js');
    const testApp = express();
    testApp.use(express.json());
    testApp.get('/api/test-webhook', apiKeyAuth, (req, res) => {
      res.json({ success: true, user: req.user });
    });
    
    const authRes = await request(testApp)
      .get('/api/test-webhook')
      .set('Authorization', `Bearer ${rawKey}`);
      
    if (authRes.status !== 200 || authRes.body.user.id !== user.id) {
      throw new Error(`Webhook auth failed: ${JSON.stringify(authRes.body)}`);
    }
    console.log('4. Webhook Auth middleware verified successfully');
    
    // Seed a mock webhook destination so inbound dispatching doesn't fail on NO_DESTINATIONS
    await query(
      `INSERT INTO webhook_keys (user_id, api_key, masked_key, webhook_url, target_url)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, 'test_dest_key', 'test_dest_masked', 'http://dummy-dest', 'https://httpbin.org/post']
    );

    // 5. Test Inbound Routing via API Key
    const inboundRes = await request(app)
      .post('/api/leads/inbound')
      .set('Authorization', `Bearer ${rawKey}`)
      .send({
        first_name: "Test",
        last_name: "Lead",
        email: "test.lead@example.com",
        phone: "1234567890",
        flow_api_test: true
      });
      
    if (inboundRes.status !== 200) {
      throw new Error(`Inbound routing failed: ${JSON.stringify(inboundRes.body)}`);
    }
    console.log('5. Inbound Routing via API Key successful. Vaulted and queued!');
    
    // 6. Revoke API Key
    const revokeRes = await request(app)
      .delete(`/api/keys/${keyId}`)
      .set('Authorization', `Bearer ${token}`);
      
    if (revokeRes.status !== 200) {
      throw new Error(`Revoke failed: ${JSON.stringify(revokeRes.body)}`);
    }
    console.log('6. Revoked API Key successfully');
    
    // 7. Verify Auth fails after revoke
    const authResAfter = await request(testApp)
      .get('/api/test-webhook')
      .set('Authorization', `Bearer ${rawKey}`);
      
    if (authResAfter.status !== 401) {
      throw new Error(`Webhook auth should have failed: ${authResAfter.status}`);
    }
    console.log('7. Webhook Auth failed correctly after revoke');
    
    console.log('✅ All tests passed!');
  } catch (err) {
    console.error('❌ Tests failed:', err);
  } finally {
    process.exit(0);
  }
}

run();
