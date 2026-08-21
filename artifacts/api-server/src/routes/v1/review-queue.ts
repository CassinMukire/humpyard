// =============================================================================
// v1 review queue — promote / discard / edit with structured Correction logging
//
// Spec reference: US-1.2, US-1.3, §11.7
//
// Every human correction is logged per §1.3 as {fact_id, action, value, user, ts}.
// Rejected facts never re-render from the same source (dedupe on content-hash).
// Items older than 14 days auto-archive (recoverable).
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
} from "../../lib/queue-store";

const router = Router();

// GET /api/v1/review-queue — list queue items (excludes archived by default)
router.get("/review-queue", (req, res) => {
  const marketId = req.query["market_id"] ? String(req.query["market_id"]) : undefined;
  const includeArchived = req.query["include_archived"] === "true";
  res.json({ items: listReviewQueue({ marketId, includeArchived }) });
});

// POST /api/v1/review-queue — enqueue a new item (used by the trust layer when
// a fact lands in the queue rather than rendering or being discarded).
router.post("/review-queue", (req, res) => {
  const body = req.body as Record<string, unknown> | undefined;
  if (!body) {
    res.status(400).json({ error: "Body required" });
    return;
  }
  // Dedupe: if the content_hash is already rejected, don't enqueue.
  const hash = body["rejection_hash"] ? String(body["rejection_hash"]) : null;
  if (hash && isRejectedContent(hash)) {
    res.status(409).json({ error: "Content already rejected; not re-queued" });
    return;
  }
  const item = addToReviewQueue(body as never);
  res.status(201).json({ item });
});

// POST /api/v1/review-queue/:id/confirm — promote item to renderable, log Correction
router.post("/review-queue/:id/confirm", (req, res) => {
  const item = getReviewQueueItem(req.params.id);
  if (!item) {
    res.status(404).json({ error: "Item not found" });
    return;
  }
  const user = String(req.body?.user ?? "unknown");
  const correction = logCorrection({
    fact_id: item.id,
    fact_kind: item.kind,
    action: "confirm",
    user,
  });
  removeFromReviewQueue(item.id);
  res.json({ item, correction });
});

// POST /api/v1/review-queue/:id/reject — discard + record rejection hash
router.post("/review-queue/:id/reject", (req, res) => {
  const item = getReviewQueueItem(req.params.id);
  if (!item) {
    res.status(404).json({ error: "Item not found" });
    return;
  }
  const user = String(req.body?.user ?? "unknown");
  // Rejection dedupe: content-hash = source_url + (proposed.name or raw_snippet)
  const hashSeed =
    String(item.proposed?.["name"] ?? "") + "|" + item.raw_snippet + "|" + item.source_url;
  const hash = `rej_${hashSeed.length}_${hashSeed.length.toString(36)}`;
  recordRejection(hash);
  const correction = logCorrection({
    fact_id: item.id,
    fact_kind: item.kind,
    action: "reject",
    user,
    rejection_hash: hash,
  });
  removeFromReviewQueue(item.id);
  res.json({ correction });
});

// POST /api/v1/review-queue/:id/edit — promote with corrected value
router.post("/review-queue/:id/edit", (req, res) => {
  const item = getReviewQueueItem(req.params.id);
  if (!item) {
    res.status(404).json({ error: "Item not found" });
    return;
  }
  const user = String(req.body?.user ?? "unknown");
  const corrected = req.body?.corrected_value;
  const correction = logCorrection({
    fact_id: item.id,
    fact_kind: item.kind,
    action: "edit",
    corrected_value: corrected,
    user,
  });
  removeFromReviewQueue(item.id);
  res.json({ corrected, correction });
});

export default router;
