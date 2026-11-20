import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

export function Funnel({ role }: { role: Role }) {
  const steps = [
    { label: "Invited", value: role.invited, color: "bg-ink/12" },
    { label: "Interviewed", value: role.interviewed, color: "bg-ink/28" },
    { label: "In review", value: role.inReview, color: "bg-flag" },
    { label: "Shortlisted", value: role.shortlisted, color: "bg-ultramarine" },
    { label: "Scheduled", value: role.scheduled, color: "bg-verified" },
  ];
  const max = Math.max(...steps.map((step) => step.value), 1);

  return (
    <div>
      <div className="flex items-end gap-[3px]">
        {steps.map((step) => (
          <div key={step.label} className="min-w-0 flex-1">
            <div className="mb-1.5 flex items-baseline justify-between gap-1">
              <span className="truncate text-[10px] text-slate">{step.label}</span>
              <span className="font-mono text-[10px] tabular text-ink">{step.value}</span>
            </div>
            <div className="h-2 w-full rounded-[2px] bg-rule/45">
              <div
                className={cn("h-full rounded-[2px]", step.color)}
                style={{ width: `${Math.max(4, (step.value / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-rule pt-2.5">
        <p className="text-[10.5px] text-slate">
          {role.invited} invited · {Math.round((role.interviewed / Math.max(role.invited, 1)) * 100)}% completed the screen
        </p>
        <Link
          href={`/app/roles/${role.id}`}
          className="inline-flex items-center gap-1 text-[10.5px] font-medium text-ultramarine hover:underline hover:underline-offset-2"
        >
          Open role <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
