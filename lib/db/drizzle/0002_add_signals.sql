-- =============================================================================
-- 0002_add_signals.sql — Phase 7 radar table (additive only, not full schema)
-- =============================================================================
-- Per Cassin's v1.6 brief §4, the post-fair radar needs a normalised signals
-- table. This is a hand-rolled additive migration (drizzle-kit generate would
-- produce a full schema reset — see memory note "Drizzle `generate` produces
-- a full schema reset, not additive migrations").
--
-- Apply with:
--   cat lib/db/drizzle/0002_add_signals.sql | docker exec -i decel-db psql -U decel -d decel
-- =============================================================================

CREATE TABLE IF NOT EXISTS signals (
  id                    text PRIMARY KEY,
  source                text NOT NULL,
  external_id           text NOT NULL,
  url                   text NOT NULL,
  title                 text NOT NULL,
  summary               jsonb NOT NULL,
  market_id             text,
  posted_at             timestamptz,
  fetched_at            timestamptz NOT NULL DEFAULT now(),
  status                text NOT NULL DEFAULT 'new',
  promoted_to_play_id   text,
  dismissed_reason      text,
  notes                 text
);

CREATE UNIQUE INDEX IF NOT EXISTS signals_source_external_idx
  ON signals (source, external_id);

CREATE INDEX IF NOT EXISTS signals_status_idx
  ON signals (status);

CREATE INDEX IF NOT EXISTS signals_market_idx
  ON signals (market_id);
