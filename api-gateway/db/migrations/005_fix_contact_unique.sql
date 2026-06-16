-- =============================================================================
-- Migration 005: Change ghl_leads.contact_id from UNIQUE to UNIQUE(contact_id, user_id).
-- A contact_id is only unique within a tenant — different users can receive
-- the same GHL contact_id without collision.
-- =============================================================================

-- Drop the old single-column unique constraint (name assigned by Postgres)
ALTER TABLE ghl_leads DROP CONSTRAINT IF EXISTS ghl_leads_contact_id_key;

-- Add the composite unique constraint idempotently.
-- (ADD CONSTRAINT IF NOT EXISTS is not valid PostgreSQL DDL — use a DO block.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'ghl_leads'::regclass
      AND conname   = 'ghl_leads_contact_id_user_id_key'
  ) THEN
    ALTER TABLE ghl_leads
      ADD CONSTRAINT ghl_leads_contact_id_user_id_key
      UNIQUE (contact_id, user_id);
  END IF;
END $$;
