import type { EvidenceQualityParts } from "@/lib/types";
import { cn } from "@/lib/utils";

export function evidenceQualityLabel(value: number) {
  if (value >= 0.8) return "High";
  if (value >= 0.6) return "Medium";
  return "Low";
}

export function ConfidenceMeter({
  value,
  parts,
  compact = false,
  className,
}: {
  value: number;
  parts?: EvidenceQualityParts;
  compact?: boolean;
  className?: string;
}) {
  const partsArray = parts
    ? [parts.verifiedRatio, parts.consistency, parts.rubricCoverage, parts.transcriptQuality]
    : [value * 0.95, value * 0.88, value, value * 0.9];
  const label = evidenceQualityLabel(value);
  const tone = value >= 0.8 ? "text-verified" : value >= 0.6 ? "text-flag" : "text-onair";

  return (
    <div className={cn("group relative", className)}>
      <div className="flex items-end gap-[3px]" aria-hidden="true">
        {partsArray.map((part, index) => {
          const base = compact ? 10 : 16;
          const height = Math.max(4, Math.round(base * (0.25 + Math.min(1, Math.max(0, part)) * 0.75)));
          return (
            <span
              key={index}
              className={cn(
                "w-[3px] rounded-[1px] bg-current transition-all",
                value >= 0.8 ? "text-verified" : value >= 0.6 ? "text-flag" : "text-onair",
              )}
              style={{ height: `${height}px` }}
            />
          );
        })}
      </div>
      {!compact ? (
        <span className={cn("mt-1 block text-[10px] font-medium", tone)}>{label}</span>
      ) : null}
      <div
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden w-[230px] -translate-x-1/2 rounded-[6px] border border-ink/10 bg-ink px-3 py-2 text-left shadow-lg group-hover:block group-focus-within:block"
      >
        <p className="text-[10px] font-medium text-chalk">Evidence quality · {label}</p>
        <p className="mt-1 text-[9.5px] leading-relaxed text-mist/60">
          A heuristic, not a probability that the candidate will perform well.
        </p>
        <dl className="mt-2 space-y-1">
          {[
            ["Verified quotes", partsArray[0]],
            ["Self-consistency", partsArray[1]],
            ["Rubric coverage", partsArray[2]],
            ["Transcript quality", partsArray[3]],
          ].map(([name, part]) => (
            <div key={String(name)} className="flex items-center justify-between gap-2">
              <dt className="text-[9px] text-mist/50">{name}</dt>
              <dd className="font-mono text-[9px] text-mist/80">{Math.round(Number(part) * 100)}%</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
