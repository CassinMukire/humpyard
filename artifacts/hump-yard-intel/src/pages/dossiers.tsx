// =============================================================================
// Dossiers — list view. v1 = one row per dossier market.
//
// W35 demo: only Poland (PL) is in the seed. Germany + Middle Corridor are
// watchlist+ blocks (hand-curated) and ship in October for automated depth.
// =============================================================================

import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BriefingLayout } from "@/components/BriefingLayout";
import { listDossiers } from "@/lib/v1-api";
import { ArrowRight, MapPin, Calendar, FileText, Inbox, Swords } from "lucide-react";
import type { Tier, Posture } from "@workspace/api-client-react";

const TIER_STYLES: Record<Tier, string> = {
  A: "bg-primary/20 text-primary border-primary/40",
  B: "bg-blue-600/20 text-blue-400 border-blue-600/40",
  C: "bg-slate-600/20 text-slate-400 border-slate-600/40",
  ANTI: "bg-red-600/20 text-red-400 border-red-600/40",
};

const POSTURE_STYLES: Record<Posture, string> = {
  ENGAGE: "bg-green-600/20 text-green-400 border-green-600/40",
  WARMUP: "bg-amber-600/20 text-amber-400 border-amber-600/40",
  WATCH: "bg-slate-600/20 text-slate-400 border-slate-600/40",
  IGNORE: "bg-slate-700/20 text-slate-500 border-slate-700/40",
  WAR: "bg-red-600/20 text-red-400 border-red-600/40",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function VerdictSnippet({ value, maxLength = 200 }: { value: string; maxLength?: number }) {
  const snippet = value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
  return <p className="text-xs text-muted-foreground leading-relaxed">{snippet}</p>;
}

export default function Dossiers() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["dossiers"],
    queryFn: listDossiers,
  });

  return (
    <BriefingLayout>
      <div className="space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Dossiers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Country-level intelligence. Each dossier has the 5-question block, the yards,
            and the people who write the spec. Click through to see what's sourced.
          </p>
        </div>

        {/* Loading / error */}
        {isLoading && (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">Loading dossiers…</CardContent>
          </Card>
        )}
        {error && (
          <Card>
            <CardContent className="pt-6 text-sm text-red-400">
              Failed to load dossiers: {error instanceof Error ? error.message : String(error)}
            </CardContent>
          </Card>
        )}

        {/* Dossier list */}
        {data?.markets && data.markets.length === 0 && (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              No dossiers yet. Run a country scan to create one.
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4">
          {data?.markets.map((market) => (
            <Card key={market.id} className="hover:border-primary/40 transition-colors">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-primary" />
                      <CardTitle className="text-lg">{market.country_name}</CardTitle>
                      <span className="text-xs font-mono text-muted-foreground uppercase">
                        {market.country_iso}
                      </span>
                    </div>
                    <VerdictSnippet value={market.verdict.value} />
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-mono px-1.5 py-0 rounded-none border ${TIER_STYLES[market.tier]}`}
                    >
                      Tier {market.tier}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-mono px-1.5 py-0 rounded-none border ${POSTURE_STYLES[market.posture]}`}
                    >
                      {market.posture}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Window */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      Tender window
                    </div>
                    <p className="text-xs text-foreground font-mono">
                      {formatDate(market.window_opens)} → {formatDate(market.window_closes)}
                    </p>
                  </div>
                  {/* Sources */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      <FileText className="w-3 h-3" />
                      Sources
                    </div>
                    <p className="text-xs text-foreground font-mono">
                      {market.sources.length} linked
                    </p>
                  </div>
                  {/* Posture history */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      <Swords className="w-3 h-3" />
                      Posture
                    </div>
                    <p className="text-xs text-foreground font-mono">
                      {market.posture_history.length} change{market.posture_history.length === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-end">
                  <Link href={`/dossiers/${market.id}`}>
                    <Button variant="default" size="sm" className="font-mono text-xs uppercase tracking-wider">
                      Open dossier
                      <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Help footer */}
        <div className="text-[11px] text-muted-foreground font-mono border-t border-border pt-4 flex items-center gap-2">
          <Inbox className="w-3 h-3" />
          <span>
            Each dossier pulls from /api/v1/dossiers/:id. Battle cards and review queue items are
            linked per-org on the dossier detail page.
          </span>
        </div>
      </div>
    </BriefingLayout>
  );
}
