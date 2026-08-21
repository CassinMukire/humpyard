// =============================================================================
// plays table — sales action items
// =============================================================================

import {
  pgTable,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { playStatusEnum } from "./enums";

export const plays = pgTable(
  "plays",
  {
    id: text("id").primaryKey(),
    market_id: text("market_id"),
    action: text("action").notNull(),
    owner: text("owner"),
    due: timestamp("due", { withTimezone: true }),
    status: playStatusEnum("status").notNull().default("open"),
    origin: text("origin").notNull(), // "engine" | "human"
    doctrine_ref: text("doctrine_ref"),
    monday_item_id: text("monday_item_id"),
    created_at: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    marketIdx: index("plays_market_idx").on(t.market_id),
    statusIdx: index("plays_status_idx").on(t.status),
  }),
);

export type PlayRow = typeof plays.$inferSelect;
export type PlayInsert = typeof plays.$inferInsert;
