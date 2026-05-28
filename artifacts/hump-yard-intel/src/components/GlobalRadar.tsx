import React, { useState, useEffect, useRef } from "react";
import { useSearchCountry, useGetCountries } from "@workspace/api-client-react";
import { CountryResult } from "@workspace/api-client-react/src/generated/api.schemas";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Square, Download, Activity, Radar } from "lucide-react";
import { exportToCsv } from "@/lib/csv";
import { ResultCard } from "./ResultCard";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

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
      setResults(prev => [...prev, result]);
    } catch (err) {
      // Create a fallback result on error so it doesn't block the radar
      setResults(prev => [...prev, {
        country,
        verdict: 'Uncertain',
        confidence: 'Low',
        tier: 'D',
        summary: 'Failed to retrieve data.',
        yards: [],
        operator: null,
        lastModernization: null,
        procurementPortal: null,
        contactEntryPoint: null,
        procurementTenders: [],
        technicalContacts: [],
        sources: [],
        error: 'Scan failed'
      }]);
    }

    setCurrentIndex(prev => prev + 1);
  };

  useEffect(() => {
    if (isScanning && currentIndex < total) {
      scanNext();
    } else if (currentIndex >= total) {
      setIsScanning(false);
    }
  }, [isScanning, currentIndex, total]);

  const handleStartStop = () => {
    if (currentIndex >= total && !isScanning) {
      // Reset
      setCurrentIndex(0);
      setResults([]);
      setIsScanning(true);
    } else {
      setIsScanning(!isScanning);
    }
  };

  const handleExportAll = () => {
    exportToCsv(results, "global-radar-intel.csv");
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'A': return 'border-primary bg-primary/10 text-primary';
      case 'B': return 'border-amber-500 bg-amber-500/10 text-amber-500';
      case 'C': return 'border-blue-500 bg-blue-500/10 text-blue-500';
      case 'D': return 'border-muted bg-muted/10 text-muted-foreground';
      default: return 'border-border bg-card text-muted-foreground';
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
              onClick={handleExportAll}
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
                {isScanning ? 'Scanning...' : 'Idle'}
              </span>
              <span>{currentIndex} / {total} Targets</span>
            </div>
            <Progress value={progress} className="h-2 rounded-none bg-border/50 [&>div]:bg-primary" />
          </div>
        </CardContent>
      </Card>

      {/* Tiered Map / Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {['A', 'B', 'C', 'D'].map(tier => {
          const tierResults = results.filter(r => r.tier === tier);
          return (
            <div key={tier} className="space-y-3">
              <div className={`p-2 border-l-2 font-mono text-sm uppercase tracking-wider flex justify-between items-center ${
                tier === 'A' ? 'border-primary text-primary bg-primary/5' :
                tier === 'B' ? 'border-amber-500 text-amber-500 bg-amber-500/5' :
                tier === 'C' ? 'border-blue-500 text-blue-500 bg-blue-500/5' :
                'border-muted text-muted-foreground bg-muted/5'
              }`}>
                <span>Tier {tier}</span>
                <span className="text-xs opacity-70">{tierResults.length}</span>
              </div>
              
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                {tierResults.map((res, i) => (
                  <Dialog key={i}>
                    <DialogTrigger asChild>
                      <button className={`w-full text-left p-3 border text-sm font-medium transition-all hover:-translate-y-0.5 hover:shadow-md ${getTierColor(res.tier)}`}>
                        <div className="flex justify-between items-center">
                          <span className="truncate">{res.country}</span>
                          <span className="text-xs font-mono opacity-70">{res.verdict}</span>
                        </div>
                      </button>
                    </DialogTrigger>
                    <DialogContent className="max-w-5xl border-border bg-background p-0 rounded-none h-[90vh] overflow-y-auto">
                      <ResultCard result={res} />
                    </DialogContent>
                  </Dialog>
                ))}
                
                {isScanning && countries[currentIndex] && (tier === 'D') /* Just put pending in D or anywhere temporarily, let's put it at bottom of A for visibility if we wanted, but let's just show a global scanning indicator instead. Actually, let's not render pending in tiers. */}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
}
