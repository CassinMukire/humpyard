-- =============================================================================
-- 0003_add_coverage_checks.sql — Phase 0 #2: coverage ledger with unwatched state
-- =============================================================================
-- Hitank 2026-09-14 / Cassin 2026-09-11: "Coverage ledger, so a country with
-- no source configured renders as 'unwatched'". France had no French source
-- for six weeks and nothing said so. The operator must be able to look at
-- any country and see (a) which sources were checked, (b) when, (c) with what
-- query, and (d) what came back — OR the country is unwatched.
--
-- Schema: one row per (market_id, source_id) pair per check. Re-checking a
-- source inserts a new row (audit trail) — the UI surfaces the most-recent
-- check per source per market.
--
-- Apply with:
--   cat lib/db/drizzle/0003_add_coverage_checks.sql | docker exec -i decel-db psql -U decel -d decel
-- =============================================================================

CREATE TABLE IF NOT EXISTS coverage_checks (
  id                  text PRIMARY KEY,
  market_id           text NOT NULL,
  source_id           text NOT NULL,            -- 'exa' | 'ted_eu' | 'cupt_feniks' | 'eradis' | 'manual' | ...
  source_label        text,                     -- human-readable name, e.g. "EXA neural search"
  query               text,                     -- the query that was run (may be null for manual checks)
  result_count        integer NOT NULL DEFAULT 0,
  status              text NOT NULL,            -- 'checked' | 'no_results' | 'error' | 'manual_confirmed'
  last_checked_at     timestamptz NOT NULL DEFAULT now(),
  notes               text,
  operator            text,                     -- who ran the check (cassin in v1 single-user)
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coverage_market_idx
  ON coverage_checks (market_id);

CREATE INDEX IF NOT EXISTS coverage_market_source_idx
  ON coverage_checks (market_id, source_id);

CREATE INDEX IF NOT EXISTS coverage_status_idx
  ON coverage_checks (status);

CREATE INDEX IF NOT EXISTS coverage_last_checked_idx
  ON coverage_checks (market_id, last_checked_at DESC);
