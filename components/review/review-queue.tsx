"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Flag,
  Keyboard,
  SkipForward,
  Sparkles,
  X,
} from "lucide-react";
import type { Candidate, SkillId } from "@/lib/types";
import { cn, formatDuration, languageLabel, stageLabel } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScorePanel } from "@/components/candidate/score-panel";
import { TranscriptPane } from "@/components/candidate/transcript-pane";
import { EvidenceTimeline } from "@/components/candidate/evidence-timeline";

const reasons = [
  "Evidence does not meet the role bar",
  "Insufficient evidence to decide",
  "Candidate withdrew",
  "Role requirements changed",
];

export function ReviewQueue({ initial }: { initial: Candidate[] }) {
  const [queue, setQueue] = useState(initial);
  const [index, setIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(initial[0]?.score.items[0]?.evidence[0]?.id ?? null);
  const [revealed, setRevealed] = useState(false);
  const [overrides, setOverrides] = useState<Partial<Record<SkillId, { from: number; to: number; reason: string }>>>({});
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState(reasons[0]);
  const [note, setNote] = useState("");
  const [reviewed, setReviewed] = useState(0);
  const [agreed, setAgreed] = useState(0);
  const candidate = queue[index];

  const selectCandidate = (nextIndex: number) => {
    setIndex(nextIndex);
    setSelectedId(queue[nextIndex]?.score.items[0]?.evidence[0]?.id ?? null);
    setRevealed(false);
    setOverrides({});
  };

  const decide = (action: "shortlist" | "review" | "skip" | "close", reason?: string) => {
    if (!candidate) return;
    if (action === "shortlist") {
      setReviewed((value) => value + 1);
      if (candidate.score.decision === "shortlist_suggested") setAgreed((value) => value + 1);
      toast.success(`${candidate.name} shortlisted.`, {
        description: "A Scheduler approval is created in the live workspace. No external action ran.",
      });
    } else if (action === "skip") {
      toast("Skipped. This candidate stays in the queue.");
    } else if (action === "close") {
      setReviewed((value) => value + 1);
      toast("Decision recorded. A feedback draft waits in Approvals.", {
        description: reason ?? undefined,
      });
      setRejectOpen(false);
    }

    const nextQueue = action === "skip" ? queue : queue.filter((item) => item.id !== candidate.id);
    setQueue(nextQueue);
    const nextIndex = Math.min(index, Math.max(0, nextQueue.length - 1));
    setIndex(nextIndex);
    setSelectedId(nextQueue[nextIndex]?.score.items[0]?.evidence[0]?.id ?? null);
    setRevealed(false);
    setOverrides({});
    setNote("");
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (rejectOpen) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "a") decide("shortlist");
      if (key === "r") setRejectOpen(true);
      if (key === "s") decide("skip");
      if (key === "j") selectCandidate(Math.min(queue.length - 1, index + 1));
      if (key === "k") selectCandidate(Math.max(0, index - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const onSelect = (id: string, segmentSeq: number) => {
    setSelectedId(id);
    document.querySelector<HTMLElement>(`[data-seq="${segmentSeq}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  const reasonChips = useMemo(() => {
    if (!candidate) return [];
    return candidate.reviewReasons.length > 0 ? candidate.reviewReasons : ["Routine review"];
  }, [candidate]);

  if (!candidate) {
    return (
      <div className="flex min-h-[calc(100dvh-48px)] items-center justify-center px-6">
        <div className="max-w-[420px] text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-verified/25 bg-verified-soft">
            <Check className="h-5 w-5 text-verified" />
          </div>
          <h1 className="mt-4 font-display text-[30px] font-medium tracking-[-0.04em] text-ink">Queue clear.</h1>
          <p className="mt-2 text-[12.5px] leading-relaxed text-slate">
            Every candidate in this demo has a human decision. In the live workspace, new interviews arrive here
            when evidence is uncertain.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button variant="outline" size="md" asChild>
              <Link href="/app">Back to home</Link>
            </Button>
            <Button variant="ink" size="md" asChild>
              <Link href="/app/roles/role-support">View pipeline</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-48px)] flex-col">
      <div className="border-b border-rule bg-chalk">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild className="-ml-1">
              <Link href="/app" aria-label="Back to home">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-[24px] font-medium leading-none tracking-[-0.035em] text-ink">Review queue</h1>
                <Badge tone="flag">{queue.length} left</Badge>
              </div>
              <p className="mt-1 text-[10.5px] text-slate">
                One candidate at a time. The model suggests; you decide.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="hidden items-center gap-2 rounded-[5px] border border-rule bg-paper px-2.5 py-1.5 text-[10px] text-slate sm:flex">
              <Keyboard className="h-3.5 w-3.5" />
              <span><b className="font-mono font-medium text-ink">J</b>/<b className="font-mono font-medium text-ink">K</b> move</span>
              <span className="text-rule">·</span>
              <span><b className="font-mono font-medium text-ink">A</b> shortlist</span>
              <span className="text-rule">·</span>
              <span><b className="font-mono font-medium text-ink">R</b> reject</span>
              <span className="text-rule">·</span>
              <span><b className="font-mono font-medium text-ink">S</b> skip</span>
            </div>
            <div className="rounded-[5px] border border-rule bg-paper px-2.5 py-1.5 text-[10px] text-slate">
              <span className="font-mono text-ink">{reviewed > 0 ? Math.round((agreed / reviewed) * 100) : 78}%</span> agreement
              <span className="ml-1 text-slate/60">· demo sample</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-[1600px] flex-1 grid-cols-1 gap-3 px-4 py-3 sm:px-6 lg:grid-cols-[236px_300px_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-[8px] border border-rule bg-paper">
          <div className="flex items-center justify-between border-b border-rule px-3 py-2">
            <span className="text-[10.5px] font-semibold text-ink">Queue</span>
            <span className="font-mono text-[9px] text-slate">{index + 1}/{queue.length}</span>
          </div>
          <div className="max-h-[240px] overflow-y-auto p-1.5 scroll-thin lg:max-h-[calc(100dvh-260px)]">
            {queue.map((item, itemIndex) => (
              <button
                key={item.id}
                type="button"
                onClick={() => selectCandidate(itemIndex)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-[5px] px-2 py-2 text-left transition",
                  itemIndex === index ? "bg-ultramarine-soft" : "hover:bg-chalk/70",
                )}
              >
                <Avatar initials={item.name.split(" ").map((part) => part[0]).join("")} size="xs" tone={itemIndex === index ? "ultra" : "ink"} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[10.5px] font-medium text-ink">{item.name}</span>
                  <span className="block truncate text-[8.5px] text-slate">{item.reviewReasons[0] ?? "Routine review"}</span>
                </span>
                <span className="font-mono text-[9px] text-slate">{item.score.overall.toFixed(1)}</span>
              </button>
            ))}
            {queue.length === 0 ? <p className="p-3 text-[10px] text-slate">Queue clear.</p> : null}
          </div>
          <div className="border-t border-rule p-2.5">
            <p className="text-[9px] leading-relaxed text-slate">
              Rejecting never sends an email. It drafts feedback for you to approve.
            </p>
          </div>
        </aside>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-[8px] border border-rule bg-paper">
          <div className="border-b border-rule px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <Avatar initials={candidate.name.split(" ").map((part) => part[0]).join("")} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-[11.5px] font-medium text-ink">{candidate.name}</p>
                  <p className="truncate font-mono text-[8.5px] text-slate">{candidate.alias} · {candidate.roleTitle}</p>
                </div>
              </div>
              <Badge tone="flag" dot>{stageLabel(candidate.stage)}</Badge>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {reasonChips.map((reason) => (
                <span key={reason} className="inline-flex items-center gap-1 rounded-[3px] border border-flag/30 bg-flag-soft px-1.5 py-0.5 text-[8.5px] text-[#7a5b00]">
                  <Flag className="h-2 w-2" />
                  {reason}
                </span>
              ))}
              <span className="inline-flex items-center gap-1 rounded-[3px] border border-rule bg-white px-1.5 py-0.5 text-[8.5px] text-slate">
                {languageLabel(candidate.language)} · {formatDuration(candidate.durationMs)}
              </span>
            </div>
          </div>
          <div className="min-h-[480px] flex-1">
            <ScorePanel
              candidate={candidate}
              selectedId={selectedId}
              onSelect={onSelect}
              overrides={overrides}
              onOverride={(skill, value, reason, from) => {
                setOverrides((current) => ({ ...current, [skill]: { from, to: value, reason } }));
                toast.success(`${skill.replace("_", " ")} overridden to ${value.toFixed(1)}.`);
              }}
              onOpenTrace={() => toast("Open the full candidate page for the run trace.", { description: "The trace is available from the candidate detail screen." })}
            />
          </div>
        </section>

        <section className="flex min-h-[480px] flex-col overflow-hidden rounded-[8px] border border-rule bg-paper lg:min-h-0">
          <TranscriptPane
            candidate={candidate}
            selectedId={selectedId}
            onSelect={onSelect}
            revealed={revealed}
            onRevealChange={setRevealed}
          />
        </section>
      </div>

      <div className="mx-auto w-full max-w-[1600px] px-4 pb-3 sm:px-6">
        <div className="overflow-hidden rounded-[8px] border border-rule bg-paper">
          <div className="h-[170px]">
            <EvidenceTimeline candidate={candidate} selectedId={selectedId} onSelect={onSelect} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-rule bg-chalk/45 px-3 py-2.5">
            <div className="flex items-center gap-3 text-[9.5px] text-slate">
              <span className="flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-ultramarine" />
                {candidate.score.items.flatMap((item) => item.evidence).filter((item) => item.verified).length} verified quotes
              </span>
              <Link href={`/app/roles/${candidate.roleId}/candidates/${candidate.id}`} className="inline-flex items-center gap-1 font-medium text-ultramarine hover:underline hover:underline-offset-2">
                Open full evidence <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="sm" onClick={() => decide("skip")}>
                <SkipForward className="h-3.5 w-3.5" />
                Skip
                <span className="ml-1 font-mono text-[9px] text-slate">S</span>
              </Button>
              <Button variant="danger" size="sm" onClick={() => setRejectOpen(true)}>
                Reject
                <span className="ml-1 font-mono text-[9px]">R</span>
              </Button>
              <Button variant="ink" size="sm" onClick={() => decide("shortlist")}>
                <Check className="h-3.5 w-3.5" />
                Shortlist
                <span className="ml-1 font-mono text-[9px] text-mist/60">A</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog.Root open={rejectOpen} onOpenChange={setRejectOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-[2px]" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(470px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[20px] border border-rule bg-paper shadow-2xl">
            <div className="flex items-start justify-between border-b border-rule px-5 py-4">
              <div>
                <Dialog.Title className="font-display text-[22px] font-medium tracking-[-0.03em] text-ink">
                  Reject with a reason
                </Dialog.Title>
                <p className="mt-1 text-[10.5px] text-slate">Nothing is sent. A feedback draft is created for approval.</p>
              </div>
              <Dialog.Close asChild>
                <Button variant="ghost" size="icon" aria-label="Close">
                  <X className="h-4 w-4" />
                </Button>
              </Dialog.Close>
            </div>
            <div className="p-5">
              <div className="space-y-1.5">
                {reasons.map((reason) => (
                  <label key={reason} className={cn("flex cursor-pointer items-center gap-2 rounded-[5px] border px-2.5 py-2 text-[11px]", rejectReason === reason ? "border-ink bg-chalk/60 text-ink" : "border-rule bg-white text-slate")}>
                    <input type="radio" name="review-reject" checked={rejectReason === reason} onChange={() => setRejectReason(reason)} className="accent-ultramarine" />
                    {reason}
                  </label>
                ))}
              </div>
              <label htmlFor="review-note" className="mt-3 block text-[10px] font-medium text-slate">Internal note</label>
              <textarea id="review-note" rows={2} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional. Stored with the decision." className="mt-1 w-full resize-none rounded-[5px] border border-rule bg-white px-2.5 py-2 text-[11px] outline-none focus:border-ink" />
            </div>
            <div className="flex justify-end gap-2 border-t border-rule bg-chalk/40 px-5 py-3">
              <Button variant="ghost" size="sm" onClick={() => setRejectOpen(false)}>Cancel</Button>
              <Button variant="danger" size="sm" onClick={() => decide("close", rejectReason)}>Record and next</Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
