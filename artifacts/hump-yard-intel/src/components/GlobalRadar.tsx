import React, { useState, useEffect, useRef } from "react";
import { useSearchCountry, useGetCountries } from "@workspace/api-client-react";
import type { CountryResult } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Play, Square, Download, Activity, Radar, HelpCircle } from "lucide-react";
import { exportToCsv } from "@/lib/csv";
import { ResultCard } from "./ResultCard";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { getMarketOpportunity, PRIORITY_CONFIG, formatMSEK } from "@/lib/marketData";

const TIER_DEFINITIONS = {
  A: {
    label: "Active Modernization",
    description: "Procurement is live or imminent — active tenders for retarder systems or hump automation detected.",
    action: "Send BD resources immediately.",
    color: "border-primary text-primary bg-primary/5",
    cardColor: "border-primary bg-primary/10 text-primary",
  },
  B: {
    label: "Active, Low Spend",
    description: "Confirmed hump yards operating, but limited recent procurement. Good for relationship-building.",
    action: "Begin pipeline development.",
    color: "border-amber-500 text-amber-500 bg-amber-500/5",
    cardColor: "border-amber-500 bg-amber-500/10 text-amber-500",
  },
  C: {
    label: "Legacy Base",
    description: "Hump yard infrastructure exists but no recent modernization detected. Monitor annually.",
    action: "Lower short-term priority.",
    color: "border-blue-500 text-blue-500 bg-blue-500/5",
    cardColor: "border-blue-500 bg-blue-500/10 text-blue-500",
  },
  D: {
    label: "No Humps Confirmed",
    description: "No active hump yard infrastructure found. May reflect genuine absence or a data gap.",
    action: "Do not allocate BD resources without manual verification.",
    color: "border-muted text-muted-foreground bg-muted/5",
    cardColor: "border-muted bg-muted/10 text-muted-foreground",
  },
};

export function GlobalRadar() {
  const { data: countryData, isLoading: isLoadingCountries } = useGetCountries();
  const searchCountryMutation = useSearchCountry();

  const [isScanning, setIsScanning] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<CountryResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<CountryResult | null>(null);

  const countries = countryData?.countries || [];
  const total = countries.length;
  const progress = total > 0 ? (currentIndex / total) * 100 : 0;

  const isScanningRef = useRef(isScanning);
  isScanningRef.current = isScanning;

  const scanNext = async () => {
    if (!isScanningRef.current || currentIndex >= total) {
      setIsScanning(false);
      return;
    }

    const country = countries[currentIndex];

    try {
      const result = await searchCountryMutation.mutateAsync({ data: { country } });
      setResults((prev) => [...prev, result]);
    } catch {
      setResults((prev) => [
        ...prev,
        {
          country,
          verdict: "Uncertain",
          confidence: "Low",
          tier: "D",
          summary: "Failed to retrieve data.",
          yards: [],
          operator: null,
          lastModernization: null,
          procurementPortal: null,
          contactEntryPoint: null,
          procurementTenders: [],
          technicalContacts: [],
          keyContacts: [],
          sources: [],
          error: "Scan failed",
        },
      ]);
    }

    setCurrentIndex((prev) => prev + 1);
  };

  useEffect(() => {
    if (isScanning && currentIndex < total) {
      scanNext();
    } else if (currentIndex >= total && total > 0) {
      setIsScanning(false);
    }
  }, [isScanning, currentIndex, total]);

  const handleStartStop = () => {
    if (currentIndex >= total && !isScanning) {
      setCurrentIndex(0);
      setResults([]);
      setIsScanning(true);
    } else {
      setIsScanning(!isScanning);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">

      {/* Control Panel */}
      <Card className="border-border bg-card rounded-none">
        <CardContent className="p-6 flex flex-col md:flex-row items-center gap-6 justify-between">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <Button
              onClick={handleStartStop}
              disabled={isLoadingCountries || total === 0}
              variant={isScanning ? "destructive" : "default"}
              className="rounded-none font-mono uppercase tracking-wider min-w-[200px]"
            >
              {isScanning ? (
                <><Square className="w-4 h-4 mr-2" /> Halt Scan</>
              ) : currentIndex >= total && total > 0 ? (
                <><Radar className="w-4 h-4 mr-2" /> Restart Radar</>
              ) : (
                <><Play className="w-4 h-4 mr-2" /> Run Global Radar Scan</>
              )}
            </Button>

            <Button
              onClick={() => exportToCsv(results, "global-radar-intel.csv")}
              disabled={results.length === 0}
              variant="outline"
              className="rounded-none border-border font-mono text-xs uppercase"
            >
              <Download className="w-4 h-4 mr-2" /> Export All ({results.length})
            </Button>
          </div>

          <div className="flex-1 w-full max-w-md space-y-2">
            <div className="flex justify-between text-xs font-mono text-muted-foreground">
              <span className="uppercase flex items-center gap-2">
                {isScanning && <Activity className="w-3 h-3 text-primary animate-pulse" />}
                {isScanning
                  ? `Scanning: ${countries[currentIndex] ?? "..."}`
                  : currentIndex >= total && total > 0
                  ? "Scan complete"
                  : "Idle"}
              </span>
              <span>{currentIndex} / {total} Targets</span>
            </div>
            <Progress value={progress} className="h-2 rounded-none bg-border/50 [&>div]:bg-primary" />
          </div>
        </CardContent>
      </Card>

      {/* Tiered Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {(["A", "B", "C", "D"] as const).map((tier) => {
          const def = TIER_DEFINITIONS[tier];
          const tierResults = results.filter((r) => r.tier === tier);
          return (
            <div key={tier} className="space-y-3">
              {/* Tier header with tooltip */}
              <div className={`p-2 border-l-2 font-mono text-sm uppercase tracking-wider flex items-center justify-between ${def.color}`}>
                <div className="flex items-center gap-1.5">
                  <span>Tier {tier}</span>
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help">
                          <HelpCircle className="w-3.5 h-3.5 opacity-60 hover:opacity-100 transition-opacity" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent
                        side="bottom"
                        className="max-w-xs rounded-none border border-border bg-card text-card-foreground p-3 shadow-xl"
                      >
                        <p className="font-mono text-xs font-semibold mb-1">{def.label}</p>
                        <p className="text-xs text-muted-foreground leading-relaxed mb-1.5">
                          {def.description}
                        </p>
                        <p className="text-xs font-mono text-card-foreground">{def.action}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <span className="text-xs opacity-70">{tierResults.length}</span>
              </div>

              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                {tierResults.map((res, i) => {
                  const mkt = getMarketOpportunity(res.country);
                  const mktCfg = mkt ? PRIORITY_CONFIG[mkt.priority] : null;
                  return (
                    <Dialog key={i}>
                      <DialogTrigger asChild>
                        <button
                          className={`w-full text-left p-3 border text-sm font-medium transition-all hover:-translate-y-0.5 hover:shadow-md ${def.cardColor}`}
                        >
                          <div className="flex justify-between items-center">
                            <span className="truncate">{res.country}</span>
                            <span className="text-xs font-mono opacity-70">{res.verdict}</span>
                          </div>
                          {mkt && mktCfg && (
                            <div className="flex items-center justify-between mt-1 gap-1">
                              <span className={`text-[9px] font-mono font-semibold ${mktCfg.color}`}>
                                {mktCfg.label}
                              </span>
                              {mkt.activeYards > 0 && (
                                <span className="text-[9px] font-mono opacity-60">
                                  ~{mkt.activeYards} yards · {formatMSEK(mkt.potentialValueMaxMSEK)} max
                                </span>
                              )}
                            </div>
                          )}
                          {res.keyContacts && res.keyContacts.length > 0 && (
                            <p className="text-[10px] font-mono opacity-60 mt-0.5">
                              {res.keyContacts.length} contact{res.keyContacts.length !== 1 ? "s" : ""} identified
                            </p>
                          )}
                        </button>
                      </DialogTrigger>
                      <DialogContent className="max-w-5xl border-border bg-background p-0 rounded-none h-[90vh] overflow-y-auto">
                        <ResultCard result={res} />
                      </DialogContent>
                    </Dialog>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
