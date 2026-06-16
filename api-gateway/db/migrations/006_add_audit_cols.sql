-- =============================================================================
-- Migration 006: Add updated_at audit column to mutable tables.
-- =============================================================================

ALTER TABLE ghl_leads    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE webhook_keys ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE destinations  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Trigger function to keep updated_at current on any UPDATE
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ghl_leads_updated_at    ON ghl_leads;
DROP TRIGGER IF EXISTS trg_webhook_keys_updated_at ON webhook_keys;
DROP TRIGGER IF EXISTS trg_destinations_updated_at ON destinations;

CREATE TRIGGER trg_ghl_leads_updated_at
  BEFORE UPDATE ON ghl_leads
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_webhook_keys_updated_at
  BEFORE UPDATE ON webhook_keys
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_destinations_updated_at
  BEFORE UPDATE ON destinations
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
