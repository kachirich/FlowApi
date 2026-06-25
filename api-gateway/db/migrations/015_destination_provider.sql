-- Provider adapter for rest_api destinations (NocoDB, n8n, generic, …).
-- destination_type stays 'webhook' | 'rest_api'; `provider` selects how the
-- token is sent (auth header) and whether a create-time picker is available.
-- Existing rows default to 'generic' (Authorization: Bearer).

ALTER TABLE destinations
  ADD COLUMN IF NOT EXISTS provider VARCHAR(50) NOT NULL DEFAULT 'generic';
