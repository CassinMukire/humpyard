-- =============================================================================
-- 0004_add_enrich_correction_action.sql — v1.1.8 LinkedIn enrichment audit
-- =============================================================================
-- Cassin 2026-09-15: "I need that one to work properly" — re-enabled LinkedIn
-- auto-enrichment via Proxycurl. Every enrichment call must be logged to the
-- corrections table (§12.5.2 GDPR Art. 14 audit). The audit row uses
-- action = "enrich", so we extend the correction_action enum.
--
-- Postgres enums need ALTER TYPE ... ADD VALUE for each new label. The
-- IF NOT EXISTS guard makes the migration idempotent (safe to re-run).
--
-- Apply with:
--   cat lib/db/drizzle/0004_add_enrich_correction_action.sql | docker exec -i decel-db psql -U decel -d decel
-- =============================================================================

ALTER TYPE correction_action ADD VALUE IF NOT EXISTS 'enrich';
