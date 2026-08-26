// =============================================================================
// Dossier detail — one market, full breakdown.
//
// Layout: 5-question block (the doctrine), yards list, org/people network,
// posture history, sources. Every fact is tagged with a [V]/[O]/[I] confidence
// badge so the operator can trust the briefing.
// =============================================================================

import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { BriefingLayout } from "@/components/BriefingLayout";
import { getDossier } from "@/lib/v1-api";
import {
  ArrowLeft,
  ExternalLink,
  Building2,
  Train,
  Users,
  MapPin,
  Calendar,
  Swords,
  Shield,
  Target,
  Clock,
  Trophy,
  FileText,
  Linkedin,
  Copy,
  Check,
  Loader2,
} from "lucide-react";
import type { SourcedFact, Yard, Org, Person, Tier, Posture, PersonInterest } from "@workspace/api-client-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

// -----------------------------------------------------------------------------
// Shared atoms
// -----------------------------------------------------------------------------

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

const CONFIDENCE_STYLES: Record<SourcedFact["confidence"], string> = {
  V: "border-green-600/50 text-green-500 bg-green-600/10",
  O: "border-amber-600/50 text-amber-500 bg-amber-600/10",
  I: "border-slate-600/50 text-slate-400 bg-slate-600/10",
};

function ConfidenceBadge({ confidence }: { confidence: SourcedFact["confidence"] }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px] font-mono px-1 py-0 rounded-none border",
        CONFIDENCE_STYLES[confidence],
      )}
      title={
        confidence === "V"
          ? "Primary source (operator domain, tender portal, signed doc) or ≥2 independent sources"
          : confidence === "O"
            ? "Single secondary source (press, aggregator)"
            : "Model inference — see inputs"
      }
    >
      [{confidence}]
    </Badge>
  );
}

function SourceLink({ url, title, retrieved_at }: { url: string; title: string; retrieved_at: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  const isInternal = url.startsWith("internal://");
  if (isInternal) {
    return (
      <div className="text-[10px] text-muted-foreground/70 font-mono inline-flex items-center gap-1">
        <span className="text-amber-500">internal:</span>
        <span>{url.replace("internal://", "")}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 text-[10px] text-muted-foreground/70 font-mono">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-primary inline-flex items-center gap-1 truncate"
        title={`${title} — retrieved ${retrieved_at}`}
      >
        <ExternalLink className="w-2.5 h-2.5 shrink-0" />
        <span className="truncate max-w-[200px]">{title}</span>
      </a>
      <button onClick={handleCopy} className="hover:text-white inline-flex items-center" title="Copy URL">
        {copied ? <Check className="w-2.5 h-2.5 text-green-500" /> : <Copy className="w-2.5 h-2.5" />}
      </button>
    </div>
  );
}

function SourcedBlock({ label, fact, icon }: { label: string; fact: SourcedFact; icon: React.ReactNode }) {
  return (
    <div className="border-l-2 border-primary/40 pl-3 py-2 space-y-1.5">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <ConfidenceBadge confidence={fact.confidence} />
      </div>
      <p className="text-sm text-foreground leading-relaxed">{fact.value}</p>
      <SourceLink url={fact.source_url} title={fact.source_url} retrieved_at={fact.retrieved_at} />
    </div>
  );
}

// -----------------------------------------------------------------------------
// 5-question block
// -----------------------------------------------------------------------------

const FIVE_QUESTIONS = [
  { key: "know_yourself", label: "Know yourself", icon: <Shield className="w-3 h-3 text-primary" /> },
  { key: "know_the_enemy", label: "Know the enemy", icon: <Swords className="w-3 h-3 text-primary" /> },
  { key: "terrain", label: "Terrain", icon: <MapPin className="w-3 h-3 text-primary" /> },
  { key: "timing", label: "Timing", icon: <Clock className="w-3 h-3 text-primary" /> },
  { key: "win_before_battle", label: "Win before the battle", icon: <Trophy className="w-3 h-3 text-primary" /> },
] as const;

type FiveQKey = (typeof FIVE_QUESTIONS)[number]["key"];

// -----------------------------------------------------------------------------
// Sub-sections
// -----------------------------------------------------------------------------

function YardsTable({ yards }: { yards: Yard[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Train className="w-4 h-4 text-primary" />
          Yards
          <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 rounded-none border-border text-muted-foreground">
            {yards.length}
          </Badge>
        </CardTitle>
        <CardDescription>Marshalling yards in this market with their brake tech and last modernization.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-left text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-3">Yard</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Brake tech</th>
                <th className="py-2 pr-3">Last modernized</th>
              </tr>
            </thead>
            <tbody>
              {yards.map((yard) => (
                <tr key={yard.id} className="border-b border-border/40 hover:bg-secondary/20">
                  <td className="py-2.5 pr-3">
                    <div className="font-semibold text-foreground">{yard.name}</div>
                    {yard.geo && yard.geo.lat != null && yard.geo.lon != null && (
                      <div className="text-[10px] text-muted-foreground font-mono">
                        {yard.geo.lat.toFixed(2)}, {yard.geo.lon.toFixed(2)}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 pr-3">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] font-mono px-1.5 py-0 rounded-none border",
                        yard.status === "modernizing"
                          ? "border-amber-600/50 text-amber-400 bg-amber-600/10"
                          : yard.status === "active"
                            ? "border-green-600/50 text-green-400 bg-green-600/10"
                            : "border-slate-600/50 text-slate-400 bg-slate-600/10",
                      )}
                    >
                      {yard.status}
                    </Badge>
                  </td>
                  <td className="py-2.5 pr-3 max-w-md">
                    <div className="text-foreground">{yard.brake_tech?.value ?? "—"}</div>
                    {yard.brake_tech && <ConfidenceBadge confidence={yard.brake_tech.confidence} />}
                  </td>
                  <td className="py-2.5 pr-3 max-w-md">
                    <div className="text-foreground">{yard.last_modernized?.value ?? "—"}</div>
                    {yard.last_modernized && <ConfidenceBadge confidence={yard.last_modernized.confidence} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function PersonCard({ person }: { person: Person }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    if (person.linkedin_url) {
      navigator.clipboard.writeText(person.linkedin_url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  return (
    <div className="border border-border bg-background/40 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{person.name}</p>
          <p className="text-xs text-primary font-mono mt-0.5">{person.role}</p>
        </div>
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] font-mono px-1.5 py-0 rounded-none border",
            person.relationship_status === "active"
              ? "border-green-600/50 text-green-400 bg-green-600/10"
              : person.relationship_status === "contacted"
                ? "border-amber-600/50 text-amber-400 bg-amber-600/10"
                : "border-slate-600/50 text-slate-400 bg-slate-600/10",
          )}
        >
          {person.relationship_status}
        </Badge>
      </div>

      {person.interests.length > 0 && (
        <div className="space-y-2 pt-1">
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Topics to talk about
          </p>
          {person.interests.map((interest: PersonInterest, idx) => (
            <div key={`${interest.fact.source_url}-${idx}`} className="border-l-2 border-primary/40 pl-2 py-1 space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[9px] font-mono uppercase tracking-wider border-border/60 text-muted-foreground">
                  {interest.kind.replace(/_/g, " ")}
                </Badge>
                <ConfidenceBadge confidence={interest.fact.confidence} />
              </div>
              <p className="text-xs text-foreground leading-relaxed">{interest.summary}</p>
              <SourceLink url={interest.fact.source_url} title={interest.fact.source_url} retrieved_at={interest.fact.retrieved_at} />
            </div>
          ))}
        </div>
      )}

      {person.linkedin_url && (
        <div className="flex flex-wrap gap-2 pt-1">
          <a
            href={person.linkedin_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-mono px-2 py-1 border border-blue-600/50 text-blue-400 hover:bg-blue-600/10 transition-colors"
          >
            <Linkedin className="w-3 h-3" /> Open LinkedIn
          </a>
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 text-xs font-mono px-2 py-1 border border-border text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors"
          >
            {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
            {copied ? "Copied" : "Copy URL"}
          </button>
        </div>
      )}
    </div>
  );
}

function OrgNetwork({
  orgs,
  peopleByOrg,
}: {
  orgs: Org[];
  peopleByOrg: { org: Org; people: Person[] }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="w-4 h-4 text-primary" />
          Actor network
          <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 rounded-none border-border text-muted-foreground">
            {orgs.length} orgs · {peopleByOrg.reduce((sum, x) => sum + x.people.length, 0)} people
          </Badge>
        </CardTitle>
        <CardDescription>Authorities, competitors, and consultants — with the people who matter.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {peopleByOrg.map(({ org, people }) => (
          <div key={org.id} className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] font-mono px-1.5 py-0 rounded-none border uppercase tracking-wider",
                  org.type === "authority"
                    ? "border-primary/50 text-primary bg-primary/10"
                    : org.type === "competitor"
                      ? "border-red-600/50 text-red-400 bg-red-600/10"
                      : "border-blue-600/50 text-blue-400 bg-blue-600/10",
                )}
              >
                {org.type}
              </Badge>
              <h3 className="text-sm font-semibold text-foreground">{org.name}</h3>
              {org.innotrans_target && (
                <Badge variant="outline" className="text-[9px] font-mono px-1.5 py-0 rounded-none border-border text-muted-foreground">
                  InnoTrans target
                </Badge>
              )}
            </div>
            {people.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No named people yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {people.map((p) => (
                  <PersonCard key={p.id} person={p} />
                ))}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Page
// -----------------------------------------------------------------------------

export default function DossierDetail() {
  const [, params] = useRoute<{ id: string }>("/dossiers/:id");
  const id = params?.id ?? "";
  const { data, isLoading, error } = useQuery({
    queryKey: ["dossier", id],
    queryFn: () => getDossier(id),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <BriefingLayout>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading dossier…
        </div>
      </BriefingLayout>
    );
  }
  if (error) {
    return (
      <BriefingLayout>
        <div className="space-y-4">
          <Link href="/dossiers" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> All dossiers
          </Link>
          <Card>
            <CardContent className="pt-6 text-sm text-red-400">
              Failed to load dossier: {error instanceof Error ? error.message : String(error)}
            </CardContent>
          </Card>
        </div>
      </BriefingLayout>
    );
  }
  if (!data) {
    return (
      <BriefingLayout>
        <div className="space-y-4">
          <Link href="/dossiers" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> All dossiers
          </Link>
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">Dossier not found.</CardContent>
          </Card>
        </div>
      </BriefingLayout>
    );
  }

  const { market, yards, people_by_org } = data;
  const posture_history = market.posture_history;
  const sources = market.sources;
  const fiveQ = market.five_questions as Record<FiveQKey, SourcedFact>;

  return (
    <BriefingLayout>
      <div className="space-y-6">
        {/* Back link */}
        <Link href="/dossiers" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" /> All dossiers
        </Link>

        {/* Page header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              <h1 className="text-2xl font-semibold text-foreground">{market.country_name}</h1>
              <span className="text-xs font-mono text-muted-foreground uppercase">{market.country_iso}</span>
            </div>
            <p className="text-sm text-foreground/80 mt-2 max-w-2xl">{market.verdict.value}</p>
            <div className="flex items-center gap-1.5 mt-2">
              <SourceLink url={market.verdict.source_url} title={market.verdict.source_url} retrieved_at={market.verdict.retrieved_at} />
              <ConfidenceBadge confidence={market.verdict.confidence} />
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <Badge variant="outline" className={cn("text-[10px] font-mono px-1.5 py-0 rounded-none border", TIER_STYLES[market.tier])}>
              Tier {market.tier}
            </Badge>
            <Badge variant="outline" className={cn("text-[10px] font-mono px-1.5 py-0 rounded-none border", POSTURE_STYLES[market.posture])}>
              {market.posture}
            </Badge>
            <div className="text-[10px] font-mono text-muted-foreground mt-1 text-right">
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {market.window_opens?.slice(0, 10)} → {market.window_closes?.slice(0, 10)}
              </div>
            </div>
          </div>
        </div>

        {/* 5-question block */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="w-4 h-4 text-primary" />
              The 5 questions
            </CardTitle>
            <CardDescription>
              Doctrine-grade answers. Every fact tagged with a confidence badge and a source.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {FIVE_QUESTIONS.map((q) => (
              <SourcedBlock key={q.key} label={q.label} fact={fiveQ[q.key]} icon={q.icon} />
            ))}
          </CardContent>
        </Card>

        {/* Yards */}
        <YardsTable yards={yards} />

        {/* Org + People network */}
        <OrgNetwork orgs={data.orgs} peopleByOrg={people_by_org} />

        {/* Posture history + sources */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Posture history</CardTitle>
              <CardDescription>How our read on this market has changed.</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2">
                {posture_history.map((entry, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-xs">
                    <span className="text-muted-foreground font-mono shrink-0 w-24">
                      {new Date(entry.ts).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] font-mono px-1.5 py-0 rounded-none border shrink-0",
                        POSTURE_STYLES[entry.posture as Posture] ?? "border-slate-600/50 text-slate-400",
                      )}
                    >
                      {entry.posture}
                    </Badge>
                    <span className="text-foreground/80 flex-1">
                      <span className="text-muted-foreground">by {entry.actor} —</span> {entry.reason}
                    </span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="w-4 h-4 text-primary" />
                Sources
                <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 rounded-none border-border text-muted-foreground">
                  {sources.length}
                </Badge>
              </CardTitle>
              <CardDescription>Primary + secondary references that back this dossier.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {sources.map((s, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs">
                    <ExternalLink className="w-3 h-3 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-foreground hover:text-primary truncate block"
                      >
                        {s.title}
                      </a>
                      <p className="text-[10px] text-muted-foreground font-mono truncate">{s.url}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <Separator className="bg-border" />
        <p className="text-[11px] text-muted-foreground font-mono">
          [V] primary source · [O] single secondary · [I] model inference. The platform never
          renders a fact without a resolvable source.
        </p>
      </div>
    </BriefingLayout>
  );
}
