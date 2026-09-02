// =============================================================================
// battle_cards table — pre-rendered offline target briefings (US-4.1, US-4.2)
//
// NO runtime LLM calls — every card is pre-rendered at ingestion/curation time
// and served as static JSON. Cached client-side as a PWA. LLM work happens at
// ingestion and curation time only. This caps messe-week API costs at ~zero.
// =============================================================================

import {
  pgTable,
  text,
  jsonb,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { battleCardKindEnum, relationshipStatusEnum } from "./enums";

export const battleCards = pgTable(
  "battle_cards",
  {
    // The org_id is the primary key (one card per org)
    org_id: text("org_id").primaryKey(),
    who_they_are: text("who_they_are").notNull(),
    why_matters: text("why_matters").notNull(),
    known_people: jsonb("known_people").notNull().default([]),
    relationship_status: relationshipStatusEnum("relationship_status")
      .notNull()
      .default("none"),
    suggested_questions: jsonb("suggested_questions").notNull().default([]),
    trap_to_avoid: text("trap_to_avoid").notNull(),
    sources: jsonb("sources").notNull().default([]),
    kind: battleCardKindEnum("kind").notNull().default("relationship"),
    recon_what_to_observe: jsonb("recon_what_to_observe"),
    // D2: 3 curated text fields per Cassin's v1.6 brief §2. Populated by
    // Cassin via F6 import (markdown/JSON), rendered read-only. Per the
    // brief: "If this costs more than half a day, say so by Sep 4 and we
    // drop it." Estimated 30 minutes — additive text columns, no migration
    // risk beyond `ALTER TABLE ... ADD COLUMN ... NULL`.
    //   way_in  — operator's "how do I get a meeting" (curated, not auto)
    //   opening — first 30 seconds of a conversation hook
    //   receipt — what success looks like for this org
    way_in: text("way_in"),
    opening: text("opening"),
    receipt: text("receipt"),
    // Doctrine version tracking (§11.11) — every edit bumps this and writes
    // a doctrine_revisions row.
    doctrine_version: integer("doctrine_version").notNull().default(0),
    doctrine_updated_at: timestamp("doctrine_updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    doctrine_updated_by: text("doctrine_updated_by").notNull(),
    created_at: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    kindIdx: index("battle_cards_kind_idx").on(t.kind),
  }),
);

export type BattleCardRow = typeof battleCards.$inferSelect;
export type BattleCardInsert = typeof battleCards.$inferInsert;
