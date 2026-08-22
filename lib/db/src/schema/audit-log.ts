// =============================================================================
// audit_log table — every login, logout, auth failure, and security event
// Spec reference: §12.5 (security baseline)
//
// Best-effort writes from the auth layer. The operator queries this to
// see who logged in when, from where, and whether anything failed.
// =============================================================================

import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

export const auditLog = pgTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
    // Event type. Validated at the application layer (see AuthEvent union).
    // The DB stores any text so the schema doesn't need to change when
    // we add new event types.
    event: text("event").notNull(),
    user: text("user").notNull(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    // JSON details — request id, route, failure reason, etc.
    details: jsonb("details"),
  },
  (t) => ({
    eventIdx: index("audit_event_idx").on(t.event),
    userIdx: index("audit_user_idx").on(t.user),
    tsIdx: index("audit_ts_idx").on(t.ts),
  }),
);

export type AuditLogRow = typeof auditLog.$inferSelect;
export type AuditLogInsert = typeof auditLog.$inferInsert;
