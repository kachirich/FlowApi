-- Add column to allow specific users to create destinations with internal/localhost URLs
ALTER TABLE users ADD COLUMN IF NOT EXISTS allow_internal_urls BOOLEAN DEFAULT FALSE;

-- Create index for quick lookup
CREATE INDEX IF NOT EXISTS idx_users_allow_internal_urls ON users (allow_internal_urls) WHERE allow_internal_urls = TRUE;
