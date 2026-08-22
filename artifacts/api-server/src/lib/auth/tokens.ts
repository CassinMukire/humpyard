// =============================================================================
// Session tokens — opaque, random, stored as hashes
//
// We never store the raw token. The DB holds SHA-256(token). The client
// receives the raw token once at login and sends it as `Authorization:
// Bearer <token>` (or in a HttpOnly cookie — both supported).
//
// Token TTL: 7 days. Auto-extend on each request (sliding window).
// =============================================================================

import { randomBytes, createHash } from "node:crypto";
import { eq, and, lt, gt, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import * as schema from "@workspace/db/schema";

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Generate a fresh token. Returns the raw token (give to client) and the
 *  hash to store in the DB. */
export function generateToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token).digest("hex");
  return { token, hash };
}

/** Hash a token for lookup. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface Session {
  tokenHash: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
  lastSeenAt: Date;
  ip: string | null;
  userAgent: string | null;
}

export async function createSession(input: {
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
  ttlMs?: number;
}): Promise<{ token: string; expiresAt: Date }> {
  const { token, hash } = generateToken();
  const ttl = input.ttlMs ?? SESSION_TTL_MS;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttl);
  await db.insert(schema.sessions).values({
    tokenHash: hash,
    userId: input.userId,
    createdAt: now,
    expiresAt,
    lastSeenAt: now,
    ip: input.ip ?? null,
    userAgent: input.userAgent ?? null,
  });
  return { token, expiresAt };
}

export async function getSession(token: string): Promise<Session | null> {
  const hash = hashToken(token);
  const rows = await db
    .select()
    .from(schema.sessions)
    .where(eq(schema.sessions.tokenHash, hash))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) {
    // Expired — best-effort cleanup
    await db.delete(schema.sessions).where(eq(schema.sessions.tokenHash, hash));
    return null;
  }
  return {
    tokenHash: row.tokenHash,
    userId: row.userId,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    lastSeenAt: row.lastSeenAt,
    ip: row.ip,
    userAgent: row.userAgent,
  };
}

/** Sliding window — touch lastSeenAt and extend expiry by SESSION_TTL_MS. */
export async function touchSession(token: string): Promise<Session | null> {
  const hash = hashToken(token);
  const now = new Date();
  const newExpires = new Date(now.getTime() + SESSION_TTL_MS);
  const result = await db
    .update(schema.sessions)
    .set({ lastSeenAt: now, expiresAt: newExpires })
    .where(eq(schema.sessions.tokenHash, hash))
    .returning();
  const row = result[0];
  if (!row) return null;
  return {
    tokenHash: row.tokenHash,
    userId: row.userId,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    lastSeenAt: row.lastSeenAt,
    ip: row.ip,
    userAgent: row.userAgent,
  };
}

export async function destroySession(token: string): Promise<void> {
  const hash = hashToken(token);
  await db.delete(schema.sessions).where(eq(schema.sessions.tokenHash, hash));
}

/** Periodic cleanup — call from a cron / startup hook. */
export async function purgeExpiredSessions(): Promise<number> {
  const now = new Date();
  const result = await db
    .delete(schema.sessions)
    .where(lt(schema.sessions.expiresAt, now))
    .returning({ tokenHash: schema.sessions.tokenHash });
  return result.length;
}

/** List active sessions for a user (admin endpoint). */
export async function listActiveSessions(userId: string): Promise<Session[]> {
  const now = new Date();
  const rows = await db
    .select()
    .from(schema.sessions)
    .where(
      and(
        eq(schema.sessions.userId, userId),
        gt(schema.sessions.expiresAt, now),
      ),
    );
  return rows.map((r) => ({
    tokenHash: r.tokenHash,
    userId: r.userId,
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
    lastSeenAt: r.lastSeenAt,
    ip: r.ip,
    userAgent: r.userAgent,
  }));
}

// Suppress unused import warnings — sql is used by Drizzle internals we may add later
void sql;
