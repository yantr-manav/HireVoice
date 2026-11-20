import { cn } from "@/lib/utils";

type Tone = "neutral" | "ultra" | "verified" | "flag" | "onair" | "booth";

const tones: Record<Tone, string> = {
  neutral: "border-rule bg-white text-slate",
  ultra: "border-ultramarine/20 bg-ultramarine-soft text-[#2536c9]",
  verified: "border-verified/20 bg-verified-soft text-[#0a7f51]",
  flag: "border-flag/35 bg-flag-soft text-[#7a5b00]",
  onair: "border-onair/20 bg-onair-soft text-[#ba1c3f]",
  booth: "border-glow/25 bg-glow/10 text-glow",
};

export function Badge({
  children,
  tone = "neutral",
  className,
  dot,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-[4px] border px-1.5 py-0.5 text-[10.5px] font-medium leading-4",
        tones[tone],
        className,
      )}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

export function LivePill({ label = "Live", className }: { label?: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-onair/30 bg-onair-soft px-2 py-0.5 text-[10.5px] font-semibold text-[#c01e42]",
        className,
      )}
    >
      <span className="animate-onair h-1.5 w-1.5 rounded-full bg-onair" />
      {label}
    </span>
  );
}

export function StatusDot({
  status,
  className,
}: {
  status: "idle" | "working" | "waiting" | "blocked" | "connected" | "error" | "planned";
  className?: string;
}) {
  const color =
    status === "working"
      ? "bg-ultramarine"
      : status === "waiting"
        ? "bg-flag"
        : status === "blocked" || status === "error"
          ? "bg-onair"
          : status === "connected"
            ? "bg-verified"
            : status === "planned"
              ? "bg-rule"
              : "bg-slate/50";
  return <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", color, className)} />;
}
