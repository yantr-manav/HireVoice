import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className, tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex h-7 w-7 shrink-0 items-end justify-center gap-[2px] rounded-[6px] pb-[5px]",
        tone === "light" ? "bg-ink" : "bg-glow",
        className,
      )}
    >
      <span className={cn("w-[2px] rounded-full", tone === "light" ? "bg-chalk" : "bg-booth", "h-[6px]")} />
      <span className={cn("w-[2px] rounded-full", tone === "light" ? "bg-chalk" : "bg-booth", "h-[12px]")} />
      <span className={cn("w-[2px] rounded-full", tone === "light" ? "bg-chalk" : "bg-booth", "h-[8px]")} />
      <span className={cn("w-[2px] rounded-full", tone === "light" ? "bg-chalk" : "bg-booth", "h-[15px]")} />
    </span>
  );
}

export function Logo({
  href = "/",
  tone = "light",
  className,
  compact = false,
}: {
  href?: string;
  tone?: "light" | "dark";
  className?: string;
  compact?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn("group inline-flex items-center gap-2.5 rounded-sm", className)}
      aria-label="Hirevoice home"
    >
      <LogoMark tone={tone} />
      {!compact && (
        <span
          className={cn(
            "font-display text-[19px] font-semibold tracking-[-0.03em]",
            tone === "light" ? "text-ink" : "text-mist",
          )}
        >
          Hirevoice
        </span>
      )}
    </Link>
  );
}
