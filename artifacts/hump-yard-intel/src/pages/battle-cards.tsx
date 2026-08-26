// =============================================================================
// Battle cards — pre-rendered briefing cards per org. Two kinds:
//   - "relationship": buyer / authority / spec-writer
//   - "recon": competitor / market context
//
// Doctrine-tagged with a version. The operator carries these on the phone to
// the meeting — no LLM in battle mode (§11.4).
// =============================================================================

import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BriefingLayout } from "@/components/BriefingLayout";
import { listBattleCards } from "@/lib/v1-api";
import {
  Swords,
  ArrowLeft,
  ExternalLink,
  Users,
  Shield,
  AlertTriangle,
  HelpCircle,
  Copy,
  Check,
  Loader2,
  Sparkles,
} from "lucide-react";
import type { BattleCard } from "@workspace/api-client-react";

function KindBadge({ kind }: { kind: BattleCard["kind"] }) {
  if (kind === "relationship") {
    return (
      <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 rounded-none border-primary/50 text-primary bg-primary/10 uppercase tracking-wider">
        <Shield className="w-2.5 h-2.5 mr-1" />
        Relationship
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 rounded-none border-red-600/50 text-red-400 bg-red-600/10 uppercase tracking-wider">
      <Swords className="w-2.5 h-2.5 mr-1" />
      Recon
    </Badge>
  );
}

function CardListItem({ card, onClick }: { card: BattleCard; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left border border-border bg-card hover:border-primary/40 transition-colors p-4 space-y-2"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{card.who_they_are.split(" — ")[0]}</p>
          <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">org/{card.org_id}</p>
        </div>
        <KindBadge kind={card.kind} />
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2">{card.why_matters}</p>
    </button>
  );
}

function CardView({ card }: { card: BattleCard }) {
  const [copied, setCopied] = useState(false);
  const copyAll = () => {
    const text = [
      `WHO: ${card.who_they_are}`,
      `WHY: ${card.why_matters}`,
      `TRAP: ${card.trap_to_avoid}`,
      card.suggested_questions.length ? `\nQUESTIONS:\n${card.suggested_questions.map((q, i) => `  ${i + 1}. ${q}`).join("\n")}` : "",
      card.recon_what_to_observe?.length ? `\nRECON:\n${card.recon_what_to_observe.map((r, i) => `  ${i + 1}. ${r}`).join("\n")}` : "",
    ].join("\n\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <KindBadge kind={card.kind} />
              <CardTitle className="text-base">org/{card.org_id}</CardTitle>
              <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 rounded-none border-border text-muted-foreground">
                doctrine v{card.doctrine_version}
              </Badge>
            </div>
            <p className="text-[10px] text-muted-foreground font-mono">
              Updated {new Date(card.doctrine_updated_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} by {card.doctrine_updated_by}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={copyAll} className="font-mono text-xs uppercase tracking-wider">
            {copied ? <Check className="w-3 h-3 mr-1 text-green-500" /> : <Copy className="w-3 h-3 mr-1" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Who / Why */}
        <div className="space-y-3">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Who they are</p>
            <p className="text-sm text-foreground leading-relaxed">{card.who_they_are}</p>
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Why this matters</p>
            <p className="text-sm text-foreground leading-relaxed">{card.why_matters}</p>
          </div>
        </div>

        {/* Trap */}
        {card.trap_to_avoid && (
          <div className="border-l-2 border-amber-600/60 bg-amber-600/5 pl-3 py-2 space-y-1">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3 text-amber-500" />
              <p className="text-[10px] font-mono uppercase tracking-wider text-amber-500">Trap to avoid</p>
            </div>
            <p className="text-sm text-foreground leading-relaxed">{card.trap_to_avoid}</p>
          </div>
        )}

        {/* Suggested questions OR recon observations */}
        {card.kind === "relationship" && card.suggested_questions.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <HelpCircle className="w-3 h-3 text-primary" />
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Suggested questions</p>
            </div>
            <ol className="space-y-1.5">
              {card.suggested_questions.map((q, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-foreground">
                  <span className="text-muted-foreground font-mono shrink-0 w-5">{idx + 1}.</span>
                  <span className="leading-relaxed">{q}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {card.kind === "recon" && card.recon_what_to_observe && card.recon_what_to_observe.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className="w-3 h-3 text-red-500" />
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">What to observe</p>
            </div>
            <ol className="space-y-1.5">
              {card.recon_what_to_observe.map((r, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-foreground">
                  <span className="text-muted-foreground font-mono shrink-0 w-5">{idx + 1}.</span>
                  <span className="leading-relaxed">{r}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Known people (refs only — full detail on the dossier) */}
        {card.known_people.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Users className="w-3 h-3 text-primary" />
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Known people</p>
            </div>
            <ul className="space-y-1.5">
              {card.known_people.map((p, idx) => (
                <li key={idx} className="text-xs text-foreground flex items-center gap-2">
                  <span className="font-mono text-muted-foreground">{p.person_id}</span>
                  <span>—</span>
                  <span>{p.role}</span>
                  <Badge variant="outline" className="text-[9px] font-mono px-1 py-0 rounded-none border-border text-muted-foreground">
                    {p.relationship_status}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Sources */}
        {card.sources.length > 0 && (
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">Sources</p>
            <ul className="space-y-1">
              {card.sources.map((s, idx) => (
                <li key={idx} className="flex items-center gap-1.5 text-xs">
                  <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0" />
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground hover:text-primary truncate"
                  >
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function BattleCardsPage() {
  const [, params] = useRoute<{ orgId: string }>("/battle-cards/:orgId");
  const { data, isLoading, error } = useQuery({
    queryKey: ["battle-cards"],
    queryFn: listBattleCards,
  });

  const [selected, setSelected] = useState<string | null>(null);
  const orgId = params?.orgId ?? selected ?? null;
  const card = data?.cards.find((c) => c.org_id === orgId) ?? null;

  if (isLoading) {
    return (
      <BriefingLayout>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading battle cards…
        </div>
      </BriefingLayout>
    );
  }
  if (error) {
    return (
      <BriefingLayout>
        <Card>
          <CardContent className="pt-6 text-sm text-red-400">
            Failed to load battle cards: {error instanceof Error ? error.message : String(error)}
          </CardContent>
        </Card>
      </BriefingLayout>
    );
  }

  const cards = data?.cards ?? [];
  const relationshipCards = cards.filter((c) => c.kind === "relationship");
  const reconCards = cards.filter((c) => c.kind === "recon");

  return (
    <BriefingLayout>
      <div className="space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Swords className="w-5 h-5 text-primary" />
            Battle cards
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pre-rendered briefing cards. Doctrine-versioned. No LLM in battle mode (§11.4) —
            these are static so they work on airplane Wi-Fi.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          {/* List */}
          <div className="space-y-3">
            {relationshipCards.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  Relationship ({relationshipCards.length})
                </p>
                {relationshipCards.map((c) => (
                  <CardListItem
                    key={c.org_id}
                    card={c}
                    onClick={() => setSelected(c.org_id)}
                  />
                ))}
              </div>
            )}
            {reconCards.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  Recon ({reconCards.length})
                </p>
                {reconCards.map((c) => (
                  <CardListItem
                    key={c.org_id}
                    card={c}
                    onClick={() => setSelected(c.org_id)}
                  />
                ))}
              </div>
            )}
            {cards.length === 0 && (
              <Card>
                <CardContent className="pt-6 text-sm text-muted-foreground text-center">
                  No battle cards yet.
                </CardContent>
              </Card>
            )}
          </div>

          {/* Detail */}
          <div>
            {card ? (
              <div className="space-y-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelected(null)}
                  className="text-xs font-mono text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="w-3 h-3 mr-1" />
                  Back to list
                </Button>
                <CardView card={card} />
              </div>
            ) : (
              <Card>
                <CardContent className="pt-6 text-center space-y-2 min-h-[300px] flex flex-col items-center justify-center">
                  <Swords className="w-10 h-10 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Select a card to view the full briefing.</p>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    Doctrine is the operator's own. The platform stores it; you read it.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">How doctrine works</CardTitle>
            <CardDescription>
              Every card has a version number. When you (Cassin) update the doctrine, the
              previous version stays in the audit log. The platform records the diff and
              who edited it.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            <p>
              The static cards you see here are also what the offline PWA bundle ships with
              (W36, Sep 7–13). The phone has them even on the InnoTrans show floor.
            </p>
          </CardContent>
        </Card>
      </div>
    </BriefingLayout>
  );
}
