// =============================================================================
// Review queue — items the engine couldn't trust. Promote to an entity, or
// discard with a reason. The 14-day auto-archive applies (§11.7).
// =============================================================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { BriefingLayout } from "@/components/BriefingLayout";
import {
  listReviewQueue,
  promoteReviewQueueItem,
  discardReviewQueueItem,
} from "@/lib/v1-api";
import {
  Inbox,
  ExternalLink,
  Check,
  X,
  Archive,
  Loader2,
  AlertTriangle,
  Calendar,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReviewQueueItem } from "@workspace/api-client-react";

function formatTs(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ageInDays(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

function QueueItemRow({
  item,
  onPromote,
  onDiscard,
  isPromoting,
  isDiscarding,
}: {
  item: ReviewQueueItem;
  onPromote: (id: string) => void;
  onDiscard: (id: string) => void;
  isPromoting: boolean;
  isDiscarding: boolean;
}) {
  const daysOld = ageInDays(item.ts);
  const isStale = daysOld > 14;

  return (
    <Card className={cn(isStale && "border-amber-600/40")}>
      <CardContent className="pt-6 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant="outline"
                className="text-[10px] font-mono px-1.5 py-0 rounded-none border-border text-muted-foreground uppercase tracking-wider"
              >
                {item.kind}
              </Badge>
              {item.market_id && (
                <Badge
                  variant="outline"
                  className="text-[10px] font-mono px-1.5 py-0 rounded-none border-border text-muted-foreground uppercase tracking-wider"
                >
                  {item.market_id}
                </Badge>
              )}
              {isStale && (
                <Badge
                  variant="outline"
                  className="text-[10px] font-mono px-1.5 py-0 rounded-none border-amber-600/50 text-amber-500 bg-amber-600/10"
                >
                  <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                  {daysOld}d old — auto-archive soon
                </Badge>
              )}
            </div>
            <p className="text-sm text-foreground font-mono break-words">
              {item.raw_snippet}
            </p>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono flex-wrap">
              <Calendar className="w-2.5 h-2.5" />
              <span>retrieved {formatTs(item.retrieved_at)}</span>
              <span>·</span>
              <span>queued {formatTs(item.ts)}</span>
            </div>
            <a
              href={item.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary font-mono truncate max-w-full"
            >
              <ExternalLink className="w-2.5 h-2.5 shrink-0" />
              <span className="truncate">{item.source_url}</span>
            </a>
            {Object.keys(item.proposed).length > 0 && (
              <details className="text-[10px] text-muted-foreground font-mono">
                <summary className="cursor-pointer hover:text-foreground">Proposed fields ({Object.keys(item.proposed).length})</summary>
                <pre className="mt-1 p-2 bg-background/40 border border-border text-[10px] overflow-x-auto">
                  {JSON.stringify(item.proposed, null, 2)}
                </pre>
              </details>
            )}
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <Button
              size="sm"
              variant="default"
              onClick={() => onPromote(item.id)}
              disabled={isPromoting || isDiscarding}
              className="font-mono text-xs uppercase tracking-wider"
            >
              {isPromoting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}
              Promote
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onDiscard(item.id)}
              disabled={isPromoting || isDiscarding}
              className="font-mono text-xs uppercase tracking-wider border-red-600/50 text-red-400 hover:bg-red-600/10"
            >
              {isDiscarding ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3 mr-1" />}
              Discard
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DiscardDialog({
  item,
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: {
  item: ReviewQueueItem | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (reason: string) => void;
  isPending: boolean;
}) {
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Discard this item?</DialogTitle>
          <DialogDescription>
            The engine flagged this as not trustable. Tell it why you're rejecting it so it can
            learn. The rejection hash is recorded in the corrections log (§1.3).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {item && (
            <p className="text-xs text-muted-foreground font-mono break-words p-2 border border-border bg-background/40">
              {item.raw_snippet}
            </p>
          )}
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for rejection (e.g. wrong market, duplicate of item X, junk source)"
            className="font-mono text-xs min-h-[80px]"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="font-mono text-xs">
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={() => onConfirm(reason)}
            disabled={isPending || !reason.trim()}
            className="font-mono text-xs uppercase tracking-wider bg-red-600 hover:bg-red-700"
          >
            {isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <X className="w-3 h-3 mr-1" />}
            Discard
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ReviewQueuePage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["review-queue"],
    queryFn: () => listReviewQueue(),
  });

  const [discardTarget, setDiscardTarget] = useState<ReviewQueueItem | null>(null);

  const promoteMutation = useMutation({
    mutationFn: ({ id, kind, proposed }: { id: string; kind: string; proposed: Record<string, unknown> }) =>
      promoteReviewQueueItem(id, { kind, proposed }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["review-queue"] }),
  });

  const discardMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      discardReviewQueueItem(id, reason),
    onSuccess: () => {
      setDiscardTarget(null);
      queryClient.invalidateQueries({ queryKey: ["review-queue"] });
    },
  });

  const handlePromote = (id: string) => {
    const item = data?.items.find((i) => i.id === id);
    if (!item) return;
    // For W35 demo: promote passes through the proposed fields as-is. A real
    // implementation would route by kind (yard → upsertYard, tender → new
    // table, etc.). The schema-level work for that ships Sep 8.
    promoteMutation.mutate({ id, kind: item.kind, proposed: item.proposed });
  };

  const handleDiscard = (id: string) => {
    const item = data?.items.find((i) => i.id === id);
    if (item) setDiscardTarget(item);
  };

  const handleConfirmDiscard = (reason: string) => {
    if (!discardTarget) return;
    discardMutation.mutate({ id: discardTarget.id, reason });
  };

  return (
    <BriefingLayout>
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
              <Inbox className="w-5 h-5 text-primary" />
              Review queue
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Items the engine couldn't trust. Promote to an entity, or discard with a reason.
              Auto-archives after 14 days unreviewed (§11.7).
            </p>
          </div>
          {data && (
            <Badge variant="outline" className="text-xs font-mono px-2 py-1 rounded-none border-border text-muted-foreground">
              {data.items.length} pending
            </Badge>
          )}
        </div>

        {/* Loading / error */}
        {isLoading && (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading queue…
            </CardContent>
          </Card>
        )}
        {error && (
          <Card>
            <CardContent className="pt-6 text-sm text-red-400">
              Failed to load review queue: {error instanceof Error ? error.message : String(error)}
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {data?.items.length === 0 && (
          <Card>
            <CardContent className="pt-6 text-center space-y-2">
              <Archive className="w-8 h-8 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">Queue is empty. Everything the engine found is trusted.</p>
            </CardContent>
          </Card>
        )}

        {/* List */}
        <div className="space-y-3">
          {data?.items.map((item) => (
            <QueueItemRow
              key={item.id}
              item={item}
              onPromote={handlePromote}
              onDiscard={handleDiscard}
              isPromoting={promoteMutation.isPending && promoteMutation.variables?.id === item.id}
              isDiscarding={discardMutation.isPending && discardMutation.variables?.id === item.id}
            />
          ))}
        </div>

        {/* How the trust gate works */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              How the trust gate works
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2">
            <p>
              When the engine ingests a fact, it checks the source against the primary-domain
              whitelist (operator sites, tender portals, signed docs). If the source is <span className="text-foreground">primary</span>,
              the fact is rendered with <Badge variant="outline" className="text-[9px] font-mono px-1 py-0 rounded-none border-green-600/50 text-green-500">V</Badge> confidence.
            </p>
            <p>
              Single secondary sources (press, aggregators) get <Badge variant="outline" className="text-[9px] font-mono px-1 py-0 rounded-none border-amber-600/50 text-amber-500">O</Badge>.
              Anything that doesn't resolve to a real URL or fails structural validation lands
              here for you to look at.
            </p>
            <p>
              Discarding records a rejection hash so the engine won't re-surface the same content
              from the same source (§1.3).
            </p>
          </CardContent>
        </Card>
      </div>

      <DiscardDialog
        item={discardTarget}
        open={!!discardTarget}
        onOpenChange={(v) => !v && setDiscardTarget(null)}
        onConfirm={handleConfirmDiscard}
        isPending={discardMutation.isPending}
      />
    </BriefingLayout>
  );
}
