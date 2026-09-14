// =============================================================================
// coverage_checks table — Phase 0 #2: coverage ledger with unwatched state
//
// Hitank 2026-09-14 / Cassin 2026-09-11: "Coverage ledger, so a country with
// no source configured renders as 'unwatched'". Per (market, source) per
// check — the UI surfaces the most-recent check per source per market.
//
// Status enum:
//   - "checked"           — source ran, returned >=1 result
//   - "no_results"        — source ran, returned 0 results (negative finding —
//                           still a coverage event, not absence; see ticket #8)
//   - "error"             — source ran but failed (timeout / API key / etc.)
//   - "manual_confirmed"  — operator manually marked this source as confirmed
//                           (e.g., they read a PDF and don't have an automated
//                           feed for it yet)
// =============================================================================

import {
  pgTable,
  text,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const coverageChecks = pgTable(
  "coverage_checks",
  {
    id: text("id").primaryKey(),
    market_id: text("market_id").notNull(),
    source_id: text("source_id").notNull(),
    source_label: text("source_label"),
    query: text("query"),
    result_count: integer("result_count").notNull().default(0),
    status: text("status").notNull(),
    last_checked_at: timestamp("last_checked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    notes: text("notes"),
    operator: text("operator"),
    created_at: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    marketIdx: index("coverage_market_idx").on(t.market_id),
    marketSourceIdx: index("coverage_market_source_idx").on(t.market_id, t.source_id),
    statusIdx: index("coverage_status_idx").on(t.status),
    lastCheckedIdx: index("coverage_last_checked_idx").on(
      t.market_id,
      t.last_checked_at,
    ),
  }),
);

export type CoverageCheckRow = typeof coverageChecks.$inferSelect;
export type CoverageCheckInsert = typeof coverageChecks.$inferInsert;
