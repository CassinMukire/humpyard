// =============================================================================
// persons table
//
// Per §12.5 GDPR scope rule: business contact data only. No criminal/corruption
// facts attached to Person entities — those live at Market/Org level, unnamed.
// =============================================================================

import {
  pgTable,
  text,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { relationshipStatusEnum } from "./enums";

export const persons = pgTable(
  "persons",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    org_id: text("org_id"), // FK to orgs.id — declared lazily
    role: text("role").notNull(),
    role_history: jsonb("role_history").notNull().default([]),
    relationship_owner: text("relationship_owner"),
    relationship_status: relationshipStatusEnum("relationship_status")
      .notNull()
      .default("none"),
    // §US-3.1: machine-parsed from xlsx annexes = doc-import with pointer;
    // human-import = a human eyeballed the row.
    import_meta: jsonb("import_meta"),
    monday_item_id: text("monday_item_id"),
    sources: jsonb("sources").notNull().default([]),
    created_at: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    orgIdx: index("persons_org_idx").on(t.org_id),
    nameIdx: index("persons_name_idx").on(t.name),
  }),
);

export type PersonRow = typeof persons.$inferSelect;
export type PersonInsert = typeof persons.$inferInsert;
