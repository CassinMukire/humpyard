// =============================================================================
// v1 corrections API — F8 from Cassin's v1.6 brief
//
// "Verify correction logging (US-1.3) is actually wired and queryable —
//  {fact_id, action, corrected_value, user, ts}. This log is our workstyle
//  evidence at the Oct 1 and Dec 1 decisions ('what we used, what we never
//  touched')."
//
// Schema (already in lib/db/src/schema/corrections.ts):
//   id, fact_id, fact_kind, action, corrected_value, user, ts, rejection_hash
//
// v1: list + count endpoints, gated by single-user auth (Cassin only).
// Writes happen via the corrections middleware on fact-edit routes (see
// lib/corrections/middleware.ts). v2 may add: aggregate by fact_kind,
// aggregate by user, export to CSV for the Oct 1 / Dec 1 decision meetings.
// =============================================================================

import { Router } from "express";
import { z } from "zod";
import { getDb } from "@workspace/db";
import { corrections } from "@workspace/db/schema";
import { eq, desc, gte, lte, and, sql } from "drizzle-orm";
import { requireAuth } from "../../middlewares/auth";
import { validateQuery } from "../../middlewares/validate";

const router = Router();

// All endpoints are gated — corrections are workstyle evidence (§1.3) and
// not for any unauthenticated caller.
router.use(requireAuth);

// -------------------------------------------------------------------------
// GET /api/v1/corrections
//   Query: ?fact_id=...&user=...&action=confirm|reject|edit&since=ISO&until=ISO
//   Returns: { corrections: [...], total: N }
// -------------------------------------------------------------------------

const ListQuery = z.object({
  fact_id: z.string().optional(),
  user: z.string().optional(),
  action: z.enum(["confirm", "reject", "edit"]).optional(),
  since: z.string().datetime().optional(),
  until: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

router.get(
  "/corrections",
  validateQuery(ListQuery),
  async (req, res, next) => {
    try {
      const q = (req as unknown as { validatedQuery: z.infer<typeof ListQuery> })
        .validatedQuery;
      const conditions = [];
      if (q.fact_id) conditions.push(eq(corrections.fact_id, q.fact_id));
      if (q.user) conditions.push(eq(corrections.user, q.user));
      if (q.action) conditions.push(eq(corrections.action, q.action));
      if (q.since) conditions.push(gte(corrections.ts, new Date(q.since)));
      if (q.until) conditions.push(lte(corrections.ts, new Date(q.until)));

      const where = conditions.length > 0 ? and(...conditions) : undefined;
      const db = getDb();

      const rows = await db
        .select()
        .from(corrections)
        .where(where ?? sql`TRUE`)
        .orderBy(desc(corrections.ts))
        .limit(q.limit);

      // Total count for pagination UI (cap at 10k for the response)
      const countResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(corrections)
        .where(where ?? sql`TRUE`);
      const total = countResult[0]?.count ?? 0;

      res.json({
        corrections: rows.map((r) => ({
          id: r.id,
          fact_id: r.fact_id,
          fact_kind: r.fact_kind,
          action: r.action,
          corrected_value: r.corrected_value,
          user: r.user,
          ts: r.ts.toISOString(),
          rejection_hash: r.rejection_hash,
        })),
        total,
      });
    } catch (err) {
      next(err);
    }
  },
);

// -------------------------------------------------------------------------
// GET /api/v1/corrections/summary
//   Returns: aggregate counts by user + action. Cheap query for the
//   "workstyle evidence" report at the Oct 1 / Dec 1 decisions.
// -------------------------------------------------------------------------

router.get("/corrections/summary", async (_req, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select({
        user: corrections.user,
        action: corrections.action,
        count: sql<number>`count(*)::int`,
        first_ts: sql<string>`min(${corrections.ts})::text`,
        last_ts: sql<string>`max(${corrections.ts})::text`,
      })
      .from(corrections)
      .groupBy(corrections.user, corrections.action)
      .orderBy(corrections.user, corrections.action);

    res.json({ summary: rows });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------------------
// POST /api/v1/corrections
//   Used by the corrections middleware on fact-edit routes. Also exposed
//   here for direct use (e.g. the operator confirms a fact from the UI).
// -------------------------------------------------------------------------

const WriteBody = z.object({
  fact_id: z.string().min(1),
  fact_kind: z.enum([
    "yard",
    "org",
    "person",
    "market",
    "tender",
    "five_questions",
    "battle_card",
    "source_link",
  ]),
  action: z.enum(["confirm", "reject", "edit"]),
  corrected_value: z.unknown().optional(),
  rejection_hash: z.string().optional(),
});

router.post(
  "/corrections",
  // Body validation only — not via validateBody because we need the user
  // from req.authUser, not from the body.
  async (req, res, next) => {
    try {
      const parsed = WriteBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid body", issues: parsed.error.issues });
        return;
      }
      const user = (req as unknown as { authUser?: string }).authUser ?? "unknown";
      const id = `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      const db = getDb();
      await db.insert(corrections).values({
        id,
        fact_id: parsed.data.fact_id,
        fact_kind: parsed.data.fact_kind,
        action: parsed.data.action,
        corrected_value: parsed.data.corrected_value as never,
        user,
        rejection_hash: parsed.data.rejection_hash ?? null,
      });
      res.status(201).json({ id, user, ts: new Date().toISOString() });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
