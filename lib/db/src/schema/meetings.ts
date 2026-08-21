// =============================================================================
// meetings table — post-meeting capture (US-4.3, conditional scope)
//
// Per §12.5 GDPR: this is the operator's own dictation AFTER the meeting,
// never a recording of counterparts. Recording non-public speech without
// consent is a criminal offence in Germany, §201 StGB. Voice notes are
// stored as a reference (audio_ref) to a native voice-memo file on-device.
// All meeting-derived extractions are [I] confidence — they land in the
// review queue, never auto-[V].
// =============================================================================

import {
  pgTable,
  text,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const meetings = pgTable(
  "meetings",
  {
    id: text("id").primaryKey(),
    org_id: text("org_id"),
    person_ids: jsonb("person_ids").notNull().default([]),
    raw_note: text("raw_note").notNull(),
    // Pointer to a native voice-memo file on the operator's device
    audio_ref: text("audio_ref"),
    // Array of fact_ids (e.g. review-queue ids) that were extracted
    extracted_facts: jsonb("extracted_facts").notNull().default([]),
    play_id: text("play_id"),
    ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgIdx: index("meetings_org_idx").on(t.org_id),
    tsIdx: index("meetings_ts_idx").on(t.ts),
  }),
);

export type MeetingRow = typeof meetings.$inferSelect;
export type MeetingInsert = typeof meetings.$inferInsert;
