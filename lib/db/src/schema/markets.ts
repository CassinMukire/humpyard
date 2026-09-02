// =============================================================================
// markets table — country-level dossier
// =============================================================================

import {
  pgTable,
  text,
  varchar,
  integer,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { tierEnum, postureEnum } from "./enums";

export const markets = pgTable(
  "markets",
  {
    id: text("id").primaryKey(),
    country_iso: varchar("country_iso", { length: 2 }).notNull().unique(),
    country_name: text("country_name").notNull(),
    tier: tierEnum("tier").notNull(),
    posture: postureEnum("posture").notNull(),
    // SourcedFact: { value, source_url, retrieved_at, confidence, verified_by, ... }
    verdict: jsonb("verdict").notNull(),
    // five_questions: 5 SourcedFacts
    five_questions: jsonb("five_questions").notNull(),
    window_opens: timestamp("window_opens", { withTimezone: true }),
    window_closes: timestamp("window_closes", { withTimezone: true }),
    // Dossier depth per Cassin's v1.6 brief §3: PL is "deep" (untouchable),
    // every other market is "scan-level, not dossier-level" (US-2.5).
    // The "scan" depth signals to the UI that the 5-questions block is a
    // first-pass read, not a maintained dossier.
    depth: text("depth").notNull().default("scan"),
    // F5: yard count, sourced. Nullable because not every market has a
    // verified count (e.g. watchlist+ markets may not have a complete map).
    // When present, yard_count_source_url is the primary URL.
    yard_count: integer("yard_count"),
    yard_count_source_url: text("yard_count_source_url"),
    // F4 / market portfolio: markets can be closed (TR, IT, NO, HU per v1.6
    // §3). When closed, dossier is hidden from the main list; the row stays
    // for history + the closure source is recorded as a SourcedFact.
    closed_at: timestamp("closed_at", { withTimezone: true }),
    sources: jsonb("sources").notNull().default([]),
    posture_history: jsonb("posture_history").notNull().default([]),
    created_at: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    tierIdx: index("markets_tier_idx").on(t.tier),
    postureIdx: index("markets_posture_idx").on(t.posture),
    depthIdx: index("markets_depth_idx").on(t.depth),
  }),
);

export type MarketRow = typeof markets.$inferSelect;
export type MarketInsert = typeof markets.$inferInsert;
