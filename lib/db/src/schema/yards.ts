// =============================================================================
// yards table — physical classification yard
// US-1.2 structural gate: name + market_id + (geo OR operator_org_id)
// =============================================================================

import {
  pgTable,
  text,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { yardStatusEnum } from "./enums";
import { markets } from "./markets";

export const yards = pgTable(
  "yards",
  {
    id: text("id").primaryKey(),
    market_id: text("market_id")
      .notNull()
      .references(() => markets.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // { lat: number | null, lon: number | null } | null
    geo: jsonb("geo"),
    // FK to orgs.id — declared lazily (cycle avoidance); enforced at app layer
    operator_org_id: text("operator_org_id"),
    status: yardStatusEnum("status").notNull().default("unknown"),
    // SourcedFact | null
    brake_tech: jsonb("brake_tech"),
    // SourcedFact | null
    last_modernized: jsonb("last_modernized"),
    sources: jsonb("sources").notNull().default([]),
    created_at: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    marketIdx: index("yards_market_idx").on(t.market_id),
    operatorIdx: index("yards_operator_idx").on(t.operator_org_id),
    nameIdx: index("yards_name_idx").on(t.name),
  }),
);

export type YardRow = typeof yards.$inferSelect;
export type YardInsert = typeof yards.$inferInsert;
