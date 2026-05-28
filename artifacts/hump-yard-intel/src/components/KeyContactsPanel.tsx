import React, { useState } from "react";
import type { CountryResult, KeyContact } from "@workspace/api-client-react";
import { useGenerateOutreach } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ChevronDown,
  ChevronUp,
  Linkedin,
  Copy,
  Check,
  Zap,
  AlertTriangle,
  Users,
  Globe,
} from "lucide-react";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "de", label: "German" },
  { code: "fr", label: "French" },
  { code: "ru", label: "Russian" },
  { code: "zh", label: "Chinese" },
  { code: "pl", label: "Polish" },
  { code: "es", label: "Spanish" },
  { code: "it", label: "Italian" },
  { code: "tr", label: "Turkish" },
  { code: "nl", label: "Dutch" },
  { code: "cs", label: "Czech" },
  { code: "ro", label: "Romanian" },
];

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
  const [showOutreach, setShowOutreach] = useState(false);
  const [outreachLang, setOutreachLang] = useState("en");
  const [generatedMessage, setGeneratedMessage] = useState<string | null>(null);
  const [messageCopied, setMessageCopied] = useState(false);

  const outreachMutation = useGenerateOutreach();

  const handleCopyLinkedIn = () => {
    navigator.clipboard.writeText(contact.linkedinUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleGenerateOutreach = () => {
    setShowOutreach(true);
    setGeneratedMessage(null);
    outreachMutation.mutate(
      {
        data: {
          contactName: contact.name ?? undefined,
          title: contact.title,
          organisation: contact.organisation,
          country,
          yards,
          language: outreachLang,
        },
      },
      {
        onSuccess: (result) => {
          setGeneratedMessage(result.message);
        },
      }
    );
  };

  const handleCopyMessage = () => {
    if (!generatedMessage) return;
    navigator.clipboard.writeText(generatedMessage).then(() => {
      setMessageCopied(true);
      setTimeout(() => setMessageCopied(false), 2000);
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

      {/* Action buttons */}
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
        <button
          onClick={handleGenerateOutreach}
          disabled={outreachMutation.isPending}
          className="inline-flex items-center gap-1.5 text-xs font-mono px-2 py-1 border border-primary/50 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
        >
          <Zap className="w-3 h-3" />
          {outreachMutation.isPending ? "Generating..." : "Generate Outreach"}
        </button>
      </div>

      {/* Outreach panel */}
      {showOutreach && (
        <div className="border border-border bg-card mt-2 p-3 space-y-3">
          {/* Language selector */}
          <div className="flex items-center gap-2 flex-wrap">
            <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <div className="flex flex-wrap gap-1">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    setOutreachLang(lang.code);
                    setGeneratedMessage(null);
                  }}
                  className={`text-[10px] font-mono px-1.5 py-0.5 border transition-colors ${
                    outreachLang === lang.code
                      ? "border-primary bg-primary/20 text-primary"
                      : "border-border text-muted-foreground hover:border-border/60"
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
            <button
              onClick={handleGenerateOutreach}
              disabled={outreachMutation.isPending}
              className="text-[10px] font-mono px-2 py-0.5 border border-primary/40 text-primary hover:bg-primary/10 transition-colors ml-auto disabled:opacity-50"
            >
              {outreachMutation.isPending ? "..." : "Regenerate"}
            </button>
          </div>

          {/* Message output */}
          {outreachMutation.isPending && (
            <div className="text-xs text-muted-foreground font-mono animate-pulse">
              Generating message...
            </div>
          )}
          {outreachMutation.isError && (
            <div className="text-xs text-destructive flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Failed to generate message.
            </div>
          )}
          {generatedMessage && (
            <div className="space-y-2">
              <p className="text-xs leading-relaxed text-card-foreground whitespace-pre-line">
                {generatedMessage}
              </p>
              <button
                onClick={handleCopyMessage}
                className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 border border-border text-muted-foreground hover:text-white transition-colors"
              >
                {messageCopied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                {messageCopied ? "Copied" : "Copy message"}
              </button>
            </div>
          )}
        </div>
      )}
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
        <div className="px-6 pb-5 space-y-3">
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
              Verify on LinkedIn before outreach — roles change. Named contacts are extracted
              from procurement documents and public railway authority sources. Confidence reflects
              data quality: "Named &amp; verified" means the name appeared in a sourced document;
              "Role inferred" means the title is standard for this operator but no individual was
              identified.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
