"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useMicLevel } from "@/components/voice/use-mic-level";

export function MicWave({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { status, level, error, start, stop } = useMicLevel({ smoothing: 0.8 });
  const levelRef = useRef(0);
  const [hasTried, setHasTried] = useState(false);
  levelRef.current = level;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let frame = 0;
    let running = true;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const draw = (time: number) => {
      if (!running) return;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      context.clearRect(0, 0, width, height);
      const gap = 5;
      const barWidth = 3;
      const count = Math.max(24, Math.floor((width + gap) / (barWidth + gap)));
      const center = height / 2;
      const energy = levelRef.current;

      for (let index = 0; index < count; index += 1) {
        const position = index / count;
        const envelope = Math.sin(position * Math.PI);
        const idle =
          Math.sin(position * Math.PI * 7 + time * 0.0011) * 0.16 +
          Math.sin(position * Math.PI * 13 - time * 0.0007) * 0.08;
        const live =
          Math.sin(position * Math.PI * 11 + time * 0.004) * 0.34 +
          Math.sin(position * Math.PI * 3 - time * 0.0023) * 0.28;
        const base = 0.1 + Math.abs(idle) + Math.abs(live) * energy * 1.7;
        const barHeight = Math.max(3, Math.min(height * 0.78, base * height * 0.72 * (0.5 + envelope * 0.8)));
        const x = index * (barWidth + gap) + gap / 2;
        const radius = barWidth / 2;

        context.fillStyle = energy > 0.03 && status === "live" ? "rgba(143,160,255,0.95)" : "rgba(201,208,240,0.45)";
        context.beginPath();
        context.roundRect(x, center - barHeight / 2, barWidth, barHeight, radius);
        context.fill();
      }

      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => {
      running = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [status]);

  const onStart = async () => {
    setHasTried(true);
    const ok = await start();
    if (!ok) return;
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[20px] bg-booth p-1 shadow-[0_30px_80px_-40px_rgba(11,16,48,0.7)]",
        className,
      )}
    >
      <div className="relative overflow-hidden rounded-[17px] border border-white/10 bg-booth-2">
        <div className="booth-grid pointer-events-none absolute inset-0 opacity-70" />
        <div className="relative flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-glow/30 bg-glow/10">
              <Mic className="h-2.5 w-2.5 text-glow" />
            </span>
            <span className="text-[10.5px] font-medium tracking-[0.04em] text-mist/80">
              {status === "live" ? "Microphone live" : "Live input"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("h-1.5 w-1.5 rounded-full", status === "live" ? "animate-onair bg-onair" : "bg-mist/25")} />
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-mist/60">
              {status === "live" ? "On air" : "Ready"}
            </span>
          </div>
        </div>

        <div className="relative flex h-[272px] items-center px-5 sm:h-[316px]">
          <canvas ref={canvasRef} className="absolute inset-x-5 top-1/2 h-40 -translate-y-1/2" aria-hidden="true" />
          <div className="relative z-10 mx-auto max-w-[290px] text-center">
            {status === "live" ? (
              <div className="animate-rise">
                <p className="text-[13px] text-mist">Good. I can hear you.</p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-mist/55">
                  This is the same signal the interviewer listens for.
                </p>
                <div className="mt-5 flex items-center justify-center gap-2">
                  <span className="flex h-6 items-end gap-[2px] rounded-[3px] border border-glow/25 bg-glow/10 px-1.5">
                    {[0.35, 0.7, 0.5, 0.85, 0.4].map((bar, index) => (
                      <span
                        key={index}
                        className="w-[2px] rounded-full bg-glow transition-all duration-100"
                        style={{ height: `${Math.max(3, bar * 14 * (0.35 + level * 1.8))}px` }}
                      />
                    ))}
                  </span>
                  <span className="font-mono text-[10px] tabular text-mist/50">{Math.round(level * 100)}%</span>
                </div>
                <Button variant="booth" size="sm" className="mt-5" onClick={stop}>
                  <MicOff className="h-3.5 w-3.5" />
                  Stop microphone
                </Button>
              </div>
            ) : (
              <div>
                <p className="font-display text-[28px] font-medium leading-none tracking-[-0.035em] text-mist">
                  Say hello.
                </p>
                <p className="mx-auto mt-2 max-w-[230px] text-[12.5px] leading-relaxed text-mist/55">
                  Hear what your voice looks like before a real interview. Nothing is stored.
                </p>
                <Button variant="booth" size="md" className="mt-6" onClick={onStart} disabled={status === "requesting"}>
                  {status === "requesting" ? (
                    <>Waiting for permission…</>
                  ) : hasTried ? (
                    <>
                      <RotateCcw className="h-3.5 w-3.5" />
                      Try the microphone again
                    </>
                  ) : (
                    <>
                      <Mic className="h-3.5 w-3.5" />
                      Try the microphone
                    </>
                  )}
                </Button>
                {error ? (
                  <p role="status" className="mx-auto mt-3 max-w-[250px] text-[11px] leading-relaxed text-onair">
                    {error}
                  </p>
                ) : (
                  <p className="mt-3 text-[10.5px] text-mist/35">No recording. No account needed.</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="relative flex items-center justify-between border-t border-white/10 px-4 py-2.5">
          <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-mist/35">16 kHz · mono</span>
          <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-mist/35">vaani · live</span>
        </div>
      </div>
    </div>
  );
}
