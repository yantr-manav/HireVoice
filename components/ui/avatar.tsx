import { cn } from "@/lib/utils";

export function Avatar({
  initials,
  size = "md",
  className,
  tone = "ink",
}: {
  initials: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  tone?: "ink" | "ultra" | "booth";
}) {
  const dimensions = {
    xs: "h-6 w-6 text-[9px]",
    sm: "h-7 w-7 text-[10px]",
    md: "h-8 w-8 text-[11px]",
    lg: "h-10 w-10 text-[12px]",
  }[size];

  const colors = {
    ink: "bg-ink text-chalk",
    ultra: "bg-ultramarine text-white",
    booth: "bg-booth-3 text-glow",
  }[tone];

  return (
    <span
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold tracking-[0.02em]",
        dimensions,
        colors,
        className,
      )}
      aria-hidden="true"
    >
      {initials.slice(0, 2).toUpperCase()}
    </span>
  );
}
