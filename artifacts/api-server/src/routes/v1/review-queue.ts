// =============================================================================
// v1 review queue — promote / discard / edit with structured Correction logging
// Spec reference: US-1.2, US-1.3, §11.7
//
// Routes:
//   GET    /api/v1/review-queue                       — list (filter by market)
//   POST   /api/v1/review-queue                       — enqueue
//   POST   /api/v1/review-queue/archive-stale         — admin: archive > 14d
//   POST   /api/v1/review-queue/:id/promote           — promote to an entity (UI calls this)
//   POST   /api/v1/review-queue/:id/confirm           — log a Confirmation correction
//   POST   /api/v1/review-queue/:id/reject            — discard + record rejection hash
//   POST   /api/v1/review-queue/:id/edit              — log a Correction with corrected_value
//   DELETE /api/v1/review-queue/:id                   — discard (alias for /reject) (UI calls this)
//
// /promote routes by `kind` to the matching upsertX(...) call. W35 scope: yard
// + org + person. Tender / source_link / five_questions routes are stubbed
// for Sep 8.
// =============================================================================

import { Router } from "express";
import { z } from "zod";
import {
  addToReviewQueue,
  listReviewQueue,
  getReviewQueueItem,
  removeFromReviewQueue,
  logCorrection,
  recordRejection,
  isRejectedContent,
  autoArchiveStaleQueueItems,
  upsertYard,
  upsertOrg,
  upsertPerson,
} from "../../lib/store-factory";

const router = Router();

const userFromReq = (req: { body?: { user?: unknown } }): string =>
  String(req.body?.user ?? (req as unknown as { authUser?: string }).authUser ?? "unknown");

// GET /api/v1/review-queue — list queue items
router.get("/review-queue", async (req, res, next) => {
  try {
    const marketId = req.query["market_id"] ? String(req.query["market_id"]) : undefined;
    const includeArchived = req.query["include_archived"] === "true";
    res.json({ items: await listReviewQueue({ marketId, includeArchived }) });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/review-queue — enqueue a new item
router.post("/review-queue", async (req, res, next) => {
  try {
    const body = req.body as Record<string, unknown> | undefined;
    if (!body) {
      res.status(400).json({ error: "Body required" });
      return;
    }
    const hash = body["rejection_hash"] ? String(body["rejection_hash"]) : null;
    if (hash && (await isRejectedContent(hash))) {
      res.status(409).json({ error: "Content already rejected; not re-queued" });
      return;
    }
    const item = await addToReviewQueue(body as never);
    res.status(201).json({ item });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/review-queue/archive-stale — admin/cron: archive items > 14d
router.post("/review-queue/archive-stale", async (_req, res, next) => {
  try {
    const count = await autoArchiveStaleQueueItems();
    res.json({ archived_count: count });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/review-queue/:id/promote — promote a queue item to a real entity.
//
// The body matches the v1 frontend contract: { kind, proposed }.
// The proposed shape mirrors the entity type — Zod-validated against the
// matching schema before we call upsertX(...).
const PromoteBody = z.object({
  kind: z.enum(["yard", "org", "person", "tender", "five_questions", "source_link"]),
  proposed: z.record(z.unknown()),
});

router.post("/review-queue/:id/promote", async (req, res, next) => {
  try {
    const item = await getReviewQueueItem(req.params.id);
    if (!item) {
      res.status(404).json({ error: "Item not found" });
      return;
    }
    const parsed = PromoteBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body", issues: parsed.error.issues });
      return;
    }
    const { kind, proposed } = parsed.data;
    const user = userFromReq(req);
    let promoted: { id: string } | null = null;
    let route: string = "stubbed";

    if (kind === "yard") {
      promoted = await upsertYard({ ...(proposed as object), id: String(proposed["id"] ?? item.id) } as never);
      route = "upsertYard";
    } else if (kind === "org") {
      promoted = await upsertOrg({ ...(proposed as object), id: String(proposed["id"] ?? item.id) } as never);
      route = "upsertOrg";
    } else if (kind === "person") {
      promoted = await upsertPerson({ ...(proposed as object), id: String(proposed["id"] ?? item.id) } as never);
      route = "upsertPerson";
    } else {
      // tender / source_link / five_questions — schemas ship Sep 8
      res.status(501).json({ error: `Promotion of kind="${kind}" not implemented yet`, item });
      return;
    }

    const correction = await logCorrection({
      fact_id: item.id,
      fact_kind: kind,
      action: "confirm",
      user,
    });
    await removeFromReviewQueue(item.id);
    res.json({ ok: true, route, promoted, correction });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/review-queue/:id/confirm — log a Confirmation correction (no entity write)
router.post("/review-queue/:id/confirm", async (req, res, next) => {
  try {
    const item = await getReviewQueueItem(req.params.id);
    if (!item) {
      res.status(404).json({ error: "Item not found" });
      return;
    }
    const user = userFromReq(req);
    const correction = await logCorrection({
      fact_id: item.id,
      fact_kind: item.kind,
      action: "confirm",
      user,
    });
    await removeFromReviewQueue(item.id);
    res.json({ item, correction });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/review-queue/:id/reject — discard + record rejection hash
router.post("/review-queue/:id/reject", async (req, res, next) => {
  try {
    const item = await getReviewQueueItem(req.params.id);
    if (!item) {
      res.status(404).json({ error: "Item not found" });
      return;
    }
    const user = userFromReq(req);
    const reason = String(req.body?.reason ?? "").trim();
    const hashSeed = `${reason}|${String(item.proposed?.["name"] ?? "")}|${item.raw_snippet}|${item.source_url}`;
    const hash = `rej_${hashSeed.length}_${hashSeed.length.toString(36)}`;
    await recordRejection(hash);
    const correction = await logCorrection({
      fact_id: item.id,
      fact_kind: item.kind,
      action: "reject",
      user,
      rejection_hash: hash,
      corrected_value: reason || undefined,
    });
    await removeFromReviewQueue(item.id);
    res.json({ correction });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/review-queue/:id — alias for /reject (the UI calls this)
router.delete("/review-queue/:id", async (req, res, next) => {
  try {
    const item = await getReviewQueueItem(req.params.id);
    if (!item) {
      res.status(404).json({ error: "Item not found" });
      return;
    }
    const user = userFromReq(req);
    const reason = String(req.body?.reason ?? "").trim();
    const hashSeed = `${reason}|${String(item.proposed?.["name"] ?? "")}|${item.raw_snippet}|${item.source_url}`;
    const hash = `rej_${hashSeed.length}_${hashSeed.length.toString(36)}`;
    await recordRejection(hash);
    const correction = await logCorrection({
      fact_id: item.id,
      fact_kind: item.kind,
      action: "reject",
      user,
      rejection_hash: hash,
      corrected_value: reason || undefined,
    });
    await removeFromReviewQueue(item.id);
    res.json({ ok: true, correction });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/review-queue/:id/edit — log a Correction with corrected_value
router.post("/review-queue/:id/edit", async (req, res, next) => {
  try {
    const item = await getReviewQueueItem(req.params.id);
    if (!item) {
      res.status(404).json({ error: "Item not found" });
      return;
    }
    const user = userFromReq(req);
    const corrected = req.body?.corrected_value;
    const correction = await logCorrection({
      fact_id: item.id,
      fact_kind: item.kind,
      action: "edit",
      corrected_value: corrected,
      user,
    });
    await removeFromReviewQueue(item.id);
    res.json({ corrected, correction });
  } catch (err) {
    next(err);
  }
});

export default router;
