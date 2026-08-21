// =============================================================================
// @workspace/db — Drizzle ORM client + schema barrel
//
// Usage:
//   import { db, schema } from "@workspace/db";
//   const rows = await db.select().from(schema.markets);
//
// DATABASE_URL must be set at runtime; this module does not validate it at
// import time so the package can be type-checked in CI without a live DB.
// `drizzle-kit push` (via @workspace/db's `push` script) is the dev path.
// =============================================================================

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: pg.Pool | null = null;

/**
 * Lazy database client. Throws on first use if DATABASE_URL is not set.
 * Use `getDb()` in route handlers; tests can stub it.
 */
export function getDb() {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. The v1 API requires a Postgres connection. See docs/ENV.md.",
    );
  }
  _pool = new Pool({ connectionString: url });
  _db = drizzle(_pool, { schema });
  return _db;
}

/**
 * Eager database client. Lazily initialised on first access via a Proxy.
 * Use `import { db } from "@workspace/db"` in route handlers.
 */
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});

/**
 * Close the connection pool. Call from graceful-shutdown hooks.
 */
export async function closeDb(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
    _db = null;
  }
}

export * from "./schema";
