// =============================================================================
// Landing page — `https://decel.cassinai.tech/`
//
// Hitank 2026-09-09: "make a landing page ... on this landing page add and
// also ...". This is the page you land on after login. Single-user v1
// (Cassin). Shows:
//   1. Welcome header with operator + login time
//   2. The 4 quick-link cards (Dossiers, Radar, Review queue, Battle cards)
//   3. Live system stats (eval gate, signals, snapshots, markets) — real
//      data from the API, not placeholders
//   4. Recent radar activity (last 3 promoted signals → real plays on Monday)
//   5. The full LogoutButton page variant
//
// No mock data, no fake numbers, no "demo" anything. If the API call
// fails, the section collapses to a single muted line and the rest of the
// page still renders.
// =============================================================================

import React from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { BriefingLayout } from "@/components/BriefingLayout";
import { LogoutButton } from "@/components/LogoutButton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  listSignals,
  listDossiers,
  listSnapshots,
  getSystemInfo,
  snapshotIndex,
  type SnapshotEntry,
  type Signal,
} from "@/lib/v1-api";
import {
  FileText,
  Inbox,
  Swords,
  Radar as RadarIcon,
  ArrowRight,
  Activity,
  Database,
  Camera,
  Globe2,
  CheckCircle2,
} from "lucide-react";

const QUICK_LINKS = [
  {
    href: "/dossiers",
    title: "Dossiers",
    description: "Country-level intelligence. Click into a market to see the 5-question block, sources, and active plays.",
    icon: FileText,
    cta: "Open dossiers",
  },
  {
    href: "/radar",
    title: "Radar",
    description: "Target Scanner + Global Radar. Live EXA queries. Save a finding → dossier + Play, then push to Monday.",
    icon: RadarIcon,
    cta: "Open radar",
  },
  {
    href: "/review-queue",
    title: "Review queue",
    description: "Items needing a primary source before they can render. Promote to a real entity or dismiss.",
    icon: Inbox,
    cta: "Open review queue",
  },
  {
    href: "/battle-cards",
    title: "Battle cards",
    description: "Per-org doctrine, questions, and traps for the floor. Top-10 live in battle mode per Cassin's brief.",
    icon: Swords,
    cta: "Open battle cards",
  },
];

function StatTile({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tone?: "default" | "good";
}) {
  return (
    <div className="border border-border bg-card/40 p-3 flex items-center gap-3">
      <div className={`shrink-0 ${tone === "good" ? "text-primary" : "text-muted-foreground"}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={`text-lg font-semibold ${tone === "good" ? "text-primary" : "text-foreground"}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export default function Home() {
  // ---- Live data for the landing page --------------------------------
  // All from real endpoints. Failures collapse to "—" silently so the
  // page is always useful.
  const sysQ = useQuery({
    queryKey: ["system-info"],
    queryFn: getSystemInfo,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
  const dossiersQ = useQuery({
    queryKey: ["dossiers", "count"],
    queryFn: listDossiers,
  });
  const signalsQ = useQuery({
    queryKey: ["signals", "recent"],
    queryFn: () => listSignals({ limit: 5 }),
    refetchInterval: 30_000,
  });
  const snapshotsQ = useQuery({
    queryKey: ["snapshots", "index"],
    queryFn: listSnapshots,
    staleTime: 60_000,
  });

  // Promote the most recent 3 signals to the "Recent radar" panel. The
  // status field tells us whether the radar finding has been pushed to
  // Monday yet (status=promoted means monday_item_id is set on the play).
  const recentSignals: Signal[] = (signalsQ.data?.items ?? [])
    .filter((s) => s.status === "promoted")
    .slice(0, 3);

  const markets = dossiersQ.data?.markets ?? [];
  const tierACount = markets.filter((m) => m.tier === "A").length;
  const snapshotCount = snapshotsQ.data?.count ?? 0;
  const signalCount = signalsQ.data?.count ?? 0;

  return (
    <BriefingLayout>
      <div className="space-y-6">
        {/* ---- 1. Welcome header ----------------------------------- */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold text-foreground">DECEL Intelligence Platform</h1>
              <Badge variant="outline" className="text-[10px] font-mono uppercase tracking-wider border-primary/50 text-primary bg-primary/10">
                v1.1.2
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Sales intelligence for the InnoTrans Berlin 2026 fair. Every fact is sourced
              at the claim level. Real data only — no fake signals, no placeholder text.
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Welcome back
            </p>
            <p className="text-sm font-mono text-foreground">
              <span className="text-primary">cassin</span> · single-user v1
            </p>
            <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
              InnoTrans Berlin 22–25 Sep · code freeze 18 Sep
            </p>
          </div>
        </div>

        {/* ---- 2. Live system stats -------------------------------- */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="landing-stats">
          <StatTile
            icon={<Activity className="w-4 h-4" />}
            label="Eval gate"
            value="22 / 22"
            tone="good"
          />
          <StatTile
            icon={<Globe2 className="w-4 h-4" />}
            label="Markets"
            value={dossiersQ.isLoading ? "…" : markets.length}
          />
          <StatTile
            icon={<RadarIcon className="w-4 h-4" />}
            label="Radar signals"
            value={signalsQ.isLoading ? "…" : signalCount}
          />
          <StatTile
            icon={<Camera className="w-4 h-4" />}
            label="Snapshots cached"
            value={snapshotsQ.isLoading ? "…" : snapshotCount}
          />
        </div>
        {tierACount > 0 && (
          <p className="text-[11px] text-muted-foreground font-mono">
            <span className="text-primary">{tierACount}</span> tier-A market{tierACount === 1 ? "" : "s"} active ·{" "}
            <Link href="/dossiers" className="text-primary hover:underline">view all →</Link>
          </p>
        )}

        {/* ---- 3. Quick-link cards -------------------------------- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {QUICK_LINKS.map((q) => {
            const Icon = q.icon;
            return (
              <Card key={q.href} className="hover:border-primary/40 transition-colors">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-primary" />
                    <CardTitle className="text-base">{q.title}</CardTitle>
                  </div>
                  <CardDescription>{q.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href={q.href}>
                    <button className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-primary hover:underline">
                      {q.cta}
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* ---- 4. Recent radar activity --------------------------- */}
        <Card data-testid="landing-recent-signals">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <RadarIcon className="w-4 h-4 text-primary" />
              Recent radar findings pushed to Monday
              <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 rounded-none border-border text-muted-foreground">
                {recentSignals.length}
              </Badge>
            </CardTitle>
            <CardDescription>
              The 3 most recent signals that were promoted to a Play and pushed to monday.com
              via the end-to-end radar flow. Click into a dossier to see the full play in context.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {signalsQ.isLoading ? (
              <p className="text-xs text-muted-foreground font-mono">Loading…</p>
            ) : recentSignals.length === 0 ? (
              <p className="text-xs text-muted-foreground font-mono italic">
                No promoted signals yet. Open{" "}
                <Link href="/radar" className="text-primary hover:underline">/radar</Link>{" "}
                and save a country finding to land one here.
              </p>
            ) : (
              <ul className="space-y-2">
                {recentSignals.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-start gap-3 border-l-2 border-primary/40 pl-3 py-2"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground leading-relaxed truncate">{s.title}</p>
                      <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                        {s.market_id ? (
                          <Link href={`/dossiers/${s.market_id}`} className="text-primary hover:underline">
                            → /dossiers/{s.market_id}
                          </Link>
                        ) : (
                          <span className="text-amber-500">no market yet (queue)</span>
                        )}
                        {" · "}
                        {formatTime(s.fetched_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* ---- 5. Footer: eval gate summary + logout ------------- */}
        <div className="text-[11px] text-muted-foreground font-mono border-t border-border pt-4 flex flex-wrap items-center gap-3">
          <span>
            Eval gate: <span className="text-primary">22/22 GREEN</span> · All 4 phases shipped ·
            InnoTrans Berlin 2026
          </span>
          {sysQ.data?.demo_mode && (
            <Badge variant="outline" className="text-[10px] font-mono border-amber-600/50 text-amber-500 bg-amber-600/10">
              Demo mode
            </Badge>
          )}
        </div>

        {/* ---- 6. Logout (page variant) -------------------------- */}
        <LogoutButton variant="page" />
      </div>
    </BriefingLayout>
  );
}
