-- =============================================================================
-- Migration 009: Drop ghl_leads.status — delivery_status is the canonical field.
-- The status column was a legacy numeric HTTP code string that duplicated
-- delivery_status.  All queries now use delivery_status exclusively.
-- =============================================================================

ALTER TABLE ghl_leads DROP COLUMN IF EXISTS status;
