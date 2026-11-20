"use client";

import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import * as Slider from "@radix-ui/react-slider";
import { ChevronDown, ClipboardPenLine, Info, Sparkles } from "lucide-react";
import type { Candidate, SkillId, SkillScore } from "@/lib/types";
import { cn, formatTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfidenceMeter, evidenceQualityLabel } from "@/components/candidate/confidence-meter";

type Override = { from: number; to: number; reason: string };

export function ScorePanel({
  candidate,
  selectedId,
  onSelect,
  overrides,
  onOverride,
  onOpenTrace,
}: {
  candidate: Candidate;
  selectedId: string | null;
  onSelect: (id: string, segmentSeq: number) => void;
  overrides: Partial<Record<SkillId, Override>>;
  onOverride: (skill: SkillId, value: number, reason: string, from: number) => void;
  onOpenTrace: () => void;
}) {
  const items = candidate.score.items;
  const active = items.filter((item) => !item.insufficientEvidence);
  const totalWeight = active.reduce((sum, item) => sum + item.weight, 0) || 1;
  const overall =
    active.reduce((sum, item) => sum + (overrides[item.id]?.to ?? item.value) * item.weight, 0) / totalWeight;
  const evidenceCount = items.flatMap((item) => item.evidence).length;
  const verifiedCount = items.flatMap((item) => item.evidence).filter((item) => item.verified).length;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-rule px-4 py-3">
        <div>
          <p className="text-[10.5px] text-slate">Overall rubric score</p>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span className="font-display text-[38px] font-medium leading-none tracking-[-0.045em] text-ink">
              {overall.toFixed(1)}
            </span>
            <span className="text-[12px] text-slate">/ 5</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[9.5px] text-slate">Evidence quality</p>
          <div className="mt-1 flex justify-end">
            <ConfidenceMeter value={candidate.score.evidenceQuality} parts={candidate.score.confidenceParts} />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-rule bg-chalk/45 px-4 py-1.5">
        <span className="text-[9.5px] text-slate">
          {verifiedCount}/{evidenceCount} quotes verified
        </span>
        {candidate.score.items.some((item) => item.insufficientEvidence) ? (
          <Badge tone="flag">Needs review</Badge>
        ) : (
          <Badge tone="verified" dot>Above evidence floor</Badge>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
        {items.map((item) => (
          <SkillRow
            key={item.id}
            item={item}
            override={overrides[item.id]}
            selectedId={selectedId}
            onSelect={onSelect}
            onOverride={(value, reason) => onOverride(item.id, value, reason, item.value)}
          />
        ))}
      </div>

      <div className="border-t border-rule p-3">
        <div className="flex items-center gap-2 rounded-[6px] border border-rule bg-chalk/55 px-2.5 py-2">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-ultramarine" />
          <p className="min-w-0 flex-1 text-[9.5px] leading-relaxed text-slate">
            {candidate.score.summary}
          </p>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <button
            type="button"
            onClick={onOpenTrace}
            className="inline-flex items-center gap-1.5 text-[10px] font-medium text-ultramarine hover:underline hover:underline-offset-2"
          >
            How was this decided?
          </button>
          <span className="flex items-center gap-1 text-[9px] text-slate" title="Evidence quality is a heuristic, not a calibrated probability.">
            <Info className="h-2.5 w-2.5" />
            heuristic, not a prediction
          </span>
        </div>
      </div>
    </div>
  );
}

function SkillRow({
  item,
  override,
  selectedId,
  onSelect,
  onOverride,
}: {
  item: SkillScore;
  override?: Override;
  selectedId: string | null;
  onSelect: (id: string, segmentSeq: number) => void;
  onOverride: (value: number, reason: string) => void;
}) {
  const [open, setOpen] = useState(item.insufficientEvidence ?? false);
  const value = override?.to ?? item.value;
  const blocks = 10;

  return (
    <div className={cn("border-b border-rule/70", item.insufficientEvidence && "bg-flag-soft/30")}>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="min-w-0 flex-1 text-left"
          aria-expanded={open}
        >
          <div className="flex items-center gap-2">
            <span className="truncate text-[12px] font-medium text-ink">{item.label}</span>
            <span className="font-mono text-[8.5px] text-slate/60">{Math.round(item.weight * 100)}%</span>
            {item.insufficientEvidence ? <Badge tone="flag">insufficient evidence</Badge> : null}
            {override ? <Badge tone="ultra">changed</Badge> : null}
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex h-2 flex-1 gap-[2px]" aria-hidden="true">
              {Array.from({ length: blocks }).map((_, index) => {
                const filled = index < Math.round((value / 5) * blocks);
                return (
                  <span
                    key={index}
                    className={cn(
                      "h-full flex-1 rounded-[1px]",
                      filled
                        ? item.insufficientEvidence
                          ? "bg-flag/60"
                          : value >= 4
                            ? "bg-verified"
                            : value >= 3
                              ? "bg-flag"
                              : "bg-onair"
                        : "bg-rule/70",
                    )}
                  />
                );
              })}
            </div>
            <span className="w-7 text-right font-mono text-[10.5px] tabular text-ink">{value.toFixed(1)}</span>
            <ChevronDown
              className={cn("h-3 w-3 shrink-0 text-slate transition-transform", open && "rotate-180")}
              onClick={(event) => {
                event.stopPropagation();
                setOpen((current) => !current);
              }}
            />
          </div>
        </button>
      </div>

      {open ? (
        <div className="animate-rise px-3 pb-3">
          <p className="text-[10.5px] leading-relaxed text-slate">{item.reasoning}</p>
          <div className="mt-2 space-y-1.5">
            {item.evidence.map((evidence) => (
              <button
                key={evidence.id}
                type="button"
                onClick={() => onSelect(evidence.id, evidence.segmentSeq)}
                className={cn(
                  "flex w-full items-start gap-2 rounded-[4px] border px-2 py-1.5 text-left transition",
                  evidence.id === selectedId
                    ? "border-ultramarine/40 bg-ultramarine-soft/70"
                    : "border-rule bg-white hover:border-slate/40",
                )}
              >
                <span
                  className={cn(
                    "mt-1 h-1.5 w-1.5 shrink-0 rotate-45",
                    evidence.verified ? "bg-ultramarine" : "border border-slate bg-transparent",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[10px] leading-relaxed text-ink">“{evidence.quote}”</span>
                  <span className="mt-0.5 flex items-center gap-2 text-[8.5px] text-slate">
                    <span className="font-mono">{formatTime(evidence.tStartMs)}</span>
                    <span>{evidence.verified ? "verified in transcript" : "not found · unverified"}</span>
                  </span>
                </span>
              </button>
            ))}
            {item.evidence.length === 0 ? (
              <p className="rounded-[4px] border border-dashed border-rule px-2 py-1.5 text-[9.5px] text-slate">
                No evidence quotes were returned for this skill.
              </p>
            ) : null}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[9px] text-slate">
              {override ? `Changed from ${override.from.toFixed(1)} · ${override.reason}` : "Recruiter override writes to the audit trail."}
            </span>
            <EditScore value={value} onSubmit={onOverride} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function EditScore({ value, onSubmit }: { value: number; onSubmit: (value: number, reason: string) => void }) {
  const [open, setOpen] = useState(false);
  const [next, setNext] = useState(value);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!reason.trim()) {
      setError("Add a short reason. It is stored with the change.");
      return;
    }
    onSubmit(next, reason.trim());
    setOpen(false);
    setReason("");
    setError(null);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-[9.5px] font-medium text-slate hover:text-ink"
        >
          <ClipboardPenLine className="h-3 w-3" />
          Edit score
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          align="end"
          className="z-50 w-[260px] rounded-[8px] border border-rule bg-paper p-3 shadow-[0_14px_40px_-12px_rgba(11,16,48,0.3)]"
        >
          <p className="text-[11px] font-medium text-ink">Override this skill</p>
          <div className="mt-3 flex items-center gap-3">
            <Slider.Root
              value={[next]}
              min={1}
              max={5}
              step={0.5}
              onValueChange={([amount]) => setNext(amount)}
              className="relative flex h-5 flex-1 touch-none select-none items-center"
            >
              <Slider.Track className="relative h-1 flex-1 rounded-full bg-rule">
                <Slider.Range className="absolute h-full rounded-full bg-ultramarine" />
              </Slider.Track>
              <Slider.Thumb className="block h-3.5 w-3.5 rounded-full border border-white bg-ultramarine shadow" />
            </Slider.Root>
            <span className="w-6 text-right font-mono text-[11px] tabular text-ink">{next.toFixed(1)}</span>
          </div>
          <label htmlFor="override-reason" className="mt-3 block text-[9.5px] font-medium text-slate">
            Reason
          </label>
          <textarea
            id="override-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={2}
            placeholder="Why is the model wrong here?"
            className="mt-1 w-full resize-none rounded-[4px] border border-rule bg-white px-2 py-1.5 text-[11px] text-ink outline-none focus:border-ink"
          />
          {error ? <p className="mt-1 text-[9.5px] text-onair">{error}</p> : null}
          <div className="mt-2 flex items-center justify-end gap-1.5">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="ink" size="sm" onClick={submit}>
              Save override
            </Button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
