"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * 60fps canvas waveform driven directly by `barsRef` with ZERO React re-renders.
 * Eliminates React reconciliation lag so live captions stay instantaneous.
 */
export function LiveWaveform({
  barsRef,
  active,
  height = 84,
  barColor = "#8FA0FF",
  idleColor = "rgba(201, 208, 240, 0.18)",
  className = "",
}: {
  barsRef: RefObject<Float32Array>;
  active: boolean;
  height?: number;
  barColor?: string;
  idleColor?: string;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;

    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.clientWidth || 320;
      const targetW = Math.round(width * dpr);
      const targetH = Math.round(height * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const bars = barsRef.current;
      const count = bars ? bars.length : 32;
      const gap = 4;
      const barW = Math.max(2.5, (width - gap * (count - 1)) / count);
      const midY = height / 2;

      for (let i = 0; i < count; i += 1) {
        // Mirror slightly so spectrum looks balanced and symmetric
        const mirrorIdx = i < count / 2 ? i * 2 : (count - 1 - i) * 2;
        const val = active && bars ? (bars[Math.min(count - 1, mirrorIdx)] ?? 0) : 0;
        const minH = 5;
        const barH = Math.max(minH, val * (height - 10));
        const x = i * (barW + gap);
        const y = midY - barH / 2;

        ctx.fillStyle = active && val > 0.04 ? barColor : idleColor;
        ctx.beginPath();
        const r = Math.min(barW / 2, barH / 2);
        ctx.roundRect(x, y, barW, barH, r);
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [active, barColor, barsRef, height, idleColor]);

  return (
    <canvas
      ref={canvasRef}
      style={{ height: `${height}px` }}
      className={`block w-full ${className}`}
      aria-hidden="true"
    />
  );
}
