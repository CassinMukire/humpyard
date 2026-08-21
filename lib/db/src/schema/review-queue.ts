// =============================================================================
// review_queue table — facts that didn't pass the trust-layer gate
//
// Queue auto-archives after 14 days unreviewed (§11.7). Archive is recoverable
// (we don't hard-delete) but archived items don't appear in the default list.
// =============================================================================

import {
  pgTable,
  text,
  jsonb,
  timestamp,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { reviewKindEnum } from "./enums";

export const reviewQueue = pgTable(
  "review_queue",
  {
    id: text("id").primaryKey(),
    kind: reviewKindEnum("kind").notNull(),
    // The proposed entity shape; user can edit before promote
    proposed: jsonb("proposed").notNull(),
    raw_snippet: text("raw_snippet").notNull(),
    source_url: text("source_url").notNull(),
    retrieved_at: timestamp("retrieved_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    market_id: text("market_id"),
    ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
    // Soft-archive flag; queries exclude archived unless explicitly included
    archived: boolean("archived").notNull().default(false),
    archived_at: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => ({
    marketIdx: index("review_market_idx").on(t.market_id),
    tsIdx: index("review_ts_idx").on(t.ts),
    archivedIdx: index("review_archived_idx").on(t.archived),
  }),
);

export type ReviewQueueRow = typeof reviewQueue.$inferSelect;
export type ReviewQueueInsert = typeof reviewQueue.$inferInsert;
