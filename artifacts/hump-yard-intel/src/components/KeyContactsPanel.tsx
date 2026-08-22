import React, { useState } from "react";
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
} from "lucide-react";

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
}: {
  contact: KeyContact;
  country: string;
  yards: string[];
}) {
  const [copied, setCopied] = useState(false);

  const handleCopyLinkedIn = () => {
    navigator.clipboard.writeText(contact.linkedinUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

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

      {/* Topics of interest (per Cassin's correction, 2026-08-22) */}
      {contact.interests && contact.interests.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Topics to talk about
          </p>
          {contact.interests.map((i, idx) => (
            <InterestRow key={`${i.fact.source_url}-${idx}`} interest={i} />
          ))}
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
  const contacts = result.keyContacts ?? [];

  if (contacts.length === 0) return null;

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
