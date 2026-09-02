// =============================================================================
// orgs table — organizations (authority / operator / epc / consultant / etc.)
//
// match_key is the ASCII-normalized dedupe key (§11.2, §12.3). Two orgs that
// share a match_key auto-merge; cross-lingual candidates land in review queue.
// =============================================================================

import {
  pgTable,
  text,
  varchar,
  jsonb,
  timestamp,
  boolean,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { orgTypeEnum } from "./enums";

export const orgs = pgTable(
  "orgs",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    // ASCII-normalized, unique per org. Lowercase, diacritics stripped.
    match_key: varchar("match_key").notNull(),
    type: orgTypeEnum("type").notNull(),
    // List of market_ids this org operates in
    market_ids: jsonb("market_ids").notNull().default([]),
    // monday.com item id (set when pushed via /api/v1/monday/push/person/:id)
    monday_item_id: text("monday_item_id"),
    innotrans_target: boolean("innotrans_target").notNull().default(false),
    // D2: cadence fields per Cassin's v1.6 brief §2. Used by the post-fair
    // Morning Queue (§13 in the brief, Oct 1 decision). Nullable because
    // not every org is in the operator's weekly cadence yet — Cassin
    // populates these via the F6 import (markdown/JSON), and they render
    // read-only in the UI.
    //   customer_category: K1..K7 — weekly outreach quota bucket
    //   k1_door: a..d — K1 sub-segmentation (null if not K1)
    customer_category: varchar("customer_category", { length: 2 }),
    k1_door: varchar("k1_door", { length: 1 }),
    // Per §12.5 GDPR: criminal/corruption facts live on Market/Org only, unnamed
    risk_facts: jsonb("risk_facts").notNull().default([]),
    sources: jsonb("sources").notNull().default([]),
    created_at: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    matchKeyIdx: uniqueIndex("orgs_match_key_idx").on(t.match_key),
    typeIdx: index("orgs_type_idx").on(t.type),
    innotransIdx: index("orgs_innotrans_idx").on(t.innotrans_target),
  }),
);

export type OrgRow = typeof orgs.$inferSelect;
export type OrgInsert = typeof orgs.$inferInsert;
