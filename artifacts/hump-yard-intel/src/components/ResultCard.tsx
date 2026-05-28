import React from "react";
import type { CountryResult } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { exportToCsv } from "@/lib/csv";
import { KeyContactsPanel } from "./KeyContactsPanel";
import {
  Download,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  MapPin,
  Search,
  HelpCircle,
} from "lucide-react";

const TIER_DEFINITIONS: Record<string, { label: string; description: string; action: string }> = {
  A: {
    label: "Active Modernization",
    description: "Procurement is live or imminent. Active tenders for retarder systems, hump automation, or yard upgrades detected.",
    action: "Send BD resources immediately.",
  },
  B: {
    label: "Active, Low Spend",
    description: "Confirmed hump yards operating, but limited recent procurement activity. Good for relationship-building.",
    action: "Monitor for budget announcements. Begin pipeline development.",
  },
  C: {
    label: "Legacy Base",
    description: "Hump yard infrastructure exists but no recent modernization detected. Lower short-term priority.",
    action: "Monitor annually. Infrastructure exists but upgrade cycle not imminent.",
  },
  D: {
    label: "No Humps Confirmed",
    description: "No active hump yard infrastructure found in indexed sources. May reflect genuine absence or data gap.",
    action: "Do not allocate BD resources without manual verification.",
  },
};

interface ResultCardProps {
  result: CountryResult;
}

function TierTooltip({ tier }: { tier: string }) {
  const def = TIER_DEFINITIONS[tier];
  if (!def) return null;
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center cursor-help">
            <HelpCircle className="w-3.5 h-3.5 text-muted-foreground hover:text-primary transition-colors ml-1" />
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          className="max-w-xs rounded-none border border-border bg-card text-card-foreground p-3 shadow-xl"
        >
          <p className="font-mono text-xs text-primary font-semibold mb-1">
            Tier {tier} — {def.label}
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed mb-1.5">{def.description}</p>
          <p className="text-xs font-mono text-card-foreground">{def.action}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function ResultCard({ result }: ResultCardProps) {
  const getVerdictColor = (verdict: string) => {
    switch (verdict) {
      case "Yes": return "bg-green-600 hover:bg-green-600 text-white";
      case "No": return "bg-red-600 hover:bg-red-600 text-white";
      case "Uncertain": return "bg-amber-500 hover:bg-amber-500 text-black";
      default: return "bg-gray-600 hover:bg-gray-600 text-white";
    }
  };

  const getTierLabel = (tier: string) => TIER_DEFINITIONS[tier]?.label ?? "Unknown";

  const getConfidenceColor = (conf: string) => {
    switch (conf) {
      case "High": return "text-green-500";
      case "Medium": return "text-amber-500";
      case "Low": return "text-red-500";
      default: return "text-gray-500";
    }
  };

  return (
    <Card className="border-border bg-card shadow-lg font-sans w-full max-w-4xl mx-auto">
      <CardHeader className="bg-card-border/30 border-b border-border p-6 flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-3xl font-bold tracking-tight text-white uppercase">{result.country}</h2>
            <Badge className={`text-xs px-2 py-0.5 rounded-sm font-mono border-none shadow-none ${getVerdictColor(result.verdict)}`}>
              {result.verdict === "Yes"
                ? "YES — Active Hump Yards"
                : result.verdict === "No"
                ? "NO — No Hump Yards"
                : "UNCERTAIN"}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <div className="flex items-center">
              <Badge variant="outline" className="border-primary/50 text-primary rounded-none font-mono">
                Tier {result.tier} : {getTierLabel(result.tier)}
              </Badge>
              <TierTooltip tier={result.tier} />
            </div>
            <div className="flex items-center gap-1.5 font-mono text-muted-foreground">
              <ShieldCheck className="w-4 h-4" />
              <span>
                Confidence:{" "}
                <strong className={getConfidenceColor(result.confidence)}>
                  {result.confidence}
                </strong>
              </span>
            </div>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="rounded-none border-border hover:bg-secondary shrink-0 font-mono text-xs uppercase"
          onClick={() =>
            exportToCsv(
              [result],
              `${result.country.toLowerCase().replace(/\s+/g, "-")}-hump-yard-intel.csv`
            )
          }
        >
          <Download className="w-3.5 h-3.5 mr-2" />
          Export CSV
        </Button>
      </CardHeader>

      <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column: Summary & Infrastructure */}
        <div className="md:col-span-2 space-y-6">
          <section>
            <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
              <Search className="w-3.5 h-3.5" /> Intelligence Summary
            </h3>
            <p className="text-sm leading-relaxed text-card-foreground border-l-2 border-primary/50 pl-3 py-1">
              {result.summary}
            </p>
          </section>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <section>
              <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">
                Identified Yards
              </h3>
              {result.yards && result.yards.length > 0 ? (
                <ul className="space-y-1">
                  {result.yards.map((yard: string, i: number) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                      <span>{yard}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-sm text-muted-foreground italic">No specific yards identified.</span>
              )}
            </section>

            <section>
              <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">
                Recent Tenders
              </h3>
              {result.procurementTenders && result.procurementTenders.length > 0 ? (
                <ul className="space-y-1 list-disc list-inside pl-2 text-sm">
                  {result.procurementTenders.map((tender: string, i: number) => (
                    <li key={i} className="text-card-foreground">{tender}</li>
                  ))}
                </ul>
              ) : (
                <span className="text-sm text-muted-foreground italic">No recent tenders found.</span>
              )}
            </section>
          </div>

          {result.error && (
            <div className="bg-destructive/10 border border-destructive/30 p-3 rounded-none flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
              <p className="text-sm text-destructive-foreground">{result.error}</p>
            </div>
          )}
        </div>

        {/* Right Column: Entity Details */}
        <div className="space-y-6 bg-card-border/10 p-4 border border-border">
          <section>
            <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">
              Operator / Authority
            </h3>
            <p className="text-sm font-medium">{result.operator || "Unknown"}</p>
          </section>

          <Separator className="bg-border" />

          <section>
            <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">
              Last Modernization
            </h3>
            <p className="text-sm">{result.lastModernization || "Unknown"}</p>
          </section>

          <Separator className="bg-border" />

          <section>
            <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">
              Procurement Portal
            </h3>
            {result.procurementPortal ? (
              <a
                href={result.procurementPortal}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex items-center gap-1.5 break-all"
              >
                {result.procurementPortal} <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <p className="text-sm text-muted-foreground italic">Not found</p>
            )}
          </section>
        </div>
      </CardContent>

      {/* Key Contacts Panel */}
      <KeyContactsPanel
        result={result}
        defaultOpen={result.tier === "A"}
      />

      {/* Sources */}
      {result.sources && result.sources.length > 0 && (
        <div className="border-t border-border bg-card-border/20 p-4 px-6">
          <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">
            Intelligence Sources
          </h3>
          <ul className="space-y-2">
            {result.sources.map(
              (
                source: {
                  url: string;
                  title: string;
                  publishedDate: string | null;
                  snippet: string | null;
                },
                i: number
              ) => (
                <li key={i} className="text-xs">
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary transition-colors flex items-start gap-2"
                  >
                    <ExternalLink className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span className="truncate">
                      {source.title || source.url}{" "}
                      {source.publishedDate && `(${source.publishedDate})`}
                    </span>
                  </a>
                </li>
              )
            )}
          </ul>
        </div>
      )}
    </Card>
  );
}
