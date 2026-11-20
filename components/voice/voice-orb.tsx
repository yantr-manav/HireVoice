"use client";

import { cn } from "@/lib/utils";

export function VoiceOrb({
  level = 0,
  speaking = false,
  listening = false,
  label = "Vaani",
  sublabel,
  progress = 0.18,
  size = "lg",
  className,
}: {
  level?: number;
  speaking?: boolean;
  listening?: boolean;
  label?: string;
  sublabel?: string;
  progress?: number;
  size?: "md" | "lg";
  className?: string;
}) {
  const dimension = size === "lg" ? "h-[300px] w-[300px] sm:h-[340px] sm:w-[340px]" : "h-[220px] w-[220px]";
  const energy = speaking ? 0.34 : level;
  const scale = 1 + energy * 0.2;
  const radius = 48;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className={cn("relative flex shrink-0 items-center justify-center", dimension, className)}>
      <div
        className={cn(
          "absolute inset-[3%] rounded-full border border-glow/10 transition-transform duration-150 ease-out",
          speaking && "animate-[hv-pulse_2.4s_ease-in-out_infinite]",
        )}
        style={{ transform: `scale(${1 + energy * 0.5})` }}
      />
      <div
        className="absolute inset-[12%] rounded-full border border-glow/15 transition-transform duration-150 ease-out"
        style={{ transform: `scale(${scale})` }}
      />
      <div
        className="absolute inset-[21%] rounded-full border border-glow/25 transition-transform duration-150 ease-out"
        style={{ transform: `scale(${1 + energy * 0.12})` }}
      />

      <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(143,160,255,0.14)" strokeWidth="0.6" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="rgba(143,160,255,0.82)"
          strokeWidth="0.8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - Math.min(1, Math.max(0, progress)))}
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>

      <div className="relative flex h-[58%] w-[58%] flex-col items-center justify-center rounded-full border border-glow/20 bg-booth-2 shadow-[inset_0_0_60px_rgba(143,160,255,0.08)]">
        <span
          className={cn(
            "font-display text-[28px] font-medium tracking-[-0.04em] text-mist transition-transform duration-150",
            speaking && "text-white",
          )}
          style={{ transform: `scale(${1 + energy * 0.04})` }}
        >
          {label}
        </span>
        <span className="mt-1 text-[10px] uppercase tracking-[0.14em] text-mist/45">
          {sublabel ?? (listening ? "Listening" : speaking ? "Speaking" : "Ready")}
        </span>
        <div className="mt-4 flex h-4 items-center gap-[3px]" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5, 6].map((bar) => {
            const base = [0.3, 0.55, 0.82, 1, 0.82, 0.55, 0.3][bar];
            return (
              <span
                key={bar}
                className="w-[2px] rounded-full bg-glow/70 transition-all duration-100"
                style={{ height: `${Math.max(3, base * 14 * (0.25 + energy * 2.2))}px` }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
