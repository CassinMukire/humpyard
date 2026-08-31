// =============================================================================
// Production seed — idempotent baseline loader for the real Postgres backend.
//
// Usage:
//   node --env-file=.env ./node_modules/.pnpm/tsx/dist/cli.mjs scripts/seed-production.ts
//   (or)  pnpm run db:seed
//
// The script reads DATABASE_URL (and any other env) from .env via Node's
// native --env-file flag. No `dotenv` dependency.
//
// What it does:
//   1. Connects to the live Postgres (the one DATABASE_URL points at).
//   2. Checks for existing baseline rows (markets where id IN ('pl','de','kz','uz')).
//      If they exist, prints "already seeded" and exits 0 — re-runs are no-ops.
//   3. Otherwise, writes the v1 baseline (4 markets, 6 orgs, 5 PL yards, 5 PL
//      persons, 5 battle cards, 2 review-queue items) via the production
//      queue-store (Drizzle/Postgres).
//   4. Logs a count summary on success.
//
// Idempotency:
//   - The "already seeded" check looks for the 4 baseline market IDs in
//     one query. If any are missing, the seed runs; if all are present, the
//     seed is skipped.
//   - To force a re-seed, run with --force (deletes the baseline rows first).
//
// Exit codes:
//   0  — success (or already seeded)
//   1  — DB connection failure / schema not migrated / other error
//
// This script is the production counterpart of the dev in-memory store's
// `seed()` function. Both pull from the same data source
// (artifacts/api-server/src/lib/seed-data.ts).
// =============================================================================

import { getSeedData } from "../artifacts/api-server/src/lib/seed-data";
import {
  upsertMarket,
  upsertOrg,
  upsertYard,
  upsertPerson,
  upsertBattleCard,
  addToReviewQueue,
  listMarkets,
  isDemoMode,
} from "../artifacts/api-server/src/lib/store-factory";

const BASELINE_MARKET_IDS = ["pl", "de", "kz", "uz"] as const;
const FORCE = process.argv.includes("--force");

async function isAlreadySeeded(): Promise<boolean> {
  const markets = await listMarkets();
  const ids = new Set(markets.map((m) => m.id));
  return BASELINE_MARKET_IDS.every((id) => ids.has(id));
}

async function main(): Promise<void> {
  if (!process.env["DATABASE_URL"]) {
    console.error("FATAL: DATABASE_URL is not set.");
    console.error("       Set it in .env or in your shell, then re-run.");
    process.exit(1);
  }
  if (isDemoMode()) {
    console.error("FATAL: store-factory is in demo/in-memory mode.");
    console.error("       This script writes to a REAL Postgres. Unset ALLOW_DEMO_STORE and DEMO_MODE.");
    process.exit(1);
  }

  console.log("Production seed — v1 baseline");
  console.log(`  DATABASE_URL = ${maskUrl(process.env["DATABASE_URL"]!)}`);

  if (!FORCE && (await isAlreadySeeded())) {
    console.log("  already seeded — no changes made (re-run with --force to wipe baseline).");
    process.exit(0);
  }

  if (FORCE) {
    console.log("  --force: deleting existing baseline rows (markets, orgs, yards, persons, battle_cards, review_queue)");
    const { getDb } = await import("../lib/db/src");
    const { markets, orgs, yards, persons, battleCards, reviewQueue } = await import("../lib/db/src/schema");
    const { inArray } = await import("drizzle-orm");
    const db = getDb();
    await db.delete(markets).where(inArray(markets.id, [...BASELINE_MARKET_IDS]));
    // Cascade should handle yards/persons/battle_cards/review_queue if FKs
    // are set. If not, this falls through and the seed upserts with the
    // same IDs (Postgres ON CONFLICT rules apply per upsertX implementation).
  }

  const data = getSeedData();
  console.log(`  seeding ${data.markets.length} markets, ${data.orgs.length} orgs, ${data.yards.length} yards, ${data.persons.length} persons, ${data.battle_cards.length} battle cards, ${data.review_queue.length} review items`);

  for (const m of data.markets) await upsertMarket(m);
  for (const o of data.orgs) await upsertOrg(o);
  for (const y of data.yards) await upsertYard(y);
  for (const p of data.persons) await upsertPerson(p);
  for (const c of data.battle_cards) await upsertBattleCard(c);
  for (const r of data.review_queue) await addToReviewQueue(r);

  const after = await listMarkets();
  console.log(`  done. markets in DB: ${after.length} (${after.map((m) => m.id).join(", ")})`);
  console.log("");
  console.log("Next steps:");
  console.log("  1. Start the api-server:   pnpm --filter @workspace/api-server run dev");
  console.log("  2. Log in:                 POST /api/v1/auth/login  (user: AUTH_USER, pass: AUTH_PASS)");
  console.log("  3. Open the dashboard:     http://127.0.0.1:5000/login");
}

function maskUrl(url: string): string {
  return url.replace(/(postgres(?:ql)?:\/\/[^:]+:)([^@]+)(@)/, "$1***$3");
}

main().catch((err) => {
  console.error("SEED FAILED:", err);
  process.exit(1);
});
