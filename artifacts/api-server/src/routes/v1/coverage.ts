// =============================================================================
// Coverage ledger routes — Phase 0 #2
//
// Hitank 2026-09-14 / Cassin 2026-09-11: "Coverage ledger, so a country with
// no source configured renders as 'unwatched'". France had no French source
// for six weeks and nothing said so. These routes expose the per-market
// coverage audit + a global ledger landing view.
//
//   GET  /api/v1/coverage             — global ledger (all markets)
//   GET  /api/v1/coverage/:marketId  — per-market summary + full audit trail
//   POST /api/v1/coverage            — record a check (operator or cron)
//
// The dossier page reads /api/v1/coverage/:marketId on load. If status is
// "unwatched" it renders a big red banner; otherwise it shows the most-recent
// check per source with a date.
// =============================================================================

import { Router } from "express";
import { z } from "zod";
import {
  getCoverageSummary,
  listAllCoverage,
  upsertCoverageCheck,
} from "../../lib/store-factory";
import {
  CoverageSourceSchema,
  CoverageStatusSchema,
  CoverageCheckSchema,
} from "@workspace/api-zod";

const router = Router();

// GET /api/v1/coverage — global ledger across all markets
router.get("/", async (_req, res, next) => {
  try {
    const summaries = await listAllCoverage();
    res.json({ markets: summaries, count: summaries.length });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/coverage/:marketId — per-market summary + full audit trail
router.get("/:marketId", async (req, res, next) => {
  try {
    const summary = await getCoverageSummary(req.params.marketId);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/coverage — record a check. Operator or cron.
const PostBody = z.object({
  market_id: z.string().min(1),
  source_id: CoverageSourceSchema,
  source_label: z.string().optional().nullable(),
  query: z.string().optional().nullable(),
  result_count: z.number().int().nonnegative().default(0),
  status: CoverageStatusSchema,
  notes: z.string().optional().nullable(),
  operator: z.string().optional().nullable(),
});
router.post("/", async (req, res, next) => {
  try {
    const parsed = PostBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "validation failed", issues: parsed.error.issues });
      return;
    }
    const body = parsed.data;
    const now = new Date().toISOString();
    const id = `cov_${body.market_id}_${body.source_id}_${Date.now()}`;
    const check = CoverageCheckSchema.parse({
      id,
      market_id: body.market_id,
      source_id: body.source_id,
      source_label: body.source_label ?? null,
      query: body.query ?? null,
      result_count: body.result_count,
      status: body.status,
      last_checked_at: now,
      notes: body.notes ?? null,
      operator: body.operator ?? "cassin",
      created_at: now,
    });
    const saved = await upsertCoverageCheck(check);
    res.status(201).json(saved);
  } catch (err) {
    next(err);
  }
});

export default router;
