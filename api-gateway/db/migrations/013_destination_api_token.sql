-- Destination typing: 'webhook' (plain URL, no auth) vs 'rest_api'
-- (URL + Authorization: Bearer token). Generic by design — the specific tool
-- (NocoDB, n8n, Airtable, a custom internal service) is just the user-supplied
-- name, never a DB enum value, so supporting a new tool needs no migration.

DO $$
BEGIN
  -- Fresh install: create the 2-value enum.
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'destination_type_enum') THEN
    CREATE TYPE destination_type_enum AS ENUM ('webhook', 'rest_api');

  -- Upgrade path: an earlier build created a 3-value enum ('webhook','nocodb','n8n').
  -- Map nocodb/n8n → rest_api and swap the type out. PG requires the
  -- rename-old → create-new → alter-column → drop-old dance to remove values.
  ELSIF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'destination_type_enum' AND e.enumlabel IN ('nocodb', 'n8n')
  ) THEN
    ALTER TYPE destination_type_enum RENAME TO destination_type_enum_old;
    CREATE TYPE destination_type_enum AS ENUM ('webhook', 'rest_api');
    ALTER TABLE destinations
      ALTER COLUMN destination_type DROP DEFAULT,
      ALTER COLUMN destination_type TYPE destination_type_enum
        USING (
          CASE
            WHEN destination_type::text IN ('nocodb', 'n8n') THEN 'rest_api'
            ELSE destination_type::text
          END
        )::destination_type_enum,
      ALTER COLUMN destination_type SET DEFAULT 'webhook';
    DROP TYPE destination_type_enum_old;
  END IF;
END $$;

ALTER TABLE destinations
  ADD COLUMN IF NOT EXISTS destination_type destination_type_enum NOT NULL DEFAULT 'webhook',
  ADD COLUMN IF NOT EXISTS api_token_encrypted TEXT;
