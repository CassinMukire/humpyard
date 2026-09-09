// =============================================================================
// Radar — the discovery surface (Hitank 2026-09-09 request).
//
// One page, two options:
//   1. Target Scanner — single country scan via EXA, real-time
//   2. Global Radar — multi-country sweep across the dossier portfolio
//
// Both options output real CountryResult objects from the live EXA API.
// Click "Save to dossier" on the result card to:
//   - create a real Signal in the signals table
//   - create a real Play in the plays table
//   - link the two (status flips to "promoted")
//   - navigate to the affected market's dossier
//
// From the dossier the operator can then promote the play to Monday.
// No mock data — every scan is a live EXA query.
// =============================================================================

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CountryScanner } from "@/components/CountryScanner";
import { GlobalRadar } from "@/components/GlobalRadar";
import { BriefingLayout } from "@/components/BriefingLayout";
import { Crosshair, Radar as RadarIcon, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function RadarPage() {
  const [tab, setTab] = useState<"scanner" | "global">("scanner");

  return (
    <BriefingLayout>
      <div className="space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Radar</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live discovery surface. Both options pull real-time data from EXA and the
            public tender portals. Save a finding to the dossier — it lands as a
            Signal + Play; the operator promotes to Monday.
          </p>
        </div>

        {/* Sub-tabs: Target Scanner | Global Radar */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as "scanner" | "global")} className="w-full">
          <div className="flex justify-center mb-6">
            <TabsList className="grid w-full max-w-2xl grid-cols-2 rounded-none bg-card border border-border p-1 h-auto">
              <TabsTrigger
                value="scanner"
                data-testid="radar-tab-scanner"
                className="rounded-none font-mono uppercase tracking-wider text-xs py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none transition-colors"
              >
                <Crosshair className="w-4 h-4 mr-2" />
                Target Scanner
              </TabsTrigger>
              <TabsTrigger
                value="global"
                data-testid="radar-tab-global"
                className="rounded-none font-mono uppercase tracking-wider text-xs py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none transition-colors"
              >
                <RadarIcon className="w-4 h-4 mr-2" />
                Global Radar
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="scanner" className="mt-0 focus-visible:outline-none">
            <CountryScanner />
          </TabsContent>

          <TabsContent value="global" className="mt-0 focus-visible:outline-none">
            <GlobalRadar />
          </TabsContent>
        </Tabs>

        {/* Help footer */}
        <Card className="bg-card/50 border-dashed">
          <CardContent className="pt-4 pb-4 text-xs text-muted-foreground font-mono space-y-1">
            <p>
              <span className="text-primary">Flow:</span>{" "}
              <span>Scanner / Global Radar (real EXA)</span>
              <ArrowRight className="w-3 h-3 inline mx-1" />
              <span>Save to dossier (real Signal + Play)</span>
              <ArrowRight className="w-3 h-3 inline mx-1" />
              <span>Open dossier (real Plays section)</span>
              <ArrowRight className="w-3 h-3 inline mx-1" />
              <span>Push to Monday (real board push)</span>
            </p>
            <p>
              No mock data. Every scan hits the live EXA API; every save lands in the Postgres DB; every push goes to the live Monday board.
            </p>
            <p>
              <Link href="/signals" className="text-primary hover:underline">
                → Go to /signals
              </Link>{" "}
              to see all the unprocessed radar findings in one queue.
            </p>
          </CardContent>
        </Card>
      </div>
    </BriefingLayout>
  );
}
