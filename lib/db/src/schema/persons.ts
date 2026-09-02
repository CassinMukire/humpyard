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
    // LinkedIn-style profile URL. Per Cassin's v1.6 brief F3: the operator
    // pastes this in manually after looking the person up via a search link.
    // No scraping, no enrichment API. `linkedin_url` is whatever the
    // operator chose to record (could be a real profile, a search URL,
    // or null until they have one).
    linkedin_url: text("linkedin_url"),
    // F3: same shape as linkedin_url but explicitly operator-pasted. Set
    // when the operator uses the "paste LinkedIn URL" field on the person
    // page. Distinguishes human-recorded URLs from any future auto-fill.
    manual_linkedin_url: text("manual_linkedin_url"),
    // Per Cassin's correction (Aug 22): topics of interest — each is a
    // SourcedFact. The tool tells the operator what the person is interested
    // in; humans write their own messages.
    interests: jsonb("interests").notNull().default([]),
    relationship_owner: text("relationship_owner"),
    relationship_status: relationshipStatusEnum("relationship_status")
      .notNull()
      .default("none"),
    // §US-3.1: machine-parsed from xlsx annexes = doc-import with pointer;
    // human-import = a human eyeballed the row; linkedin-enrichment =
    // automated via a data-provider API per §12.5.5.
    import_meta: jsonb("import_meta"),
    // §12.5.3 retention: persons with no engagement in 24 months → flagged
    // for purge. last_engagement_at drives that flag.
    last_engagement_at: timestamp("last_engagement_at", { withTimezone: true }),
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
    lastEngagementIdx: index("persons_last_engagement_idx").on(
      t.last_engagement_at,
    ),
  }),
);

export type PersonRow = typeof persons.$inferSelect;
export type PersonInsert = typeof persons.$inferInsert;
