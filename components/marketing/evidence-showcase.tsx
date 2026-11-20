"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Flag, ShieldCheck } from "lucide-react";
import type { Candidate } from "@/lib/types";
import { cn, formatTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function EvidenceShowcase({ candidate }: { candidate: Candidate }) {
  const markers = useMemo(
    () =>
      candidate.score.items.flatMap((item) =>
        item.evidence.map((evidence) => ({ ...evidence, label: item.label })),
      ),
    [candidate.score.items],
  );
  const [selectedId, setSelectedId] = useState(
    markers.find((marker) => marker.skill === "empathy" && marker.verified)?.id ?? markers[0]?.id,
  );
  const selected = markers.find((marker) => marker.id === selectedId) ?? markers[0];
  const segment = candidate.transcript.find((item) => item.seq === selected?.segmentSeq);

  return (
    <div className="overflow-hidden rounded-[14px] border border-rule bg-paper shadow-[0_30px_80px_-50px_rgba(11,16,48,0.55)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule bg-chalk/55 px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full border border-rule bg-white font-mono text-[9px] text-slate">
            SK
          </span>
          <div>
            <p className="text-[11px] font-medium text-ink">{candidate.name}</p>
            <p className="font-mono text-[8.5px] text-slate">
              {candidate.alias} · {candidate.roleTitle}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="verified" dot>7/7 quotes verified</Badge>
          <span className="font-mono text-[9px] text-slate">rubric v3</span>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[250px_minmax(0,1fr)]">
        <div className="border-b border-rule lg:border-b-0 lg:border-r">
          <div className="flex items-end justify-between gap-3 border-b border-rule px-4 py-3">
            <div>
              <p className="text-[9px] uppercase tracking-[0.08em] text-slate">Overall</p>
              <p className="font-display text-[32px] font-medium leading-none tracking-[-0.045em] text-ink">
                {candidate.score.overall.toFixed(1)}
                <span className="ml-1 font-sans text-[11px] font-normal tracking-normal text-slate">/ 5</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-slate">Evidence</p>
              <p className="mt-0.5 flex items-center justify-end gap-1 text-[11px] font-medium text-verified">
                <ShieldCheck className="h-3 w-3" />
                {Math.round(candidate.score.evidenceQuality * 100)}%
              </p>
            </div>
          </div>

          <div className="divide-y divide-rule/70">
            {candidate.score.items.map((item) => {
              const first = item.evidence[0];
              const active = selected?.label === item.label;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => first && setSelectedId(first.id)}
                  className={cn(
                    "flex w-full items-center gap-2 px-4 py-2 text-left transition",
                    active ? "bg-ultramarine-soft/50" : "hover:bg-white",
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      item.insufficientEvidence
                        ? "bg-flag"
                        : item.value >= 4
                          ? "bg-verified"
                          : item.value >= 3
                            ? "bg-flag"
                            : "bg-onair",
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate text-[10.5px] text-ink">{item.label}</span>
                  <span className="font-mono text-[10px] tabular text-slate">{item.value.toFixed(1)}</span>
                </button>
              );
            })}
          </div>

          <div className="border-t border-rule bg-chalk/35 px-4 py-2">
            <p className="text-[8.5px] leading-relaxed text-slate">
              Every score points at a transcript moment. Missing evidence is never scored as zero.
            </p>
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex items-center justify-between gap-2 border-b border-rule px-4 py-2">
            <p className="text-[10px] font-medium text-slate">Selected evidence</p>
            <span className="font-mono text-[8.5px] text-slate">
              {selected ? `${selected.label} · ${formatTime(selected.tStartMs)}` : "No evidence"}
            </span>
          </div>

          <div className="px-4 py-3">
            {selected ? (
              <blockquote className="rounded-[6px] border border-rule bg-white p-3">
                <p className="text-[12px] leading-[1.7] text-ink">“{selected.quote}”</p>
                <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-rule/80 pt-2">
                  <span
                    className={cn(
                      "flex items-center gap-1 rounded-[3px] border px-1.5 py-0.5 text-[8.5px] font-medium",
                      selected.verified
                        ? "border-verified/25 bg-verified-soft text-[#0a7f51]"
                        : "border-dashed border-slate/40 bg-white text-slate",
                    )}
                  >
                    {selected.verified ? <Check className="h-2.5 w-2.5" /> : <Flag className="h-2.5 w-2.5" />}
                    {selected.verified ? "verified in transcript" : "not found · unverified"}
                  </span>
                  <span className="font-mono text-[8.5px] text-slate">
                    segment {selected.segmentSeq} · {formatTime(selected.tStartMs)}–{formatTime(selected.tEndMs)}
                  </span>
                </div>
              </blockquote>
            ) : null}

            <div className="mt-3">
              <p className="text-[9px] font-medium uppercase tracking-[0.06em] text-slate">
                Transcript moment
              </p>
              {segment ? (
                <div className="mt-1.5 flex gap-2.5 rounded-[5px] bg-chalk/60 px-3 py-2.5">
                  <span className="w-8 shrink-0 font-mono text-[8.5px] text-slate">
                    {formatTime(segment.tStartMs)}
                  </span>
                  <span className="w-12 shrink-0 text-[9px] font-medium text-slate">Candidate</span>
                  <p className="min-w-0 flex-1 text-[11px] leading-relaxed text-ink">{segment.text}</p>
                </div>
              ) : null}
              {candidate.transcript
                .filter((item) => item.seq === (selected?.segmentSeq ?? 0) + 1)
                .slice(0, 1)
                .map((next) => (
                  <div key={next.seq} className="mt-1 flex gap-2.5 px-3 py-1.5 opacity-60">
                    <span className="w-8 shrink-0 font-mono text-[8.5px] text-slate">{formatTime(next.tStartMs)}</span>
                    <span className="w-12 shrink-0 text-[9px] font-medium text-slate">Vaani</span>
                    <p className="min-w-0 flex-1 text-[10px] leading-relaxed text-slate">{next.text}</p>
                  </div>
                ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-1">
              {markers.map((marker) => (
                <button
                  key={marker.id}
                  type="button"
                  onClick={() => setSelectedId(marker.id)}
                  className={cn(
                    "flex items-center gap-1 rounded-[3px] border px-1.5 py-0.5 text-[8.5px] transition",
                    selectedId === marker.id
                      ? "border-ultramarine bg-ultramarine text-white"
                      : marker.verified
                        ? "border-ultramarine/20 bg-white text-[#2536c9] hover:border-ultramarine/50"
                        : "border-dashed border-slate/40 bg-white text-slate",
                  )}
                >
                  <span
                    className={cn(
                      "h-1 w-1 rotate-45",
                      marker.verified ? (selectedId === marker.id ? "bg-white" : "bg-ultramarine") : "border border-slate",
                    )}
                  />
                  {marker.label} {formatTime(marker.tStartMs)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-rule bg-chalk/50 px-4 py-2">
        <span className="flex items-center gap-1.5 text-[8.5px] text-slate">
          <ShieldCheck className="h-3 w-3 text-verified" />
          Identifiers redacted before scoring. A recruiter owns the decision.
        </span>
        <Link
          href={`/app/roles/${candidate.roleId}/candidates/${candidate.id}`}
          className="inline-flex items-center gap-1 text-[9px] font-medium text-ultramarine hover:underline hover:underline-offset-2"
        >
          Open the full evidence screen
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
