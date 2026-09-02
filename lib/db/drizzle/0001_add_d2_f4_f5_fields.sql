-- =============================================================================
-- 0001_add_d2_f4_f5_fields.sql
-- Hand-written additive migration for the v1.6 brief F1-F8 + D2 changes.
--
-- This is a PARTIAL migration that only adds the new columns. The auto-
-- generated 0000 migration is a full schema create, which would wipe the
-- live Postgres data on the VPS. We need the additive version.
--
-- Adds:
--   markets:    depth, yard_count, yard_count_source_url, closed_at
--   orgs:       customer_category, k1_door
--   battle_cards: way_in, opening, receipt
--   persons:    manual_linkedin_url
--
-- All new columns are NULLable (no default backfill needed; existing rows
-- keep NULL until Cassin populates via the F6 import).
--
-- Run order:
--   1. Apply this file via psql against the live DB
--   2. Run `pnpm run db:seed -- --force` to re-seed with the new fields
--   3. Restart decel-app so the new columns are picked up
-- =============================================================================

-- markets: dossier depth + yard count + closed marker
ALTER TABLE markets ADD COLUMN IF NOT EXISTS depth text NOT NULL DEFAULT 'scan';
ALTER TABLE markets ADD COLUMN IF NOT EXISTS yard_count integer;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS yard_count_source_url text;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS closed_at timestamp with time zone;
CREATE INDEX IF NOT EXISTS markets_depth_idx ON markets USING btree (depth);

-- orgs: D2 cadence fields
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS customer_category varchar(2);
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS k1_door varchar(1);

-- persons: F3 manual LinkedIn URL (operator-pasted, not API-fetched)
ALTER TABLE persons ADD COLUMN IF NOT EXISTS manual_linkedin_url text;

-- battle_cards: D2 curated text fields
ALTER TABLE battle_cards ADD COLUMN IF NOT EXISTS way_in text;
ALTER TABLE battle_cards ADD COLUMN IF NOT EXISTS opening text;
ALTER TABLE battle_cards ADD COLUMN IF NOT EXISTS receipt text;
