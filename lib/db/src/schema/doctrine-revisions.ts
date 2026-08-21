// =============================================================================
// doctrine_revisions table — cheap edit history for curated content
//
// Curated fields (5-question blocks, battle card content) are hand-edited
// living text. Store versions (who, when, diff). One table, cheap now,
// painful to retrofit. (§11.11)
// =============================================================================

import {
  pgTable,
  text,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { doctrineContentKindEnum } from "./enums";

export const doctrineRevisions = pgTable(
  "doctrine_revisions",
  {
    id: text("id").primaryKey(),
    content_kind: doctrineContentKindEnum("content_kind").notNull(),
    content_id: text("content_id").notNull(),
    version: integer("version").notNull(),
    diff: text("diff").notNull(),
    author: text("author").notNull(),
    ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    contentIdx: index("doctrine_revisions_content_idx").on(
      t.content_kind,
      t.content_id,
    ),
  }),
);

export type DoctrineRevisionRow = typeof doctrineRevisions.$inferSelect;
export type DoctrineRevisionInsert = typeof doctrineRevisions.$inferInsert;
