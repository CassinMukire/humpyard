// =============================================================================
// signals table — radar items (Phase 7, post-fair)
//
// Per Cassin's v1.6 brief §4: a single normalised row per radar feed item.
// `external_id + source` is the unique key (TED notice numbers are unique
// per source; EXA search-result ids are unique per query). The summary
// is a SourcedFact so the same trust rules apply as everywhere else.
//
// Promotion path: Signal.status flips to "promoted" when a Play is created
// from it; promoted_to_play_id points to the new Play row. The play is
// what gets pushed to monday (radar MVP per Oct 15, 2026 deadline).
// =============================================================================

import {
  pgTable,
  text,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const signals = pgTable(
  "signals",
  {
    id: text("id").primaryKey(),
    source: text("source").notNull(), // ted_eu | cupt_feniks | eradis | utk | zakazky_sz | vaylavirasto | exa | manual
    external_id: text("external_id").notNull(),
    url: text("url").notNull(),
    title: text("title").notNull(),
    // SourcedFact: { value, source_url, retrieved_at, confidence, verified_by, ... }
    summary: jsonb("summary").notNull(),
    market_id: text("market_id"), // nullable — undated radar hits
    posted_at: timestamp("posted_at", { withTimezone: true }),
    fetched_at: timestamp("fetched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    status: text("status").notNull().default("new"), // new | promoted | dismissed | acted
    promoted_to_play_id: text("promoted_to_play_id"),
    dismissed_reason: text("dismissed_reason"),
    notes: text("notes"),
  },
  (t) => ({
    // Per-source dedupe: a TED notice can only be ingested once. Re-runs
    // of the radar-fetch script are no-ops on existing rows.
    sourceExternalIdx: uniqueIndex("signals_source_external_idx").on(t.source, t.external_id),
    statusIdx: index("signals_status_idx").on(t.status),
    marketIdx: index("signals_market_idx").on(t.market_id),
  }),
);

export type SignalRow = typeof signals.$inferSelect;
export type SignalInsert = typeof signals.$inferInsert;
