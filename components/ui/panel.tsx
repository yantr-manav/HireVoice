import * as React from "react";
import { cn } from "@/lib/utils";

export function Panel({
  className,
  children,
  as: Comp = "section",
}: {
  className?: string;
  children: React.ReactNode;
  as?: React.ElementType;
}) {
  return (
    <Comp
      className={cn(
        "rounded-[10px] border border-rule bg-paper shadow-[0_1px_0_rgba(16,26,44,0.03)]",
        className,
      )}
    >
      {children}
    </Comp>
  );
}

export function PanelHeader({
  title,
  meta,
  action,
  className,
}: {
  title: React.ReactNode;
  meta?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3 border-b border-rule px-4 py-3", className)}>
      <div className="flex min-w-0 items-baseline gap-2.5">
        <h2 className="text-[12px] font-semibold tracking-[0.01em] text-ink">{title}</h2>
        {meta ? <span className="truncate text-[11.5px] text-slate">{meta}</span> : null}
      </div>
      {action}
    </div>
  );
}

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("text-[11px] font-medium tracking-[0.02em] text-slate", className)}>{children}</span>
  );
}

export function Rule({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-rule", className)} />;
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-[4px] border border-rule bg-white px-1 font-mono text-[10px] font-medium text-slate">
      {children}
    </kbd>
  );
}

export function Mono({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("font-mono tabular text-[11.5px]", className)}>{children}</span>;
}
