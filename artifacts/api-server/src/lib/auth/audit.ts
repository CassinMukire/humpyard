// =============================================================================
// Auth audit log — every login, logout, and auth failure lands here
// Spec reference: §12.5 (security baseline)
//
// Stored in the audit_log table. The operator can see who logged in when,
// from where, and whether anything failed.
// =============================================================================

import { randomUUID } from "node:crypto";
import { desc, eq, gte } from "drizzle-orm";
import { db } from "@workspace/db";
import * as schema from "@workspace/db/schema";

export type AuthEvent =
  | "login_success"
  | "login_failure"
  | "login_rate_limited"
  | "logout"
  | "session_expired"
  | "token_invalid"
  | "auth_disabled_bypass"
  | "auth_not_configured";

export interface AuthAuditEntry {
  id: string;
  ts: Date;
  event: AuthEvent;
  user: string;
  ip: string | null;
  userAgent: string | null;
  details: Record<string, unknown> | null;
}

export async function logAuthEvent(input: {
  event: AuthEvent;
  user: string;
  ip?: string | null;
  userAgent?: string | null;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.insert(schema.auditLog).values({
      id: `audit_${randomUUID()}`,
      event: input.event,
      user: input.user,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      details: input.details ?? null,
    });
  } catch {
    // Best-effort. If the audit log write fails, never block the request.
  }
}

export async function listAuthEvents(opts?: {
  limit?: number;
  since?: Date;
  user?: string;
}): Promise<AuthAuditEntry[]> {
  const limit = opts?.limit ?? 100;
  const conds = [];
  if (opts?.since) conds.push(gte(schema.auditLog.ts, opts.since));
  if (opts?.user) conds.push(eq(schema.auditLog.user, opts.user));
  const where = conds.length === 0 ? undefined : conds.length === 1 ? conds[0] : undefined;
  const q = where
    ? db.select().from(schema.auditLog).where(where)
    : db.select().from(schema.auditLog);
  const rows = await q.orderBy(desc(schema.auditLog.ts)).limit(limit);
  return rows.map((r) => ({
    id: r.id,
    ts: r.ts,
    event: r.event as AuthEvent,
    user: r.user,
    ip: r.ip,
    userAgent: r.userAgent,
    details: r.details as Record<string, unknown> | null,
  }));
}
