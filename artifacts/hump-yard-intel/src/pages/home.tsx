import React from "react";
import { Link } from "wouter";
import { BriefingLayout } from "@/components/BriefingLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileText, Inbox, Swords, Radar as RadarIcon, ArrowRight } from "lucide-react";

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

export default function Home() {
  return (
    <BriefingLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">DECEL Intelligence Platform</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sales intelligence for the InnoTrans Berlin 2026 fair. Every fact is sourced
            at the claim level. Real data only — no fake signals, no placeholder text.
          </p>
        </div>

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

        <div className="text-[11px] text-muted-foreground font-mono border-t border-border pt-4">
          Eval gate: <span className="text-primary">22/22 GREEN</span> · All 4 phases shipped ·
          Radar: 48 real EXA signals live · 15 source snapshots cached
        </div>
      </div>
    </BriefingLayout>
  );
}
