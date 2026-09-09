import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CountryScanner } from "@/components/CountryScanner";
import { GlobalRadar } from "@/components/GlobalRadar";
import { BriefingLayout } from "@/components/BriefingLayout";
import { Radar, Crosshair } from "lucide-react";

export default function Home() {
  const [activeTab, setActiveTab] = useState("scanner");

  return (
    <BriefingLayout>
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
    </BriefingLayout>
  );
}
