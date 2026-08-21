// =============================================================================
// markets table — country-level dossier
// =============================================================================

import {
  pgTable,
  text,
  varchar,
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
  }),
);

export type MarketRow = typeof markets.$inferSelect;
export type MarketInsert = typeof markets.$inferInsert;
