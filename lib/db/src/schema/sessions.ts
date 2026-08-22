// =============================================================================
// sessions table — server-side session store
//
// We never store the raw token. The DB holds SHA-256(token). The client
// receives the raw token once at login (POST /api/v1/auth/login) and
// sends it as `Authorization: Bearer <token>` on every subsequent request.
// =============================================================================

import {
  pgTable,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const sessions = pgTable(
  "sessions",
  {
    // SHA-256 of the raw token (64-char hex). The raw token is never stored.
    tokenHash: text("token_hash").primaryKey(),
    userId: text("user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ip: text("ip"),
    userAgent: text("user_agent"),
  },
  (t) => ({
    userIdx: index("sessions_user_idx").on(t.userId),
    expiresIdx: index("sessions_expires_idx").on(t.expiresAt),
  }),
);

export type SessionRow = typeof sessions.$inferSelect;
export type SessionInsert = typeof sessions.$inferInsert;
