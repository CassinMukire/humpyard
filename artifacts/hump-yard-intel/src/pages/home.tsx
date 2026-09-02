import React, { useState } from "react";
import { Link } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CountryScanner } from "@/components/CountryScanner";
import { GlobalRadar } from "@/components/GlobalRadar";
import { Button } from "@/components/ui/button";
import { Radar, Crosshair, FileText, Inbox, Swords } from "lucide-react";

export default function Home() {
  const [activeTab, setActiveTab] = useState("scanner");

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/30">

      {/* Header */}
      <header className="border-b border-border bg-card z-10 sticky top-0">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">

          {/* Logo + app name */}
          <div className="flex items-center gap-4">
            <img
              src="/decel-logo.png"
              alt="DECEL"
              className="h-8 w-auto object-contain"
            />
            <div className="h-5 w-px bg-border" />
            <span
              className="text-sm uppercase tracking-[0.2em] text-muted-foreground"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600 }}
            >
              Hump Yard <span className="text-primary">Intel</span>
            </span>
          </div>

          {/* V1 Briefing quick links */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mr-1">
              V1 Briefing
            </span>
            <Link href="/dossiers">
              <Button variant="ghost" size="sm" className="text-xs font-mono h-8">
                <FileText className="w-3.5 h-3.5 mr-1" /> Dossiers
              </Button>
            </Link>
            <Link href="/review-queue">
              <Button variant="ghost" size="sm" className="text-xs font-mono h-8">
                <Inbox className="w-3.5 h-3.5 mr-1" /> Review
              </Button>
            </Link>
            <Link href="/battle-cards">
              <Button variant="ghost" size="sm" className="text-xs font-mono h-8">
                <Swords className="w-3.5 h-3.5 mr-1" /> Battle Cards
              </Button>
            </Link>
            <Link href="/signals">
              <Button variant="ghost" size="sm" className="text-xs font-mono h-8">
                <Radar className="w-3.5 h-3.5 mr-1" /> Radar
              </Button>
            </Link>
          </div>

          {/* Status indicator */}
          <div className="text-xs font-mono text-muted-foreground uppercase flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            System Online
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex justify-center mb-8">
            <TabsList className="grid w-full max-w-md grid-cols-2 rounded-none bg-card border border-border p-1 h-auto">
              <TabsTrigger
                value="scanner"
                className="rounded-none font-mono uppercase tracking-wider text-xs py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none transition-colors"
              >
                <Crosshair className="w-4 h-4 mr-2" />
                Target Scanner
              </TabsTrigger>
              <TabsTrigger
                value="radar"
                className="rounded-none font-mono uppercase tracking-wider text-xs py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none transition-colors"
              >
                <Radar className="w-4 h-4 mr-2" />
                Global Radar
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="scanner" className="mt-0 focus-visible:outline-none">
            <CountryScanner />
          </TabsContent>

          <TabsContent value="radar" className="mt-0 focus-visible:outline-none">
            <GlobalRadar />
          </TabsContent>
        </Tabs>
      </main>

    </div>
  );
}
