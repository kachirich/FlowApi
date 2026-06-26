-- Optional expiry for API keys. NULL = never expires (the historical behaviour),
-- so existing keys are unaffected. apiKeyAuth rejects keys past expires_at.

ALTER TABLE api_keys
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
