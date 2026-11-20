"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Eye, EyeOff, ShieldCheck } from "lucide-react";
import type { Candidate, EvidencedQuote } from "@/lib/types";
import { cn, formatTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

function hasDevanagari(text: string) {
  return /[\u0900-\u097F]/.test(text);
}

function HighlightedText({ text, quotes }: { text: string; quotes: EvidencedQuote[] }) {
  const verified = quotes.filter((quote) => quote.verified && quote.quote.length > 4);
  if (verified.length === 0) {
    return <>{text}</>;
  }

  const ranges: { start: number; end: number; quote: EvidencedQuote }[] = [];
  for (const quote of verified) {
    const lowerText = text.toLowerCase();
    const lowerQuote = quote.quote.toLowerCase();
    let index = lowerText.indexOf(lowerQuote);
    while (index !== -1) {
      ranges.push({ start: index, end: index + quote.quote.length, quote });
      index = lowerText.indexOf(lowerQuote, index + 1);
    }
  }

  ranges.sort((a, b) => a.start - b.start);
  const merged: typeof ranges = [];
  for (const range of ranges) {
    const previous = merged[merged.length - 1];
    if (previous && range.start < previous.end) {
      previous.end = Math.max(previous.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }

  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  merged.forEach((range, index) => {
    if (range.start > cursor) nodes.push(text.slice(cursor, range.start));
    nodes.push(
      <mark
        key={`${range.start}-${index}`}
        title={`${range.quote.skill}: ${range.quote.verified ? "verified" : "unverified"}`}
        className="rounded-[2px] bg-ultramarine-soft px-0.5 text-ink [box-decoration-break:clone]"
      >
        {text.slice(range.start, range.end)}
      </mark>,
    );
    cursor = range.end;
  });
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return <>{nodes}</>;
}

export function TranscriptPane({
  candidate,
  selectedId,
  onSelect,
  revealed,
  onRevealChange,
}: {
  candidate: Candidate;
  selectedId: string | null;
  onSelect: (id: string, segmentSeq: number) => void;
  revealed: boolean;
  onRevealChange: (value: boolean) => void;
}) {
  const [evidenceOnly, setEvidenceOnly] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedSeq = candidate.score.items.flatMap((item) => item.evidence).find((item) => item.id === selectedId)?.segmentSeq;

  const visibleSegments = useMemo(() => {
    if (!evidenceOnly) return candidate.transcript;
    return candidate.transcript.filter((segment) =>
      candidate.score.items.some((item) => item.evidence.some((evidence) => evidence.segmentSeq === segment.seq)),
    );
  }, [candidate, evidenceOnly]);

  useEffect(() => {
    if (selectedSeq === undefined) return;
    const node = containerRef.current?.querySelector<HTMLElement>(`[data-seq="${selectedSeq}"]`);
    node?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedSeq]);

  const evidenceForSegment = (seq: number) =>
    candidate.score.items.flatMap((item) => item.evidence.filter((evidence) => evidence.segmentSeq === seq));

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule px-4 py-2.5">
        <div className="flex items-center gap-2">
          <h2 className="text-[12px] font-semibold text-ink">Transcript</h2>
          <span className="font-mono text-[9.5px] text-slate">{candidate.transcript.length} turns</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setEvidenceOnly((value) => !value)}
            className={cn(
              "flex h-6 items-center gap-1 rounded-[4px] border px-1.5 text-[9.5px] font-medium transition",
              evidenceOnly
                ? "border-ultramarine/25 bg-ultramarine-soft text-[#2536c9]"
                : "border-rule bg-white text-slate hover:border-slate/50",
            )}
            aria-pressed={evidenceOnly}
          >
            {evidenceOnly ? <Check className="h-2.5 w-2.5" /> : null}
            Evidence only
          </button>
          <button
            type="button"
            onClick={() => onRevealChange(!revealed)}
            className="flex h-6 items-center gap-1 rounded-[4px] border border-rule bg-white px-1.5 text-[9.5px] font-medium text-slate transition hover:border-slate/50"
          >
            {revealed ? <EyeOff className="h-2.5 w-2.5" /> : <Eye className="h-2.5 w-2.5" />}
            {revealed ? "Hide contact" : "Reveal contact"}
          </button>
        </div>
      </div>

      <div ref={containerRef} className="min-h-0 flex-1 overflow-y-auto scroll-thin">
        <ol className="divide-y divide-rule/70">
          {visibleSegments.map((segment) => {
            const evidence = evidenceForSegment(segment.seq);
            const isSelected = selectedSeq === segment.seq;
            const isCandidate = segment.speaker === "candidate";
            const flagged = segment.flags?.includes("injection");
            return (
              <li
                key={segment.seq}
                data-seq={segment.seq}
                className={cn(
                  "group relative px-4 py-3 transition-colors",
                  isSelected ? "bg-ultramarine-soft/60" : "hover:bg-white",
                )}
              >
                {isSelected ? <span className="absolute inset-y-0 left-0 w-[2px] bg-ultramarine" /> : null}
                <div className="flex items-baseline gap-2.5">
                  <span className="w-8 shrink-0 font-mono text-[9px] tabular text-slate/70">
                    {formatTime(segment.tStartMs)}
                  </span>
                  <span className={cn("w-16 shrink-0 truncate text-[10px] font-medium", isCandidate ? "text-ink" : "text-slate")}>
                    {isCandidate ? (revealed ? candidate.name.split(" ")[0] : "Candidate") : "Vaani"}
                  </span>
                  <p
                    className={cn(
                      "min-w-0 flex-1 text-[12.5px] leading-[1.65] text-ink",
                      hasDevanagari(segment.text) && "font-devanagari",
                      flagged && "rounded-[4px] bg-onair-soft px-1.5 py-0.5",
                    )}
                  >
                    <HighlightedText text={segment.text} quotes={evidence} />
                  </p>
                </div>

                {flagged ? (
                  <div className="mt-1.5 flex items-center gap-1.5 pl-[76px] text-[9.5px] text-[#a61c3a]">
                    <AlertTriangle className="h-3 w-3" />
                    Instruction attempt detected. This turn was excluded from scoring input.
                  </div>
                ) : null}

                {evidence.length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap gap-1 pl-[76px]">
                    {evidence.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onSelect(item.id, item.segmentSeq)}
                        className={cn(
                          "flex items-center gap-1 rounded-[3px] border px-1.5 py-0.5 text-[9px] font-medium transition",
                          item.verified
                            ? item.id === selectedId
                              ? "border-ultramarine bg-ultramarine text-white"
                              : "border-ultramarine/20 bg-white text-[#2536c9] hover:border-ultramarine/50"
                            : "border-dashed border-slate/40 bg-white text-slate hover:border-onair hover:text-onair",
                        )}
                        title={item.verified ? "Verified evidence" : "Quote not found in this segment"}
                      >
                        <span
                          className={cn(
                            "h-1 w-1 rotate-45",
                            item.verified ? (item.id === selectedId ? "bg-white" : "bg-ultramarine") : "border border-slate bg-transparent",
                          )}
                        />
                        {candidate.score.items.find((score) => score.id === item.skill)?.label ?? item.skill}
                        {!item.verified ? <span className="text-[8px]">unverified</span> : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
        {visibleSegments.length === 0 ? (
          <p className="px-4 py-8 text-center text-[11.5px] text-slate">
            No transcript turns contain evidence. Turn off “Evidence only” to read the full interview.
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-rule bg-chalk/50 px-4 py-2">
        <span className="flex items-center gap-1.5 text-[9.5px] text-slate">
          <ShieldCheck className="h-3 w-3 text-verified" />
          Identifiers redacted before scoring
        </span>
        <span className="flex items-center gap-1.5 text-[9.5px] text-slate">
          {revealed ? (
            <>
              <Badge tone="flag">Contact visible</Badge>
              <span className="font-mono text-[9px]">{candidate.email}</span>
            </>
          ) : (
            <>
              <span className="h-1.5 w-1.5 rotate-45 bg-ultramarine" />
              contact hidden
            </>
          )}
        </span>
      </div>
    </div>
  );
}
