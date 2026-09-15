import React, { useState, useEffect } from "react";
import type { CountryResult, KeyContact, PersonInterest } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ChevronDown,
  ChevronUp,
  Linkedin,
  Copy,
  Check,
  AlertTriangle,
  Users,
  ExternalLink,
  Sparkles,
  X,
  Loader2,
} from "lucide-react";
import {
  enrichLinkedIn,
  linkedInEnrichHealth,
  type LinkedInInterestKind,
  type LinkedInEnrichment,
} from "@/lib/v1-api";

// The 5 decision-maker roles that matter for hump retarder procurement
// 1. Asset owner (controls capex)  2. Procurement (runs tender)  3. Engineering (writes spec)
// 4. Operations (budget holder)   5. Maintenance (day-to-day champion)
const BD_TARGET_ROLES = [
  { role: "Head of Infrastructure", reason: "Asset owner — controls capex" },
  { role: "Director of Technical Procurement", reason: "Runs the tender" },
  { role: "Chief Engineer", reason: "Writes the technical spec" },
  { role: "Director of Operations", reason: "Budget holder" },
  { role: "Head of Asset Management", reason: "Maintenance champion" },
];

function buildLinkedInRoleSearch(role: string, operator: string): string {
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(role + " " + operator)}`;
}

function ConfidenceBadge({ confidence }: { confidence: KeyContact["confidence"] }) {
  const styles = {
    "Named & verified": "border-green-600/50 text-green-500 bg-green-600/10",
    "Role known, name uncertain": "border-amber-600/50 text-amber-500 bg-amber-600/10",
    "Role inferred": "border-slate-600/50 text-slate-400 bg-slate-600/10",
  };
  return (
    <Badge
      variant="outline"
      className={`text-[10px] font-mono px-1.5 py-0 rounded-none border ${styles[confidence]}`}
    >
      {confidence}
    </Badge>
  );
}

function InterestRow({ interest }: { interest: PersonInterest }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(interest.fact.source_url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="border-l-2 border-primary/40 pl-2 py-1 space-y-0.5">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[9px] font-mono uppercase tracking-wider border-border/60 text-muted-foreground">
          {interest.kind.replace(/_/g, " ")}
        </Badge>
        <Badge
          variant="outline"
          className={`text-[9px] font-mono px-1 py-0 rounded-none border ${
            interest.fact.confidence === "V"
              ? "border-green-600/50 text-green-500"
              : interest.fact.confidence === "O"
              ? "border-amber-600/50 text-amber-500"
              : "border-slate-600/50 text-slate-400"
          }`}
        >
          [{interest.fact.confidence}]
        </Badge>
      </div>
      <p className="text-xs text-card-foreground leading-relaxed">
        {interest.summary}
      </p>
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground/70 font-mono">
        <a
          href={interest.fact.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-primary inline-flex items-center gap-1 truncate"
        >
          <ExternalLink className="w-2.5 h-2.5 shrink-0" />
          <span className="truncate max-w-[200px]">{interest.fact.source_url}</span>
        </a>
        <button
          onClick={handleCopy}
          className="hover:text-white inline-flex items-center gap-0.5"
          title="Copy source URL"
        >
          {copied ? <Check className="w-2.5 h-2.5 text-green-500" /> : <Copy className="w-2.5 h-2.5" />}
        </button>
      </div>
    </div>
  );
}

function ContactCard({
  contact,
  country,
  yards,
  proxycurlConfigured,
}: {
  contact: KeyContact;
  country: string;
  yards: string[];
  proxycurlConfigured: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [enrichUrl, setEnrichUrl] = useState("");
  const [enrichResult, setEnrichResult] = useState<LinkedInEnrichment | null>(null);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const [enrichLoading, setEnrichLoading] = useState(false);

  const handleCopyLinkedIn = () => {
    navigator.clipboard.writeText(contact.linkedinUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleEnrich = async () => {
    setEnrichError(null);
    setEnrichResult(null);
    const url = enrichUrl.trim() || contact.linkedinUrl;
    setEnrichLoading(true);
    try {
      const resp = await enrichLinkedIn({
        linkedin_url: url,
        role: contact.title,
      });
      setEnrichResult(resp.enrichment);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setEnrichError(msg);
    } finally {
      setEnrichLoading(false);
    }
  };

  // Merge the AI-derived interests (from search) with the operator-derived
  // interests (from enrich). Both render below as the "Topics to talk about"
  // list. Key by source_url to avoid dupes.
  const mergedInterests: PersonInterest[] = [
    ...(contact.interests ?? []),
    ...(enrichResult?.interests ?? []).map((i) => ({
      kind: i.kind as LinkedInInterestKind,
      summary: `[${contact.title ?? "contact"}] ${i.summary}`,
      fact: {
        value: i.summary,
        source_url: i.sourceUrl,
        retrieved_at: i.retrievedAt,
        confidence: "O" as const,
        verified_by: "proxycurl" as const,
      },
    })),
  ];
  const dedupedInterests = Array.from(
    new Map(mergedInterests.map((i) => [i.fact.source_url, i])).values(),
  );

  return (
    <div className="border border-border bg-background/40 p-4 space-y-3">
      {/* Name + confidence */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-white">
            {contact.name ?? (
              <span className="italic text-muted-foreground">Name unknown — search by role</span>
            )}
          </p>
          <p className="text-xs text-primary font-mono mt-0.5">{contact.title}</p>
          <p className="text-xs text-muted-foreground">{contact.organisation}</p>
        </div>
        <ConfidenceBadge confidence={contact.confidence} />
      </div>

      {/* Why relevant */}
      <p className="text-xs text-muted-foreground italic border-l border-primary/30 pl-2">
        {contact.whyRelevant}
      </p>

      {/* Topics of interest — search-result + Proxycurl enrichment, deduped */}
      {dedupedInterests.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Topics to talk about
          </p>
          {dedupedInterests.map((i, idx) => (
            <InterestRow key={`${i.fact.source_url}-${idx}`} interest={i} />
          ))}
        </div>
      )}

      {/* LinkedIn enrichment — paste a real profile URL, hit Enrich */}
      {proxycurlConfigured && (
        <div className="space-y-2 border border-border/50 bg-background/30 p-2">
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Auto-enrich via Proxycurl
            <span className="ml-1 normal-case text-muted-foreground/60">
              (~0.04–0.10 USD / lookup)
            </span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            <input
              type="url"
              value={enrichUrl}
              onChange={(e) => setEnrichUrl(e.target.value)}
              placeholder="https://www.linkedin.com/in/<slug>"
              className="flex-1 min-w-0 bg-background border border-border text-xs font-mono px-2 py-1 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/60"
              data-testid={`enrich-url-${contact.title ?? "x"}`}
            />
            <button
              onClick={handleEnrich}
              disabled={enrichLoading}
              className="inline-flex items-center gap-1.5 text-xs font-mono px-2 py-1 border border-purple-600/50 text-purple-300 hover:bg-purple-600/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              data-testid={`enrich-btn-${contact.title ?? "x"}`}
            >
              {enrichLoading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Sparkles className="w-3 h-3" />
              )}
              {enrichLoading ? "Enriching…" : "Enrich"}
            </button>
          </div>
          {enrichError && (
            <p className="text-[11px] text-red-400 font-mono flex items-start gap-1.5">
              <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
              <span>{enrichError}</span>
            </p>
          )}
          {enrichResult && enrichResult.interests.length === 0 && (
            <p className="text-[11px] text-amber-400 font-mono">
              No interests extracted — profile is public but has no
              activities / articles / events to summarise.
            </p>
          )}
        </div>
      )}

      {/* Action buttons — LinkedIn search, copy URL. No "generate outreach"
          button per Cassin's correction (humans write their own messages). */}
      <div className="flex flex-wrap gap-2">
        <a
          href={contact.linkedinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-mono px-2 py-1 border border-blue-600/50 text-blue-400 hover:bg-blue-600/10 transition-colors"
        >
          <Linkedin className="w-3 h-3" /> Search LinkedIn
        </a>
        <button
          onClick={handleCopyLinkedIn}
          className="inline-flex items-center gap-1.5 text-xs font-mono px-2 py-1 border border-border text-muted-foreground hover:text-white hover:border-border/80 transition-colors"
        >
          {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
          {copied ? "Copied" : "Copy URL"}
        </button>
      </div>
    </div>
  );
}

interface KeyContactsPanelProps {
  result: CountryResult;
  defaultOpen?: boolean;
}

export function KeyContactsPanel({ result, defaultOpen = false }: KeyContactsPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [enrichMode, setEnrichMode] = useState<"auto" | "manual-search" | "sunset">("manual-search");
  const contacts = result.keyContacts ?? [];

  // One-shot health check on mount: tells the UI whether to render the
  // Enrich UI (cost ~$0.04-0.10/call, so we gate it behind a real config).
  // v1.1.8 — also detects "sunset" state. Proxycurl was shut down on
  // 2025-07-04 (LinkedIn sued Nubela). The UI shows a clear message
  // instead of letting the operator click into a dead API.
  useEffect(() => {
    let cancelled = false;
    linkedInEnrichHealth()
      .then((h) => {
        if (!cancelled) setEnrichMode(h.mode);
      })
      .catch(() => {
        if (!cancelled) setEnrichMode("manual-search");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (contacts.length === 0) return null;
  const proxycurlConfigured = enrichMode === "auto";

  return (
    <div className="border-t border-border">
      {/* Header / toggle */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-6 py-3 hover:bg-secondary/30 transition-colors group"
      >
        <div className="flex items-center gap-2">
          <Users className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-colors">
            Key Contacts
          </span>
          <Badge
            variant="outline"
            className="text-[10px] font-mono px-1.5 py-0 rounded-none border-border text-muted-foreground"
          >
            {contacts.length}
          </Badge>
          {result.tier === "A" && (
            <Badge className="text-[10px] font-mono px-1.5 py-0 rounded-none bg-primary/20 text-primary border border-primary/40">
              Tier A — Act now
            </Badge>
          )}
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="px-6 pb-5 space-y-4">

          {/* v1.1.8 — Proxycurl sunset banner. Replaces the Enrich UI
              with a clear operator-facing message: the API is dead,
              switch providers or use manual search. Hidden when mode
              is "auto" or "manual-search". */}
          {enrichMode === "sunset" && (
            <div
              data-testid="linkedin-provider-sunset-banner"
              className="border border-amber-600/50 bg-amber-600/10 p-3 space-y-1"
            >
              <p className="text-[11px] font-mono uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                LinkedIn enrichment provider is sunset
              </p>
              <p className="text-[11px] text-amber-300/80 font-mono leading-relaxed">
                Proxycurl (Nubela) was shut down on 4 July 2025 after
                LinkedIn's lawsuit. The auto-enrich button is disabled
                until a replacement provider is wired. Use the
                "Search LinkedIn" link to find contacts manually,
                paste the URL back, and add interests by hand.
              </p>
            </div>
          )}

          {/* Quick Role Searches — always shown, operator-targeted */}
          <div className="border border-border bg-background/20 p-3 space-y-2">
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Quick LinkedIn searches &mdash;{" "}
              <span className="text-primary">{result.operator ?? `${result.country} National Railways`}</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {BD_TARGET_ROLES.map(({ role, reason }) => (
                <a
                  key={role}
                  href={buildLinkedInRoleSearch(role, result.operator ?? result.country)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={reason}
                  className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-1 border border-blue-600/40 text-blue-400 hover:bg-blue-600/10 transition-colors"
                >
                  <Linkedin className="w-2.5 h-2.5 shrink-0" />
                  {role}
                </a>
              ))}
            </div>
            <p className="text-[9px] text-muted-foreground/60 font-mono">
              Hover each role for why it matters. Opens LinkedIn people search filtered by role + operator.
            </p>
          </div>

          {/* Named / role-inferred contacts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {contacts.map((contact, i) => (
              <ContactCard
                key={i}
                contact={contact}
                country={result.country}
                yards={result.yards}
                proxycurlConfigured={proxycurlConfigured}
              />
            ))}
          </div>

          <Separator className="bg-border" />

          <div className="flex items-start gap-2 text-[11px] text-muted-foreground font-mono">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
            <span>
              Verify on LinkedIn before outreach — roles change. The platform tells you
              what each contact is interested in (role changes, projects, public statements,
              conferences); you write the message. Named contacts are extracted from
              procurement documents and public railway authority sources. Confidence reflects
              data quality: "Named &amp; verified" means the name appeared in a sourced
              document; "Role inferred" means the title is standard for this operator but no
              individual was identified.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
