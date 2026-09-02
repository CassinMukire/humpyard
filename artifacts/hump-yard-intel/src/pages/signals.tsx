// =============================================================================
// Radar page — Phase 7
//
// Per Cassin's v1.6 brief §4: the radar that feeds the Morning Queue. List of
// signal items from the configured feeds (TED EU, CUPT/FEnIKS, ERADIS, UTK,
// zakazky.spravazeleznic.cz, Väylävirasto hankintaohjelmat, EXA, manual paste).
// The operator can promote a signal to a Play, dismiss it, or edit notes.
//
// Status semantics (per the Signal Zod schema):
//   new       — just fetched, not yet reviewed
//   promoted  — a Play was created from this signal
//   dismissed — operator marked it as not actionable
//   acted     — the Play was completed
//
// This is a read-mostly view. Heavy filtering + promotion flow lives here;
// the heavy data entry (curated cards) lives on the dossier pages.
// =============================================================================

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listSignals, promoteSignal, dismissSignal, type Signal, type SignalStatus } from "@/lib/v1-api";

const STATUS_LABEL: Record<SignalStatus, string> = {
  new: "🆕 new",
  promoted: "✅ promoted",
  dismissed: "🚫 dismissed",
  acted: "✓ acted",
};

const SOURCE_LABEL: Record<string, string> = {
  ted_eu: "TED EU",
  cupt_feniks: "CUPT/FEnIKS",
  eradis: "ERADIS",
  utk: "UTK",
  zakazky_sz: "SŽ zakázky",
  vaylavirasto: "Väylävirasto",
  exa: "EXA",
  manual: "manual",
};

const CONFIDENCE_BADGE: Record<string, string> = {
  V: "bg-green-100 text-green-900",
  O: "bg-amber-100 text-amber-900",
  I: "bg-slate-100 text-slate-700",
};

export default function SignalsPage() {
  const [filter, setFilter] = useState<SignalStatus | "all">("new");
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["signals", filter],
    queryFn: () => listSignals(filter === "all" ? {} : { status: filter, limit: 100 }),
  });

  const promote = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      promoteSignal(id, { action }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["signals"] }),
  });

  const dismiss = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      dismissSignal(id, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["signals"] }),
  });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Radar</h1>
        <p className="text-sm text-slate-600 mt-1">
          Post-fair radar (Phase 7). Each item comes from a live feed (TED EU,
          CUPT/FEnIKS, ERADIS, UTK, SŽ zakázky, Väylävirasto) or from EXA /
          manual paste. Promote a signal to a Play, dismiss it, or act on it.
        </p>
      </header>

      <div className="flex gap-2 mb-4">
        {(["all", "new", "promoted", "dismissed", "acted"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1 text-sm rounded border ${filter === s ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-50"}`}
            data-testid={`filter-${s}`}
          >
            {s}
          </button>
        ))}
      </div>

      {q.isLoading && <p className="text-slate-500">Loading…</p>}
      {q.isError && (
        <p className="text-red-600">Failed to load signals: {String(q.error)}</p>
      )}
      {q.data && q.data.items.length === 0 && (
        <div className="border border-dashed border-slate-300 rounded p-8 text-center text-slate-500">
          <p className="font-medium">No signals yet.</p>
          <p className="text-sm mt-2">
            Run <code className="bg-slate-100 px-1 rounded">pnpm run radar:fetch</code> on
            the VPS to ingest a feed. Or paste a signal manually via{" "}
            <code className="bg-slate-100 px-1 rounded">POST /api/v1/signals</code>.
          </p>
          <p className="text-xs mt-3 text-slate-400">
            Radar MVP target: 2026-10-15 (≥1 real feed item promoted through
            the queue into a Monday Play).
          </p>
        </div>
      )}

      <ul className="space-y-3">
        {q.data?.items.map((s) => (
          <SignalRow
            key={s.id}
            signal={s}
            onPromote={(action) => promote.mutate({ id: s.id, action })}
            onDismiss={(reason) => dismiss.mutate({ id: s.id, reason })}
            promoting={promote.isPending}
            dismissing={dismiss.isPending}
          />
        ))}
      </ul>
    </div>
  );
}

function SignalRow({
  signal,
  onPromote,
  onDismiss,
  promoting,
  dismissing,
}: {
  signal: Signal;
  onPromote: (action: string) => void;
  onDismiss: (reason: string) => void;
  promoting: boolean;
  dismissing: boolean;
}) {
  const [actionText, setActionText] = useState("Reach out to confirm spec status");
  const [reasonText, setReasonText] = useState("");

  return (
    <li className="border border-slate-200 rounded p-4 bg-white">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap text-xs text-slate-600 mb-1">
            <span className="font-mono px-1.5 py-0.5 bg-slate-100 rounded">
              {SOURCE_LABEL[signal.source] ?? signal.source}
            </span>
            <span>{STATUS_LABEL[signal.status]}</span>
            {signal.market_id && (
              <span className="px-1.5 py-0.5 bg-blue-50 text-blue-800 rounded">
                market: {signal.market_id}
              </span>
            )}
            {signal.posted_at && (
              <span className="text-slate-500">
                posted {new Date(signal.posted_at).toLocaleDateString()}
              </span>
            )}
          </div>
          <a
            href={signal.url}
            target="_blank"
            rel="noreferrer noopener"
            className="font-medium text-slate-900 hover:underline break-words"
          >
            {signal.title}
          </a>
          <p className="text-sm text-slate-700 mt-1">{signal.summary.value}</p>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span
              className={`px-1.5 py-0.5 rounded font-mono ${CONFIDENCE_BADGE[signal.summary.confidence] ?? ""}`}
              title={`confidence: ${signal.summary.confidence}`}
            >
              [{signal.summary.confidence}]
            </span>
            <a
              href={signal.summary.source_url}
              target="_blank"
              rel="noreferrer noopener"
              className="text-slate-500 hover:underline truncate"
            >
              {signal.summary.source_url}
            </a>
            {signal.promoted_to_play_id && (
              <span className="text-slate-500 font-mono">
                → play {signal.promoted_to_play_id.slice(0, 12)}…
              </span>
            )}
            {signal.dismissed_reason && (
              <span className="text-slate-500">dismissed: {signal.dismissed_reason}</span>
            )}
          </div>
          {signal.notes && (
            <p className="text-xs text-slate-600 mt-2 italic">notes: {signal.notes}</p>
          )}
        </div>
      </div>

      {signal.status === "new" && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={actionText}
              onChange={(e) => setActionText(e.target.value)}
              placeholder="Play action (what to do about this signal)"
              className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded"
            />
            <button
              onClick={() => onPromote(actionText)}
              disabled={promoting || !actionText.trim()}
              className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {promoting ? "Promoting…" : "Promote → Play"}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              placeholder="Dismiss reason (e.g. 'wrong operator', 'duplicate')"
              className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded"
            />
            <button
              onClick={() => onDismiss(reasonText || "operator dismissed")}
              disabled={dismissing}
              className="px-3 py-1 text-sm bg-slate-200 text-slate-700 rounded hover:bg-slate-300 disabled:opacity-50"
            >
              {dismissing ? "Dismissing…" : "Dismiss"}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
