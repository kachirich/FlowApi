-- =============================================================================
-- Migration 004: Fix webhook_logs.destination_id FK to ON DELETE SET NULL.
-- The original ALTER added it as ON DELETE CASCADE which would wipe logs when
-- a destination is deleted.  SET NULL is the correct behaviour — preserve the
-- log row but clear the foreign key so historical records are not lost.
-- =============================================================================

ALTER TABLE webhook_logs DROP CONSTRAINT IF EXISTS webhook_logs_destination_id_fkey;

ALTER TABLE webhook_logs
  ADD CONSTRAINT webhook_logs_destination_id_fkey
  FOREIGN KEY (destination_id)
  REFERENCES destinations(id)
  ON DELETE SET NULL;
