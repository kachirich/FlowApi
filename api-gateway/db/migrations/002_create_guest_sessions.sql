-- ============================================================================
-- Migration 002: Create guest_sessions table
-- ============================================================================
-- Supports the Live Tech Demo loop.
-- Safe to re-run — uses IF NOT EXISTS.
-- ============================================================================

CREATE TABLE IF NOT EXISTS guest_sessions (
  id                 SERIAL        PRIMARY KEY,
  first_name         VARCHAR(100)  NOT NULL,
  last_name          VARCHAR(100)  NOT NULL,
  email              VARCHAR(255)  NOT NULL,
  session_id         VARCHAR(128)  NOT NULL UNIQUE,
  lead_score         INTEGER,
  ai_welcome_message TEXT,
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guest_sessions_session_id
  ON guest_sessions (session_id);
