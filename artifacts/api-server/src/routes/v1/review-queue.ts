// =============================================================================
// v1 review queue — promote / discard / edit with structured Correction logging
// Spec reference: US-1.2, US-1.3, §11.7
// =============================================================================

import { Router } from "express";
import {
  addToReviewQueue,
  listReviewQueue,
  getReviewQueueItem,
  removeFromReviewQueue,
  logCorrection,
  recordRejection,
  isRejectedContent,
  autoArchiveStaleQueueItems,
} from "../../lib/queue-store";

const router = Router();

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

// POST /api/v1/review-queue/:id/confirm — promote item, log Correction
router.post("/review-queue/:id/confirm", async (req, res, next) => {
  try {
    const item = await getReviewQueueItem(req.params.id);
    if (!item) {
      res.status(404).json({ error: "Item not found" });
      return;
    }
    const user = String(req.body?.user ?? "unknown");
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
    const user = String(req.body?.user ?? "unknown");
    const hashSeed =
      String(item.proposed?.["name"] ?? "") + "|" + item.raw_snippet + "|" + item.source_url;
    const hash = `rej_${hashSeed.length}_${hashSeed.length.toString(36)}`;
    await recordRejection(hash);
    const correction = await logCorrection({
      fact_id: item.id,
      fact_kind: item.kind,
      action: "reject",
      user,
      rejection_hash: hash,
    });
    await removeFromReviewQueue(item.id);
    res.json({ correction });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/review-queue/:id/edit — promote with corrected value
router.post("/review-queue/:id/edit", async (req, res, next) => {
  try {
    const item = await getReviewQueueItem(req.params.id);
    if (!item) {
      res.status(404).json({ error: "Item not found" });
      return;
    }
    const user = String(req.body?.user ?? "unknown");
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
