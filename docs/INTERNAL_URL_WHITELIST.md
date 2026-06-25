# Internal URL Whitelist Feature

## Overview

This feature allows specific whitelisted users to create lead routing destinations with internal/localhost URLs (e.g., `http://localhost:5678`). By default, the system blocks internal IPs as an SSRF (Server-Side Request Forgery) protection measure.

## Use Cases

- **Development/Testing**: Route leads to local n8n instances during development
- **Private Network Routing**: Route leads to internal services on private networks
- **Testing Integrations**: Test webhook destinations before going to production

## Database Changes

### Migration: `013_user_internal_url_whitelist.sql`

Adds a new column to the `users` table:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS allow_internal_urls BOOLEAN DEFAULT FALSE;
```

This column controls whether a user is allowed to create destinations with internal/private IP addresses.

## API Endpoints

### Admin Endpoints

#### 1. Whitelist a User

**Endpoint:** `POST /api/admin/whitelist-user`

**Protected:** Requires admin authentication

**Body:**
```json
{
  "email": "support.flowapi@gmail.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User support.flowapi@gmail.com whitelisted for internal URLs",
  "user": {
    "id": "user-uuid",
    "email": "support.flowapi@gmail.com"
  }
}
```

#### 2. Remove Whitelist Access

**Endpoint:** `DELETE /api/admin/whitelist-user`

**Protected:** Requires admin authentication

**Body:**
```json
{
  "email": "support.flowapi@gmail.com"
}
```

#### 3. List Whitelisted Users

**Endpoint:** `GET /api/admin/whitelisted-users`

**Protected:** Requires admin authentication

**Response:**
```json
{
  "success": true,
  "whitelisted_users": [
    {
      "id": "user-uuid",
      "email": "support.flowapi@gmail.com",
      "created_at": "2026-06-25T10:00:00Z"
    }
  ]
}
```

## Setup Instructions

### Option 1: Using the Setup Script (Recommended)

```bash
cd api-gateway
node ../scripts/whitelist-user.js support.flowapi@gmail.com
```

Expected output:
```
✅ Connected to database
✅ Found user: support.flowapi@gmail.com (ID: xxx)

════════════════════════════════════════════════════════
✅ USER WHITELISTED FOR INTERNAL URLs
════════════════════════════════════════════════════════
Email:                support.flowapi@gmail.com
ID:                   xxx-uuid
allow_internal_urls:  true
════════════════════════════════════════════════════════

✅ User can now create destinations with:
   • localhost:5678 (or any port)
   • 127.0.0.1:5678
   • Private IP ranges (10.x.x.x, 192.168.x.x, etc.)

✅ Example n8n destination URL: http://localhost:5678/webhook
```

### Option 2: Using the Admin API

```bash
curl -X POST http://localhost:3000/api/admin/whitelist-user \
  -H "Authorization: Bearer YOUR_ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"email": "support.flowapi@gmail.com"}'
```

### Option 3: Direct Database Query

```sql
UPDATE users SET allow_internal_urls = TRUE WHERE email = 'support.flowapi@gmail.com';
```

## Allowed Internal URLs After Whitelisting

Once a user is whitelisted, they can create destinations with:

### Localhost
- `http://localhost:5678`
- `http://localhost:9000`
- `http://127.0.0.1:8000`
- `http://127.0.0.1:5173`

### Private Networks (RFC 1918)
- `http://10.0.0.1:5678` (10.0.0.0/8)
- `http://192.168.1.100:5678` (192.168.0.0/16)
- `http://172.16.0.1:5678` (172.16.0.0/12)

### Link-Local
- `http://169.254.1.1:5678`

### mDNS/Local Domain
- `http://myservice.local:5678`

## Implementation Details

### Modified Files

1. **`db/migrations/013_user_internal_url_whitelist.sql`**
   - Adds `allow_internal_urls` column to `users` table

2. **`utils/security.js`**
   - `validateWebhookUrl(url, isUserWhitelisted = false)`
   - Now accepts optional `isUserWhitelisted` parameter
   - Allows internal URLs when flag is true

3. **`controllers/destination.controller.js`**
   - `createDestination()` - queries user whitelist flag before validation
   - `updateDestination()` - queries user whitelist flag before validation

4. **`routes/admin.js`**
   - `POST /api/admin/whitelist-user` - whitelist a user
   - `DELETE /api/admin/whitelist-user` - remove whitelist
   - `GET /api/admin/whitelisted-users` - list all whitelisted users
   - Updated `PUT /api/admin/destination` - check whitelist
   - Updated `POST /api/admin/egress-test` - check whitelist

5. **`scripts/whitelist-user.js`**
   - Utility script to whitelist users from CLI

## Security Considerations

### SSRF Protection Remains Intact

- Non-whitelisted users still cannot use internal URLs
- Whitelisting is an explicit admin action
- No automatic whitelist bypass based on environment

### Audit Trail

All whitelist changes are logged to console with clear timestamps and admin actions.

### Network Segmentation

- Only whitelisted users get access
- Can be easily revoked via `DELETE /api/admin/whitelist-user`
- Useful for sandboxing development/testing destinations

## Example: Setting Up n8n Routing

1. **Whitelist the user:**
   ```bash
   node scripts/whitelist-user.js support.flowapi@gmail.com
   ```

2. **User creates a destination:**
   ```bash
   curl -X POST http://localhost:3000/api/destinations \
     -H "Authorization: Bearer USER_JWT" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "n8n Local Webhook",
       "target_url": "http://localhost:5678/webhook/flowapi",
       "daily_cap": 1000,
       "is_active": true
     }'
   ```

3. **Leads are now routed to the local n8n instance**

## Troubleshooting

### "Invalid or prohibited target URL" Error

**Cause:** User is not whitelisted

**Solution:** Run `node scripts/whitelist-user.js <email>`

### User Still Seeing Error After Whitelisting

**Cause:** New destinations created before whitelisting might not reflect change due to caching

**Solution:** Create a new destination after whitelisting

### Need to Verify Whitelist Status

**SQL Query:**
```sql
SELECT email, allow_internal_urls FROM users WHERE email = 'support.flowapi@gmail.com';
```

## Future Enhancements

- Per-destination whitelist (allow specific URLs only)
- Time-limited whitelist (expires after X days)
- Granular URL pattern whitelist (e.g., only `localhost:5678`)
- Audit log of all whitelist changes
