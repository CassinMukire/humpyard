// =============================================================================
// corrections table — the apprentice-loop log (§1.3)
// Every human confirm/reject/edit is logged here. This is tomorrow's training
// set; cheap to log now, impossible to reconstruct later.
// =============================================================================

import {
  pgTable,
  text,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { correctionActionEnum, factKindEnum } from "./enums";

export const corrections = pgTable(
  "corrections",
  {
    id: text("id").primaryKey(),
    fact_id: text("fact_id").notNull(),
    fact_kind: factKindEnum("fact_kind").notNull(),
    action: correctionActionEnum("action").notNull(),
    // Only populated for action = "edit"
    corrected_value: jsonb("corrected_value"),
    user: text("user").notNull(),
    ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
    // Rejection dedupe key: same source_url + value (content-hash) cannot
    // re-render from the same source (§US-1.3).
    rejection_hash: text("rejection_hash"),
  },
  (t) => ({
    factIdx: index("corrections_fact_idx").on(t.fact_id),
    actionIdx: index("corrections_action_idx").on(t.action),
  }),
);

export type CorrectionRow = typeof corrections.$inferSelect;
export type CorrectionInsert = typeof corrections.$inferInsert;
