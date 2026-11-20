"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Flag, Pause, Play, SkipBack, SkipForward, Volume2 } from "lucide-react";
import type { Candidate, SkillId } from "@/lib/types";
import { cn, formatTime, seededPeaks } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const skillOrder: SkillId[] = ["clarity", "empathy", "listening", "problem_solving"];
const skillColor: Record<SkillId, string> = {
  clarity: "text-ultramarine",
  empathy: "text-onair",
  listening: "text-verified",
  problem_solving: "text-[#8b5cf6]",
};

export function EvidenceTimeline({
  candidate,
  selectedId,
  onSelect,
  audioUrl,
  compact = false,
}: {
  candidate: Candidate;
  selectedId: string | null;
  onSelect: (id: string, segmentSeq: number) => void;
  audioUrl?: string;
  compact?: boolean;
}) {
  const duration = candidate.durationMs || 1;
  const peaks = useMemo(() => seededPeaks(candidate.id.length * 71 + candidate.transcript.length * 13, 156), [candidate]);
  const [playing, setPlaying] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const [rate, setRate] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationRef = useRef<number | null>(null);

  const markers = useMemo(
    () =>
      candidate.score.items.flatMap((item) =>
        item.evidence.map((evidence) => ({
          ...evidence,
          label: item.label,
          skill: item.id,
        })),
      ),
    [candidate.score.items],
  );

  const selected = markers.find((marker) => marker.id === selectedId);
  const playheadMs = selected?.tStartMs ?? currentMs;
  const playheadPct = Math.min(100, Math.max(0, (playheadMs / duration) * 100));

  const stopAnimation = useCallback(() => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
  }, []);

  useEffect(() => {
    if (!playing || !audioRef.current) return;
    const tick = () => {
      const audio = audioRef.current;
      if (!audio) return;
      setCurrentMs(audio.currentTime * 1000);
      if (!audio.paused) animationRef.current = requestAnimationFrame(tick);
    };
    animationRef.current = requestAnimationFrame(tick);
    return stopAnimation;
  }, [playing, stopAnimation]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) {
      setPlaying((value) => !value);
      if (!playing) {
        const start = selected?.tStartMs ?? currentMs;
        setCurrentMs(start);
      }
      return;
    }
    if (audio.paused) {
      audio.currentTime = Math.max(0, playheadMs / 1000);
      audio.playbackRate = rate;
      void audio.play();
      setPlaying(true);
    } else {
      audio.pause();
      setPlaying(false);
    }
  };

  const step = (direction: 1 | -1) => {
    const sorted = [...markers].sort((a, b) => a.tStartMs - b.tStartMs);
    const index = sorted.findIndex((marker) => marker.id === selectedId);
    const next = sorted[Math.min(sorted.length - 1, Math.max(0, index + direction))] ?? sorted[0];
    if (next) {
      onSelect(next.id, next.segmentSeq);
      setCurrentMs(next.tStartMs);
    }
  };

  const seek = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const ms = pct * duration;
    setCurrentMs(ms);
    if (audioRef.current) audioRef.current.currentTime = ms / 1000;
    const nearest = [...markers]
      .sort((a, b) => Math.abs(a.tStartMs - ms) - Math.abs(b.tStartMs - ms))
      .find((marker) => Math.abs(marker.tStartMs - ms) < 6000);
    if (nearest) onSelect(nearest.id, nearest.segmentSeq);
  };

  return (
    <div className={cn("flex min-h-0 flex-col", compact ? "" : "h-full")}>
      <div className="flex items-center justify-between gap-3 border-b border-rule px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-ink">Evidence timeline</span>
          <span className="hidden text-[10px] text-slate sm:inline">
            {markers.length} quotes · {markers.filter((marker) => marker.verified).length} verified
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 text-[9.5px] text-slate sm:flex">
            <span className="h-1.5 w-1.5 rotate-45 bg-ink" /> verified
          </span>
          <span className="hidden items-center gap-1.5 text-[9.5px] text-slate sm:flex">
            <span className="h-1.5 w-1.5 rotate-45 border border-slate bg-transparent" /> unverified
          </span>
          <Badge tone={candidate.audioConsent ? "verified" : "neutral"} dot>
            {candidate.audioConsent ? "Audio available" : "Transcript only"}
          </Badge>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-x-auto overflow-y-hidden scroll-thin">
        <div className="flex min-w-[720px] flex-1 flex-col px-3 pb-2 pt-2 sm:min-w-0">
          <div className="mb-1 flex pl-[88px] pr-1">
            {Array.from({ length: 7 }).map((_, index) => (
              <span key={index} className="flex-1 font-mono text-[8.5px] tabular text-slate/60 first:text-left last:text-right">
                {formatTime((duration / 6) * index)}
              </span>
            ))}
          </div>

          <div className="flex flex-1 flex-col">
            <div className="flex">
              <div className="flex w-[88px] shrink-0 items-center pr-2">
                <div>
                  <p className="text-[9.5px] font-medium text-slate">Waveform</p>
                  <p className="text-[8.5px] text-slate/55">48 kPa · mono</p>
                </div>
              </div>
              <div
                className="relative h-10 flex-1 cursor-crosshair border-b border-rule/70"
                onClick={seek}
                role="slider"
                aria-label="Seek timeline"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round((currentMs / duration) * 100)}
                tabIndex={0}
              >
                <div className="absolute inset-0 flex items-center gap-px">
                  {peaks.map((peak, index) => {
                    const played = (index / peaks.length) * 100 <= playheadPct;
                    return (
                      <span
                        key={index}
                        className={cn("min-h-[1px] flex-1 rounded-[1px]", played ? "bg-ultramarine/80" : "bg-ink/15")}
                        style={{ height: `${Math.max(2, peak * 32)}px` }}
                      />
                    );
                  })}
                </div>
                <div
                  className="pointer-events-none absolute inset-y-0 w-px bg-ultramarine"
                  style={{ left: `${playheadPct}%` }}
                >
                  <span className="absolute -top-0.5 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full border border-white bg-ultramarine" />
                </div>
              </div>
            </div>

            {skillOrder.map((skill) => {
              const laneMarkers = markers.filter((marker) => marker.skill === skill).sort((a, b) => a.tStartMs - b.tStartMs);
              return (
                <div key={skill} className="flex h-6">
                  <div className="flex w-[88px] shrink-0 items-center pr-2">
                    <span className="truncate text-[9.5px] text-slate">
                      {candidate.score.items.find((item) => item.id === skill)?.label ?? skill}
                    </span>
                  </div>
                  <div className="relative flex-1 border-b border-rule/45">
                    <span className="absolute inset-x-0 top-1/2 h-px bg-rule/50" />
                    {laneMarkers.map((marker) => (
                      <button
                        key={marker.id}
                        type="button"
                        onClick={() => {
                          onSelect(marker.id, marker.segmentSeq);
                          setCurrentMs(marker.tStartMs);
                        }}
                        style={{ left: `${Math.min(98.5, Math.max(0.5, (marker.tStartMs / duration) * 100))}%` }}
                        className="group absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 p-2"
                        aria-label={`${marker.label} evidence at ${formatTime(marker.tStartMs)}${marker.verified ? "" : ", unverified"}`}
                        aria-pressed={selectedId === marker.id}
                      >
                        <span
                          className={cn(
                            "block h-[7px] w-[7px] rotate-45 border transition-transform group-hover:scale-125",
                            marker.verified
                              ? cn("border-transparent", marker.skill === "empathy" ? "bg-onair" : marker.skill === "listening" ? "bg-verified" : marker.skill === "problem_solving" ? "bg-[#8b5cf6]" : "bg-ultramarine")
                              : "border-slate bg-paper",
                            selectedId === marker.id && "ring-2 ring-ink/20 ring-offset-1",
                          )}
                        />
                        <span className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-1 hidden w-[210px] -translate-x-1/2 rounded-[5px] border border-ink/10 bg-ink px-2.5 py-1.5 text-left text-[9.5px] leading-snug text-mist shadow-lg group-hover:block group-focus-visible:block">
                          <span className="block font-medium text-chalk">{marker.label} · {formatTime(marker.tStartMs)}</span>
                          <span className="mt-0.5 block text-mist/60">“{marker.quote}”</span>
                          <span className={cn("mt-1 block text-[8.5px]", marker.verified ? "text-[#7ee2b8]" : "text-[#ff9aaf]")}>
                            {marker.verified ? "verified in transcript" : "quote not found · unverified"}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}

            <div className="flex h-6">
              <div className="flex w-[88px] shrink-0 items-center gap-1 pr-2">
                <Flag className="h-2.5 w-2.5 text-onair" />
                <span className="text-[9.5px] text-slate">Flags</span>
              </div>
              <div className="relative flex-1 border-b border-rule/45">
                <span className="absolute inset-x-0 top-1/2 h-px bg-rule/50" />
                {candidate.flags.includes("injection") || candidate.transcript.some((segment) => segment.flags?.includes("injection")) ? (
                  <span
                    className="absolute top-1/2 z-10 flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[3px] border border-onair/30 bg-onair-soft"
                    style={{
                      left: `${((candidate.transcript.find((segment) => segment.flags?.includes("injection"))?.tStartMs ?? duration * 0.1) / duration) * 100}%`,
                    }}
                    title="Injection attempt blocked"
                  >
                    <Flag className="h-2 w-2 text-onair" />
                  </span>
                ) : null}
                {candidate.flags.includes("long_silence") ? (
                  <span
                    className="absolute top-1/2 z-10 flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[3px] border border-flag/40 bg-flag-soft"
                    style={{ left: "70%" }}
                    title="Long silence"
                  >
                    <Flag className="h-2 w-2 text-[#8e6a00]" />
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-rule pt-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => step(-1)}
                className="flex h-7 w-7 items-center justify-center rounded-[4px] border border-rule bg-white text-slate hover:border-ink hover:text-ink"
                aria-label="Previous evidence marker"
              >
                <SkipBack className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={togglePlay}
                className="flex h-7 w-7 items-center justify-center rounded-[4px] border border-ink bg-ink text-chalk hover:bg-[#1b2942]"
                aria-label={playing ? "Pause review playback" : "Play review playback"}
              >
                {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3 fill-chalk" />}
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                className="flex h-7 w-7 items-center justify-center rounded-[4px] border border-rule bg-white text-slate hover:border-ink hover:text-ink"
                aria-label="Next evidence marker"
              >
                <SkipForward className="h-3 w-3" />
              </button>
            </div>
            <span className="font-mono text-[10px] tabular text-slate">
              {formatTime(playheadMs)} / {formatTime(duration)}
            </span>
            <div className="flex items-center gap-1 text-[9.5px] text-slate">
              <Volume2 className="h-3 w-3" />
              {candidate.audioConsent ? "Audio consented" : "No recording consent"}
            </div>
            {audioUrl ? <audio ref={audioRef} src={audioUrl} preload="metadata" /> : null}
            <div className="ml-auto flex items-center gap-1 rounded-[4px] border border-rule bg-white p-0.5">
              {[0.75, 1, 1.25, 1.5].map((speed) => (
                <button
                  key={speed}
                  type="button"
                  onClick={() => {
                    setRate(speed);
                    if (audioRef.current) audioRef.current.playbackRate = speed;
                  }}
                  className={cn(
                    "rounded-[3px] px-1.5 py-0.5 font-mono text-[9px]",
                    rate === speed ? "bg-ink text-chalk" : "text-slate hover:text-ink",
                  )}
                >
                  {speed}×
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
