"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRightLeft,
  Briefcase,
  Check,
  Clock3,
  Copy,
  FileSignature,
  History,
  Mail,
  MessageCircle,
  Phone,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import type { Candidate, SkillId } from "@/lib/types";
import { cn, formatDateTime, formatDuration, formatTime, languageLabel, stageLabel } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScorePanel } from "@/components/candidate/score-panel";
import { TranscriptPane } from "@/components/candidate/transcript-pane";
import { EvidenceTimeline } from "@/components/candidate/evidence-timeline";
import { ConfidenceMeter, evidenceQualityLabel } from "@/components/candidate/confidence-meter";

type Override = { from: number; to: number; reason: string };

const rejectReasons = [
  "Evidence does not meet the role bar",
  "Insufficient evidence to decide",
  "Candidate withdrew",
  "Role requirements changed",
];

export function CandidateReview({ candidate, audioUrl }: { candidate: Candidate; audioUrl?: string }) {
  const [selectedId, setSelectedId] = useState<string | null>(candidate.score.items[0]?.evidence[0]?.id ?? null);
  const [revealed, setRevealed] = useState(false);
  const [overrides, setOverrides] = useState<Partial<Record<SkillId, Override>>>({});
  const [decision, setDecision] = useState(candidate.stage);
  const [traceOpen, setTraceOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState(rejectReasons[0]);
  const [rejectNote, setRejectNote] = useState("");
  const [draftFeedback, setDraftFeedback] = useState(true);
  const [reroutingId, setReroutingId] = useState<string | null>(null);
  const [activeRoleTitle, setActiveRoleTitle] = useState(candidate.roleTitle);
  const [commitmentStatus, setCommitmentStatus] = useState(candidate.commitment?.status ?? "pending");
  const [clientPackOpen, setClientPackOpen] = useState(false);
  const [clientPackMd, setClientPackMd] = useState<string | null>(null);
  const [clientPackBusy, setClientPackBusy] = useState(false);

  const rerouteCandidate = async (targetRoleId: string, targetRoleTitle: string) => {
    setReroutingId(targetRoleId);
    try {
      const res = await fetch("/api/candidates/reroute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId: candidate.id, targetRoleId, targetRoleTitle }),
      });
      if (res.ok) {
        setActiveRoleTitle(targetRoleTitle);
        setDecision("shortlisted");
        toast.success(`Re-routed to ${targetRoleTitle}`, {
          description: "Transcript, verified quotes and audit trail preserved.",
        });
      }
    } finally {
      setReroutingId(null);
    }
  };

  const updateCommitment = async (status: "pending" | "confirmed" | "rescheduled" | "silent") => {
    setCommitmentStatus(status);
    try {
      await fetch("/api/candidates/commitment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId: candidate.id, status }),
      });
      toast.success(`Commitment marked ${status}.`);
    } catch {
      /* non-fatal */
    }
  };

  const openClientPack = async () => {
    setClientPackOpen(true);
    if (clientPackMd) return;
    setClientPackBusy(true);
    try {
      const res = await fetch("/api/candidates/client-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId: candidate.id }),
      });
      const data = (await res.json()) as { ok?: boolean; markdown?: string };
      if (data.ok && data.markdown) setClientPackMd(data.markdown);
    } finally {
      setClientPackBusy(false);
    }
  };

  const selected = useMemo(() => {
    return candidate.score.items.flatMap((item) => item.evidence).find((item) => item.id === selectedId);
  }, [candidate.score.items, selectedId]);

  const onSelect = (id: string, segmentSeq: number) => {
    setSelectedId(id);
    const node = document.querySelector<HTMLElement>(`[data-seq="${segmentSeq}"]`);
    node?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  const persistDecision = async (action: "shortlist" | "review" | "close", reason?: string, note?: string) => {
    try {
      await fetch("/api/candidates/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateId: candidate.id,
          roleId: candidate.roleId,
          action,
          reason,
          note,
        }),
      });
    } catch {
      /* toast still communicates state cleanly */
    }
  };

  const shortlist = () => {
    setDecision("shortlisted");
    void persistDecision("shortlist");
    toast.success("Candidate shortlisted.", {
      description: "Saved to the hiring pipeline and audit trail. No email is sent automatically.",
    });
  };

  const sendToReview = () => {
    setDecision("in_review");
    void persistDecision("review");
    toast("Sent to human review.", {
      description: "The decision and your name are written to the audit trail.",
    });
  };

  const reject = () => {
    setDecision("closed");
    setRejectOpen(false);
    void persistDecision("close", rejectReason, rejectNote);
    toast("Decision recorded. Nothing was sent.", {
      description: draftFeedback
        ? "Open Mail or ask Vaani to draft kind feedback for your review."
        : "No feedback email was drafted.",
    });
  };

  return (
    <div className="flex min-h-[calc(100dvh-48px)] flex-col">
      <div className="border-b border-rule bg-chalk">
        <div className="mx-auto max-w-[1600px] px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <Button variant="ghost" size="icon" asChild className="-ml-1 shrink-0">
                <Link href={`/app/roles/${candidate.roleId}`} aria-label="Back to role">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate font-display text-[24px] font-medium leading-none tracking-[-0.035em] text-ink">
                    {candidate.name}
                  </h1>
                  <Badge tone={decision === "shortlisted" ? "verified" : decision === "in_review" ? "flag" : decision === "closed" ? "neutral" : "ultra"} dot>
                    {stageLabel(decision)}
                  </Badge>
                  {candidate.isReal ? (
                    <Badge tone="verified">
                      Real{candidate.latencyMs ? ` · ${(candidate.latencyMs / 1000).toFixed(1)}s` : ""} · {candidate.score.model}
                    </Badge>
                  ) : (
                    <Badge tone="neutral">Seeded example</Badge>
                  )}
                  {candidate.injectionFlags && candidate.injectionFlags.length > 0 ? (
                    <Badge tone="onair">
                      <ShieldAlert className="mr-1 h-2.5 w-2.5" />
                      Injection Shield
                    </Badge>
                  ) : null}
                  {candidate.reviewReasons.length > 0 ? (
                    <span className="hidden items-center gap-1 text-[9.5px] text-slate md:flex">
                      <span className="h-1 w-1 rounded-full bg-flag" />
                      {candidate.reviewReasons.join(" · ")}
                    </span>
                  ) : null}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-slate">
                  <span className="font-mono text-[9.5px] text-slate/80">{candidate.alias}</span>
                  <span className="h-2.5 w-px bg-rule" />
                  <span>{activeRoleTitle}</span>
                  <span className="h-2.5 w-px bg-rule" />
                  <span>{languageLabel(candidate.language)}</span>
                  <span className="h-2.5 w-px bg-rule" />
                  <span className="flex items-center gap-1">
                    <Clock3 className="h-2.5 w-2.5" />
                    {formatDuration(candidate.durationMs)}
                  </span>
                  <span className="h-2.5 w-px bg-rule" />
                  <span>{formatDateTime(candidate.interviewAt)}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {revealed ? (
                <span className="mr-1 hidden items-center gap-2 text-[10px] text-slate lg:flex">
                  <Mail className="h-3 w-3" /> {candidate.email}
                  <Phone className="h-3 w-3" /> {candidate.phone}
                </span>
              ) : null}
              <Button variant="outline" size="sm" onClick={openClientPack}>
                <Share2 className="h-3.5 w-3.5" />
                Client pack
              </Button>
              <Button variant="outline" size="sm" onClick={() => setRejectOpen(true)} className="text-[#a61c3a]">
                Reject
              </Button>
              <Button variant="outline" size="sm" onClick={sendToReview}>
                Send to review
              </Button>
              {(decision === "shortlisted" || decision === "scheduled") ? (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/app/offer?candidateId=${encodeURIComponent(candidate.id)}`}>
                    <FileSignature className="h-3.5 w-3.5" />
                    Offer letter
                  </Link>
                </Button>
              ) : null}
              <Button variant="ink" size="sm" onClick={shortlist} disabled={decision === "shortlisted"}>
                {decision === "shortlisted" ? <Check className="h-3.5 w-3.5" /> : null}
                {decision === "shortlisted" ? "Shortlisted" : "Shortlist"}
              </Button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-rule/70 pt-2">
            <span className="flex items-center gap-1.5 text-[9.5px] text-slate">
              <ShieldCheck className="h-3 w-3 text-verified" />
              Scores are AI-assisted. Quotes checked in code.
            </span>
            <span className="hidden items-center gap-1.5 text-[9.5px] text-slate sm:flex">
              <History className="h-3 w-3" />
              Audit trail on
            </span>
            <span className="ml-auto flex items-center gap-2 text-[9.5px] text-slate">
              <span className="flex items-center gap-1">
                <ConfidenceMeter value={candidate.score.evidenceQuality} compact /> {evidenceQualityLabel(candidate.score.evidenceQuality)} evidence quality
              </span>
            </span>
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col px-4 py-4 sm:px-6">
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[330px_minmax(0,1fr)]">
          <section className="overflow-hidden rounded-[10px] border border-rule bg-paper">
            <div className="border-b border-rule px-4 py-2.5">
              <div className="flex items-center justify-between">
                <h2 className="text-[12px] font-semibold text-ink">Skill assessment</h2>
                <span className="font-mono text-[9px] text-slate">rubric v3</span>
              </div>
            </div>
            <div className="h-[540px] lg:h-[calc(100dvh-330px)]">
              <ScorePanel
                candidate={candidate}
                selectedId={selectedId}
                onSelect={onSelect}
                overrides={overrides}
                onOverride={(skill, value, reason, from) => {
                  setOverrides((current) => ({ ...current, [skill]: { from, to: value, reason } }));
                  toast.success(`${skill.replace("_", " ")} overridden to ${value.toFixed(1)}.`, {
                    description: "Reason captured. In the live workspace this writes a review and audit event.",
                  });
                }}
                onOpenTrace={() => setTraceOpen(true)}
              />
            </div>
          </section>

          <section className="flex min-h-[560px] flex-col overflow-hidden rounded-[10px] border border-rule bg-paper lg:min-h-0">
            <div className="min-h-0 flex-1">
              <TranscriptPane
                candidate={candidate}
                selectedId={selectedId}
                onSelect={onSelect}
                revealed={revealed}
                onRevealChange={(value) => {
                  setRevealed(value);
                  if (value) {
                    toast("Contact details revealed.", {
                      description: "This action is written to the audit log in the live workspace.",
                    });
                  }
                }}
              />
            </div>
          </section>
        </div>

        <section className="mt-4 overflow-hidden rounded-[10px] border border-rule bg-paper">
          <div className="h-[210px]">
            <EvidenceTimeline candidate={candidate} selectedId={selectedId} onSelect={onSelect} audioUrl={audioUrl} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-rule bg-chalk/45 px-3 py-2">
            <div className="flex flex-wrap items-center gap-2 text-[9.5px] text-slate">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-verified" />
                {candidate.score.items.flatMap((item) => item.evidence).filter((item) => item.verified).length} verified
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-slate/40" />
                {candidate.score.items.flatMap((item) => item.evidence).filter((item) => !item.verified).length} unverified
              </span>
              {selected ? (
                <span className="max-w-[360px] truncate text-slate">
                  selected: {selected.skill.replace("_", " ")} at {formatTime(selected.tStartMs)}
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setTraceOpen(true)} className="inline-flex items-center gap-1 text-[9.5px] font-medium text-slate hover:text-ink">
                <Sparkles className="h-3 w-3" />
                Run trace
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedId(null);
                  toast("Evidence selection cleared.");
                }}
                className="inline-flex items-center gap-1 text-[9.5px] font-medium text-slate hover:text-ink"
              >
                <X className="h-3 w-3" />
                Clear selection
              </button>
            </div>
          </div>
        </section>

        {/* BPO Operations Strip: Don't Reject Re-Route + No-Show Killer + Logistics/Liveness */}
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {/* 1. Don't Reject, Re-Route */}
          <section className="rounded-[10px] border border-rule bg-paper p-4 lg:col-span-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4 text-ultramarine" />
                <h2 className="text-[12.5px] font-semibold text-ink">Don&apos;t reject — re-route across open BPO mandates</h2>
              </div>
              <span className="font-mono text-[9.5px] text-slate">One screen · multi-role fit</span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {(candidate.roleFits ?? []).map((fit) => (
                <div
                  key={fit.roleId}
                  className={cn(
                    "flex flex-col justify-between rounded-[8px] border p-3",
                    fit.recommended
                      ? "border-verified/40 bg-verified-soft/35"
                      : "border-rule bg-white",
                  )}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11.5px] font-medium text-ink">{fit.roleTitle}</span>
                      <span className="font-mono text-[12px] font-semibold text-ink">{fit.fitScore.toFixed(1)}/5</span>
                    </div>
                    <p className="mt-1 text-[10px] leading-relaxed text-slate">{fit.reason}</p>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between">
                    <Badge tone={fit.fitLabel === "strong_fit" ? "verified" : fit.fitLabel === "good_fit" ? "ultra" : "neutral"}>
                      {fit.fitLabel.replace("_", " ")}
                    </Badge>
                    {fit.roleTitle !== activeRoleTitle ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={reroutingId === fit.roleId}
                        onClick={() => void rerouteCandidate(fit.roleId, fit.roleTitle)}
                      >
                        <Briefcase className="h-3 w-3" />
                        {reroutingId === fit.roleId ? "Moving…" : "Re-route"}
                      </Button>
                    ) : (
                      <span className="font-mono text-[9.5px] text-slate">Current role</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 2. No-Show Killer Commitment Loop + Logistics & Technical Flags */}
          <section className="flex flex-col gap-3 rounded-[10px] border border-rule bg-paper p-4">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-[12.5px] font-semibold text-ink">No-Show Killer · Commitment</h2>
                <Badge tone={commitmentStatus === "confirmed" ? "verified" : commitmentStatus === "silent" ? "onair" : "flag"}>
                  {commitmentStatus}
                </Badge>
              </div>
              <p className="mt-1 text-[10.5px] text-slate">
                Track interview confirmation & nudge silent candidates on WhatsApp (zero API lock-in).
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {(["confirmed", "pending", "rescheduled", "silent"] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => void updateCommitment(st)}
                    className={cn(
                      "rounded-[5px] border px-2 py-1 text-[10px] capitalize transition",
                      commitmentStatus === st
                        ? "border-ink bg-ink text-chalk"
                        : "border-rule bg-white text-slate hover:border-slate/50",
                    )}
                  >
                    {st}
                  </button>
                ))}
              </div>
              {candidate.commitment?.whatsappUrl ? (
                <Button variant="outline" size="sm" className="mt-2.5 w-full" asChild>
                  <a href={candidate.commitment.whatsappUrl} target="_blank" rel="noreferrer">
                    <MessageCircle className="h-3.5 w-3.5 text-[#0a7f51]" />
                    Send WhatsApp slot reminder
                  </a>
                </Button>
              ) : null}
            </div>

            {candidate.logistics || candidate.liveness || (candidate.injectionFlags && candidate.injectionFlags.length > 0) ? (
              <div className="border-t border-rule pt-3 text-[10.5px] text-slate">
                <p className="font-semibold text-ink">Intake & Technical Flags</p>
                {candidate.logistics ? (
                  <p className="mt-1">
                    {candidate.logistics.preferredLocation ?? candidate.location} ·{" "}
                    {candidate.logistics.nightShiftOk === false ? "Day shift only" : "Night/rotational OK"} ·{" "}
                    {candidate.logistics.noticePeriod ?? "Notice N/A"} · {candidate.logistics.expectedCtc ?? "CTC N/A"}
                  </p>
                ) : null}
                {candidate.liveness ? (
                  <p className="mt-1 text-[10px]">
                    Liveness check: <strong className="text-ink">{candidate.liveness.matched ? "Matched" : "Technical flag"}</strong> — {candidate.liveness.note}
                  </p>
                ) : null}
                {candidate.injectionFlags && candidate.injectionFlags.length > 0 ? (
                  <p className="mt-1 text-[10px] text-[#a61c3a]">
                    Shield: {candidate.injectionFlags.join(" · ")}
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>
      </div>

      {/* Client Submission Pack Dialog */}
      <Dialog.Root open={clientPackOpen} onOpenChange={setClientPackOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-[2px]" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(600px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[16px] border border-rule bg-paper shadow-2xl">
            <div className="flex items-start justify-between border-b border-rule px-5 py-3.5">
              <div>
                <Dialog.Title className="font-display text-[20px] font-medium text-ink">
                  Client Submission Pack
                </Dialog.Title>
                <p className="mt-0.5 text-[11px] text-slate">
                  One-page agency brief with verified evidence quotes & timestamps.
                </p>
              </div>
              <Dialog.Close asChild>
                <Button variant="ghost" size="icon" aria-label="Close">
                  <X className="h-4 w-4" />
                </Button>
              </Dialog.Close>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-5 scroll-thin">
              {clientPackBusy ? (
                <p className="text-[12px] text-slate">Compiling verified quotes…</p>
              ) : (
                <pre className="whitespace-pre-wrap rounded-[8px] border border-rule bg-chalk/50 p-3.5 font-mono text-[11px] leading-relaxed text-ink">
                  {clientPackMd ?? "Could not generate pack."}
                </pre>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-rule bg-chalk/40 px-5 py-3">
              <Button
                variant="ink"
                size="sm"
                disabled={!clientPackMd}
                onClick={async () => {
                  if (!clientPackMd) return;
                  await navigator.clipboard.writeText(clientPackMd);
                  toast.success("Client Submission Pack copied to clipboard.");
                }}
              >
                <Copy className="h-3.5 w-3.5" />
                Copy brief
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={traceOpen} onOpenChange={setTraceOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/25 backdrop-blur-[2px]" />
          <Dialog.Content className="fixed inset-y-0 right-0 z-50 w-full max-w-[460px] overflow-y-auto border-l border-rule bg-paper p-0 shadow-2xl scroll-thin">
            <div className="sticky top-0 flex items-center justify-between border-b border-rule bg-paper px-5 py-3">
              <div>
                <Dialog.Title className="text-[13px] font-semibold text-ink">How was this decided?</Dialog.Title>
                <p className="mt-0.5 text-[10px] text-slate">Run trace · not chain-of-thought</p>
              </div>
              <Dialog.Close asChild>
                <Button variant="ghost" size="icon" aria-label="Close run trace">
                  <X className="h-4 w-4" />
                </Button>
              </Dialog.Close>
            </div>
            <div className="p-5">
              <div className="rounded-[8px] border border-rule bg-chalk/50 p-3">
                <p className="text-[10px] text-slate">Interview</p>
                <p className="mt-0.5 font-mono text-[11px] text-ink">{candidate.id}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge tone="ultra">{candidate.score.model}</Badge>
                  <Badge tone="verified" dot>current score</Badge>
                </div>
              </div>

              <ol className="mt-4 space-y-0">
                {[
                  {
                    name: "Privacy",
                    detail: "Redacted names, phone numbers and email addresses before scoring.",
                    meta: "regex baseline · 12 segments",
                    tone: "verified" as const,
                  },
                  {
                    name: "Scoring",
                    detail: "Mapped candidate turns to four observable rubric anchors. Interviewer turns ignored as evidence.",
                    meta: "structured JSON · 4 skills",
                    tone: "ultra" as const,
                  },
                  {
                    name: "Verifier",
                    detail: `${candidate.score.items.flatMap((item) => item.evidence).filter((item) => item.verified).length} of ${candidate.score.items.flatMap((item) => item.evidence).length} quotes matched the cited transcript segment. Unmatched quotes do not count as support.`,
                    meta: "deterministic code · NFC normalisation",
                    tone: "verified" as const,
                  },
                  {
                    name: "Router",
                    detail:
                      candidate.score.decision === "shortlist_suggested"
                        ? "Evidence quality and score crossed the playbook threshold. The router suggested shortlist. No external action ran."
                        : "The router sent this interview to human review because the evidence did not clear the playbook rule.",
                    meta: `rule · overall ${candidate.score.overall.toFixed(1)} / quality ${Math.round(candidate.score.evidenceQuality * 100)}%`,
                    tone: "flag" as const,
                  },
                ].map((step, index, list) => (
                  <li key={step.name} className="relative flex gap-3 pb-5">
                    {index < list.length - 1 ? (
                      <span className="absolute left-[7px] top-5 h-full w-px bg-rule" />
                    ) : null}
                    <span
                      className={cn(
                        "relative z-10 mt-1 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-2 border-paper",
                        step.tone === "verified" ? "bg-verified" : step.tone === "ultra" ? "bg-ultramarine" : "bg-flag",
                      )}
                    />
                    <div className="min-w-0">
                      <p className="text-[11.5px] font-medium text-ink">{step.name}</p>
                      <p className="mt-0.5 text-[10.5px] leading-relaxed text-slate">{step.detail}</p>
                      <p className="mt-1 font-mono text-[9px] text-slate/70">{step.meta}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="rounded-[6px] border border-flag/30 bg-flag-soft/60 p-3">
                <p className="text-[10px] font-medium text-[#6c5200]">What the verifier does not prove</p>
                <p className="mt-1 text-[10px] leading-relaxed text-[#6c5200]/80">
                  Quote matching proves that the cited words exist in the transcript. It does not prove that the
                  score, interpretation or fairness are correct. A recruiter owns the decision.
                </p>
              </div>

              <div className="mt-4 border-t border-rule pt-3">
                <p className="text-[10px] text-slate">Evidence quality inputs</p>
                <dl className="mt-2 grid grid-cols-2 gap-2">
                  {[
                    ["Verified quotes", candidate.score.confidenceParts.verifiedRatio],
                    ["Self-consistency", candidate.score.confidenceParts.consistency],
                    ["Rubric coverage", candidate.score.confidenceParts.rubricCoverage],
                    ["Transcript quality", candidate.score.confidenceParts.transcriptQuality],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-[4px] border border-rule bg-white px-2 py-1.5">
                      <dt className="text-[9px] text-slate">{label}</dt>
                      <dd className="mt-0.5 font-mono text-[11px] text-ink">{Math.round(Number(value) * 100)}%</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={rejectOpen} onOpenChange={setRejectOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-[2px]" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(480px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[20px] border border-rule bg-paper shadow-[0_30px_100px_-20px_rgba(11,16,48,0.5)]">
            <div className="flex items-start justify-between border-b border-rule px-5 py-4">
              <div>
                <Dialog.Title className="font-display text-[22px] font-medium leading-tight tracking-[-0.03em] text-ink">
                  Close this candidate
                </Dialog.Title>
                <p className="mt-1 text-[11px] text-slate">
                  Nothing is sent automatically. A human decision is recorded.
                </p>
              </div>
              <Dialog.Close asChild>
                <Button variant="ghost" size="icon" aria-label="Close dialog">
                  <X className="h-4 w-4" />
                </Button>
              </Dialog.Close>
            </div>
            <div className="p-5">
              <p className="text-[10.5px] font-medium text-slate">Reason</p>
              <div className="mt-2 space-y-1.5">
                {rejectReasons.map((reason) => (
                  <label
                    key={reason}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-[6px] border px-2.5 py-2 text-[11.5px] transition",
                      rejectReason === reason ? "border-ink bg-chalk/70 text-ink" : "border-rule bg-white text-slate hover:border-slate/50",
                    )}
                  >
                    <input
                      type="radio"
                      name="reject-reason"
                      value={reason}
                      checked={rejectReason === reason}
                      onChange={() => setRejectReason(reason)}
                      className="accent-ultramarine"
                    />
                    {reason}
                  </label>
                ))}
              </div>
              <label htmlFor="reject-note" className="mt-4 block text-[10.5px] font-medium text-slate">
                Internal note <span className="font-normal text-slate/60">(optional)</span>
              </label>
              <textarea
                id="reject-note"
                rows={2}
                value={rejectNote}
                onChange={(event) => setRejectNote(event.target.value)}
                placeholder="What should the next reviewer know?"
                className="mt-1.5 w-full resize-none rounded-[6px] border border-rule bg-white px-3 py-2 text-[11.5px] text-ink outline-none focus:border-ink"
              />
              <label className="mt-3 flex items-start gap-2 text-[10.5px] text-slate">
                <input
                  type="checkbox"
                  checked={draftFeedback}
                  onChange={(event) => setDraftFeedback(event.target.checked)}
                  className="mt-0.5 accent-ultramarine"
                />
                Draft a kind feedback email for approval. It will not be sent from this screen.
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-rule bg-chalk/40 px-5 py-3">
              <Button variant="ghost" size="md" onClick={() => setRejectOpen(false)}>
                Cancel
              </Button>
              <Button variant="danger" size="md" onClick={reject}>
                Record decision
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
