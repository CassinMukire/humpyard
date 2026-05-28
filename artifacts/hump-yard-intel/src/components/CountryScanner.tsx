import React, { useState, useEffect } from "react";
import { useSearchCountry, useGetCountries } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResultCard } from "./ResultCard";
import { Search, Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const LOADING_STEPS = [
  "Initializing secure connection...",
  "Querying global procurement portals...",
  "Scanning regional railway authorities...",
  "Analyzing tender documents...",
  "Extracting classification yard data...",
  "Synthesizing intelligence report..."
];

export function CountryScanner() {
  const [countryInput, setCountryInput] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<string>("custom");
  const [loadingStep, setLoadingStep] = useState(0);

  const { data: countryData, isLoading: isLoadingCountries } = useGetCountries();
  const searchCountryMutation = useSearchCountry();

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (searchCountryMutation.isPending) {
      setLoadingStep(0);
      interval = setInterval(() => {
        setLoadingStep(prev => (prev < LOADING_STEPS.length - 1 ? prev + 1 : prev));
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [searchCountryMutation.isPending]);

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    const query = selectedCountry !== "custom" ? selectedCountry : countryInput;
    if (!query.trim()) return;
    
    searchCountryMutation.mutate({ data: { country: query.trim() } });
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      
      <Card className="border-border bg-card rounded-none shadow-xl">
        <CardContent className="p-6">
          <form onSubmit={handleScan} className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 flex gap-2">
              <Select 
                value={selectedCountry} 
                onValueChange={(v) => {
                  setSelectedCountry(v);
                  if (v !== "custom") setCountryInput("");
                }}
              >
                <SelectTrigger className="w-[200px] rounded-none font-mono text-sm border-border focus:ring-primary">
                  <SelectValue placeholder="Select target..." />
                </SelectTrigger>
                <SelectContent className="rounded-none border-border">
                  <SelectItem value="custom" className="font-mono text-sm">-- Custom Entry --</SelectItem>
                  {countryData?.countries?.map(c => (
                    <SelectItem key={c} value={c} className="font-mono text-sm">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Input 
                placeholder="Enter country name..." 
                value={countryInput}
                onChange={e => {
                  setCountryInput(e.target.value);
                  setSelectedCountry("custom");
                }}
                className="flex-1 rounded-none border-border focus-visible:ring-primary font-mono text-sm"
                disabled={searchCountryMutation.isPending}
              />
            </div>
            <Button 
              type="submit" 
              disabled={searchCountryMutation.isPending || (!countryInput && selectedCountry === "custom")}
              className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90 font-mono uppercase tracking-wider px-8"
            >
              {searchCountryMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Scanning
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Execute Scan
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {searchCountryMutation.isPending && (
        <div className="flex flex-col items-center justify-center py-20 space-y-6">
          <div className="relative">
            <div className="absolute inset-0 border-t-2 border-primary rounded-full animate-spin h-16 w-16 opacity-20"></div>
            <div className="absolute inset-2 border-r-2 border-primary rounded-full animate-spin h-12 w-12 opacity-40" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
            <Search className="w-6 h-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
          </div>
          <p className="font-mono text-sm text-primary animate-pulse text-center">
            {LOADING_STEPS[loadingStep]}
          </p>
        </div>
      )}

      {searchCountryMutation.isError && (
        <Card className="border-destructive bg-destructive/10 rounded-none">
          <CardContent className="p-6 flex items-center gap-4">
            <AlertCircle className="w-8 h-8 text-destructive shrink-0" />
            <div>
              <h3 className="font-bold text-destructive uppercase tracking-wide">Scan Failed</h3>
              <p className="text-sm text-destructive-foreground mt-1">
                {(searchCountryMutation.error as any)?.message || "An unexpected error occurred during intelligence gathering."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {searchCountryMutation.isSuccess && searchCountryMutation.data && !searchCountryMutation.isPending && (
        <div className="mt-8">
          <ResultCard result={searchCountryMutation.data} />
        </div>
      )}
      
      {!searchCountryMutation.isPending && !searchCountryMutation.isSuccess && !searchCountryMutation.isError && (
        <div className="py-20 flex flex-col items-center justify-center text-muted-foreground border border-dashed border-border">
          <Search className="w-12 h-12 mb-4 opacity-20" />
          <p className="font-mono text-sm uppercase tracking-wider">Awaiting Target Selection</p>
        </div>
      )}

    </div>
  );
}
