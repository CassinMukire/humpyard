// =============================================================================
// v1/signals — radar page API (Phase 7)
//
// Per Cassin's v1.6 brief §4: the radar that feeds the Morning Queue.
// GET    /api/v1/signals            — list signals (filter by status, market)
// GET    /api/v1/signals/:id        — one signal
// POST   /api/v1/signals            — ingest one signal (used by radar-fetch.ts)
// POST   /api/v1/signals/:id/promote — create a Play from a signal
// POST   /api/v1/signals/:id/dismiss — mark a signal as not actionable
// PATCH  /api/v1/signals/:id        — edit notes / status (operator workflow)
//
// All routes gated by requireAuth (mounted in v1/index.ts after the auth
// gate). All requests/responses use SourcedFact envelopes for the summary
// field (same trust contract as everywhere else).
// =============================================================================

import { Router } from "express";
import { z } from "zod";
import {
  listSignals,
  getSignal,
  upsertSignal,
  promoteSignal,
  dismissSignal,
  createPlay,
} from "../../lib/store-factory";
import { SourcedFactSchema, SignalSchema } from "@workspace/api-zod";
import { logger } from "../../lib/logger";
import { pushPlayToMonday, type PlayPushResult } from "./monday-sync";

const router = Router();

// ---- Zod request schemas ------------------------------------------------

const ListQuerySchema = z.object({
  status: z.enum(["new", "promoted", "dismissed", "acted"]).optional(),
  market_id: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const UpsertBodySchema = z.object({
  id: z.string().optional(),
  source: z.enum([
    "ted_eu",
    "cupt_feniks",
    "eradis",
    "utk",
    "zakazky_sz",
    "vaylavirasto",
    "exa",
    "manual",
  ]),
  external_id: z.string().min(1),
  url: z.string().url(),
  title: z.string().min(1),
  summary: SourcedFactSchema,
  market_id: z.string().nullable().optional(),
  posted_at: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const PromoteBodySchema = z.object({
  action: z.string().min(1),
  owner: z.string().optional(),
  due: z.string().optional(),
  doctrine_ref: z.string().optional(),
});

const DismissBodySchema = z.object({
  reason: z.string().min(1),
});

const PatchBodySchema = z.object({
  notes: z.string().nullable().optional(),
  status: z.enum(["new", "promoted", "dismissed", "acted"]).optional(),
});

// ---- Routes --------------------------------------------------------------

// GET /api/v1/signals — list
router.get("/signals", async (req, res, next) => {
  try {
    const q = ListQuerySchema.parse(req.query);
    const items = await listSignals({
      status: q.status,
      marketId: q.market_id,
      limit: q.limit,
    });
    res.json({ items, count: items.length });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/signals/:id — one
router.get("/signals/:id", async (req, res, next) => {
  try {
    const s = await getSignal(req.params.id);
    if (!s) {
      res.status(404).json({ error: "signal_not_found", id: req.params.id });
      return;
    }
    res.json(s);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/radar/save — the end-to-end radar flow.
//
// Hitank (2026-09-09): "what come here from any from means from target
// or form global radar then its go to dossiers proply structurely ...
// and 2ndly its all goes to monday also". This route is the one-click
// "Save this radar finding into the dossier + push to Monday" action.
//
// Input: the CountryResult from /api/search/country (Target Scanner or
// Global Radar). Output: { signal_id, play_id, market_id, dossier_url, monday }.
//
//   1. Map the country to a market (PL/DE/FI/AT/CZ/MC/TR/IT/NO/HU) by
//      ISO code or by name. Country names not in the dossier portfolio
//      are still allowed — they get a null market_id (the signal lands
//      in the global radar queue and Cassin curates later).
//   2. Create a Signal in the signals table (source=exa, external_id
//      derived from country + ts, summary=CountryResult.summary, url=
//      procurementPortal or first source). Real data only — no mock.
//   3. Create a Play in the plays table (action="Verify radar finding
//      for {country}", status=open, origin=engine, market_id=matched).
//   4. Link the signal to the play (signal flips to "promoted").
//   5. Auto-push the play to monday.com (Hitank 2026-09-09: "its all
//      goes to monday also"). The push is idempotent — re-runs update
//      the same Monday item instead of creating duplicates. If the
//      token/board is not configured, the play is still saved to the
//      DB; the response surfaces a `skipped_no_token` / `skipped_no_board`
//      / `error` status so the operator can see what happened.
//
// The route is idempotent on (source, external_id) at the signal level
// (the upsert handles duplicates). Re-running the same scan lands one
// signal, not many.

const CountryNameToMarket: Record<string, string> = {
  // ISO codes (uppercase)
  PL: "pl", DE: "de", FI: "fi", AT: "at", CZ: "cz", TR: "tr", IT: "it", NO: "no", HU: "hu",
  // Country names that EXA / scanner might return
  "poland": "pl",
  "germany": "de",
  "finland": "fi",
  "austria": "at",
  "czech republic": "cz",
  "czechia": "cz",
  "türkiye": "tr",
  "turkey": "tr",
  "italy": "it",
  "norway": "no",
  "hungary": "hu",
  // Middle Corridor = no single market_id, but signals land in MC
  "kazakhstan": "middle-corridor",
  "uzbekistan": "middle-corridor",
  "middle corridor": "middle-corridor",
};

const SaveBody = z.object({
  country: z.string().min(1),
  summary: z.string().min(1),
  url: z.string().url().optional(),
  source_url: z.string().url().optional(), // for the SourcedFact
  posted_at: z.string().optional(),
  // Optional structured fields from the CountryResult (used to write a
  // useful play action + signal notes)
  tier: z.enum(["A", "B", "C", "D"]).optional(),
  yards: z.array(z.string()).optional(),
  operator: z.string().nullable().optional(),
});

router.post("/radar/save", async (req, res, next) => {
  try {
    const parsed = SaveBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body", issues: parsed.error.issues });
      return;
    }
    const body = parsed.data;

    // 1. Map country -> market_id
    const upper = body.country.trim().toUpperCase();
    const lower = body.country.trim().toLowerCase();
    const market_id =
      CountryNameToMarket[upper] ?? CountryNameToMarket[lower] ?? null;

    // 2. Create a Signal (idempotent on source+external_id via upsert)
    const now = new Date().toISOString();
    const externalId = `radar:${body.country}:${now}`;
    const url =
      body.url ??
      body.source_url ??
      `https://decel.cassinai.tech/radar/${encodeURIComponent(body.country)}`;
    const signal = await upsertSignal({
      id: `sig_exa_radar_${encodeURIComponent(body.country)}_${now}`,
      source: "exa",
      external_id: externalId,
      url,
      title: `Radar finding: ${body.country} (tier ${body.tier ?? "?"})`,
      summary: {
        value: body.summary,
        source_url: body.source_url ?? url,
        retrieved_at: now,
        confidence: "O", // EXA is an aggregator; [V] requires Cassin verification
        verified_by: "rule",
      },
      market_id,
      posted_at: body.posted_at ?? null,
      fetched_at: now,
      status: "new",
      promoted_to_play_id: null,
      dismissed_reason: null,
      notes: body.tier
        ? `Radar tier ${body.tier}. Yards: ${(body.yards ?? []).join(", ") || "—"}`
        : null,
    });

    // 3. Create a Play (the action that will get pushed to Monday)
    let play = await createPlay({
      market_id,
      action: `Verify radar finding for ${body.country}${body.tier ? ` (tier ${body.tier})` : ""}`,
      owner: null,
      due: null,
      status: "open",
      origin: "engine",
      doctrine_ref: null,
      monday_item_id: null,
    });

    // Link the signal to the play (signal flips to "promoted")
    await promoteSignal(signal.id, play.id);

    // Auto-push the play to monday.com (Hitank 2026-09-09: "its all
    // goes to monday also"). pushPlayToMonday persists the new
    // monday_item_id via updatePlay if the push created an item, so
    // re-pushes update the same item. If the push is skipped (no
    // token/board) the play is still saved to the DB.
    let mondayResult: PlayPushResult | null = null;
    try {
      mondayResult = await pushPlayToMonday(play);
      // pushPlayToMonday persists the item_id itself; we also update
      // the local `play` copy so the response reflects the final state.
      if (mondayResult.monday_item_id) {
        play = { ...play, monday_item_id: mondayResult.monday_item_id };
      }
    } catch (err) {
      // Don't fail the whole radar/save if Monday is down — the Signal
      // and Play are already persisted. Log and surface the error in
      // the response so the operator can re-push later.
      mondayResult = {
        play_id: play.id,
        monday_item_id: null,
        status: "error",
        reason: err instanceof Error ? err.message : String(err),
      };
      logger.warn(
        { play_id: play.id, err: mondayResult.reason },
        "radar/save: monday push failed (signal + play still persisted)",
      );
    }

    logger.info(
      {
        country: body.country,
        market_id,
        signal_id: signal.id,
        play_id: play.id,
        monday_status: mondayResult?.status,
        monday_item_id: mondayResult?.monday_item_id,
      },
      "radar/save: end-to-end flow",
    );

    res.status(201).json({
      ok: true,
      signal_id: signal.id,
      play_id: play.id,
      market_id,
      dossier_url: market_id ? `/dossiers/${market_id}` : null,
      monday: {
        status: mondayResult?.status ?? "skipped_no_token",
        item_id: mondayResult?.monday_item_id ?? null,
        reason: mondayResult?.reason,
      },
      next_action:
        mondayResult?.status === "created" || mondayResult?.status === "updated"
          ? `Pushed to monday.com (item #${mondayResult.monday_item_id}). Open the dossier to see the new play.`
          : "Play is in the DB but was not pushed to monday.com (token/board not configured or push failed). Open the dossier to see the new play; you can re-push from /signals later.",
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/signals — ingest (used by radar-fetch.ts + operator paste)
router.post("/signals", async (req, res, next) => {
  try {
    const body = UpsertBodySchema.parse(req.body);
    // Stable id from (source, external_id) unless the caller passed an explicit id
    const id = body.id || `sig_${body.source}_${body.external_id}`;
    const now = new Date().toISOString();
    const signal = SignalSchema.parse({
      id,
      source: body.source,
      external_id: body.external_id,
      url: body.url,
      title: body.title,
      summary: body.summary,
      market_id: body.market_id ?? null,
      posted_at: body.posted_at ?? null,
      fetched_at: now,
      status: "new",
      promoted_to_play_id: null,
      dismissed_reason: null,
      notes: body.notes ?? null,
    });
    const saved = await upsertSignal(signal);
    logger.info({ id: saved.id, source: saved.source }, "signal ingested");
    res.status(201).json(saved);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/signals/:id/promote — create a Play from the signal
router.post("/signals/:id/promote", async (req, res, next) => {
  try {
    const body = PromoteBodySchema.parse(req.body);
    const signal = await getSignal(req.params.id);
    if (!signal) {
      res.status(404).json({ error: "signal_not_found", id: req.params.id });
      return;
    }
    if (signal.status !== "new") {
      res.status(409).json({ error: "signal_already_actioned", current_status: signal.status });
      return;
    }
    const play = await createPlay({
      market_id: signal.market_id,
      action: body.action,
      owner: body.owner ?? null,
      due: body.due ?? null,
      status: "open",
      origin: "engine",
      doctrine_ref: body.doctrine_ref ?? null,
      monday_item_id: null,
    });
    const updated = await promoteSignal(signal.id, play.id);
    logger.info({ signal_id: signal.id, play_id: play.id }, "signal promoted to play");
    res.status(201).json({ signal: updated, play });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/signals/:id/dismiss
router.post("/signals/:id/dismiss", async (req, res, next) => {
  try {
    const body = DismissBodySchema.parse(req.body);
    const updated = await dismissSignal(req.params.id, body.reason);
    if (!updated) {
      res.status(404).json({ error: "signal_not_found", id: req.params.id });
      return;
    }
    logger.info({ signal_id: req.params.id, reason: body.reason }, "signal dismissed");
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/signals/:id — edit notes or correct status
router.patch("/signals/:id", async (req, res, next) => {
  try {
    const body = PatchBodySchema.parse(req.body);
    const current = await getSignal(req.params.id);
    if (!current) {
      res.status(404).json({ error: "signal_not_found", id: req.params.id });
      return;
    }
    const updated = await upsertSignal({
      ...current,
      notes: body.notes !== undefined ? body.notes : current.notes,
      status: body.status ?? current.status,
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
