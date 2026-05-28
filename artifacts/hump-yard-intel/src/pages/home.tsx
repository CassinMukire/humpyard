import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CountryScanner } from "@/components/CountryScanner";
import { GlobalRadar } from "@/components/GlobalRadar";
import { Radar, Crosshair, ShieldAlert } from "lucide-react";

export default function Home() {
  const [activeTab, setActiveTab] = useState("scanner");

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/30">
      
      {/* Top Navigation / Branding */}
      <header className="border-b border-border bg-card z-10 sticky top-0">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 text-primary">
            <ShieldAlert className="w-6 h-6" />
            <h1 className="font-mono font-bold tracking-widest text-lg uppercase text-white">
              Hump Yard <span className="text-primary">Intel</span>
            </h1>
          </div>
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
