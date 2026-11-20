"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  CircleSlash2,
  ClipboardList,
  Cloud,
  FileSignature,
  FileText,
  FolderPlus,
  Kanban,
  Loader2,
  Mail,
  PackagePlus,
  ShieldAlert,
  Sparkles,
  Table2,
  UserRound,
  X,
} from "lucide-react";
import type { AgentAction, AgentPlan } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RichText } from "@/components/ui/rich-text";

const toolIcons: Record<string, typeof Mail> = {
  navigate: ArrowUpRight,
  list_review_queue: Check,
  find_candidate: UserRound,
  candidate_evidence: FileText,
  workspace_metrics: Table2,
  list_approvals: Check,
  list_roles: FileText,
  mail_search: Mail,
  mail_read: Mail,
  calendar_range: CalendarDays,
  calendar_free_slots: CalendarDays,
  schedule_interview: CalendarDays,
  send_email: Mail,
  draft_email: Mail,
  draft_feedback: Mail,
  send_invite: Mail,
  shortlist_candidate: Check,
  close_candidate: CircleSlash2,
  move_candidate_stage: Kanban,
  pipeline_summary: Kanban,
  archive_mail: Mail,
  create_doc: FileText,
  create_sheet: Table2,
  update_sheet: Table2,
  list_sheets: Table2,
  read_sheet: Table2,
  clean_sheet: Sparkles,
  create_folder: FolderPlus,
  create_application_form: ClipboardList,
  update_application_form: ClipboardList,
  list_forms: ClipboardList,
  list_form_responses: ClipboardList,
  export_form_to_sheet: Table2,
  create_hiring_kit: PackagePlus,
  generate_offer_letter: FileSignature,
  append_tracker: Table2,
  drive_files: Cloud,
  mark_mail_read: Mail,
};

const sourceLabel = {
  gemini: "Gemini",
  gemma: "Gemma",
  fallback: "Local parser",
  manual: "Recruiter",
} as const;

function statusBadge(action: AgentAction) {
  if (action.status === "proposed") return <Badge tone="flag">Needs approval</Badge>;
  if (action.status === "approved") return <Badge tone="neutral">Approved</Badge>;
  if (action.status === "executed")
    return <Badge tone="verified" dot>{action.result?.simulated ? "Prepared" : "Done"}</Badge>;
  if (action.status === "rejected") return <Badge tone="neutral">Rejected</Badge>;
  return <Badge tone="onair">Failed</Badge>;
}

export function PlanStep({
  action,
  busy,
  onDecide,
}: {
  action: AgentAction;
  busy?: boolean;
  onDecide?: (id: string, decision: "approve" | "reject") => void;
}) {
  const Icon = toolIcons[action.tool] ?? Sparkles;
  const result = action.result;
  const pending = action.mutating && action.status === "proposed";

  return (
    <li className="px-4 py-3.5">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] border",
            action.status === "failed"
              ? "border-onair/25 bg-onair-soft text-onair"
              : action.status === "executed"
                ? "border-verified/25 bg-verified-soft text-verified"
                : pending
                  ? "border-flag/35 bg-flag-soft text-[#7a5b00]"
                  : "border-rule bg-white text-slate",
          )}
        >
          <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[12.5px] font-medium text-ink">{action.summary}</p>
            {statusBadge(action)}
          </div>

          <p className="mt-1 text-[10.5px] text-slate">
            {action.mutating ? "Writes on approval" : "Read-only · ran immediately"}
            <span className="mx-1.5 text-rule">/</span>
            <span className="font-mono text-[9.5px]">{action.tool}</span>
          </p>

          {result ? (
            <div className="mt-2.5 rounded-[8px] border border-rule bg-chalk/55 px-3.5 py-3">
              <p className="text-[11.5px] font-semibold text-ink">{result.title}</p>
              {result.detail ? (
                <RichText text={result.detail} compact className="mt-1 text-slate" />
              ) : null}

              {result.rows && result.rows.length > 0 ? (
                <ul className="mt-2.5 divide-y divide-rule/70 rounded-[6px] border border-rule/80 bg-white px-2.5">
                  {result.rows.slice(0, 8).map((row, index) => (
                    <li key={`${row.label}-${index}`} className="flex items-start justify-between gap-3 py-1.5 text-[10.5px]">
                      <span className="min-w-0 truncate text-slate">{row.label}</span>
                      <span className="max-w-[60%] shrink-0 text-right font-medium text-ink">{row.value}</span>
                    </li>
                  ))}
                </ul>
              ) : null}

              {result.links && result.links.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {result.links.map((link) =>
                    link.external ? (
                      <a
                        key={link.href}
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-[4px] border border-rule bg-white px-1.5 py-1 text-[10px] font-medium text-ink hover:border-ink"
                      >
                        {link.label}
                        <ArrowUpRight className="h-2.5 w-2.5" />
                      </a>
                    ) : (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="inline-flex items-center gap-1 rounded-[4px] border border-rule bg-white px-1.5 py-1 text-[10px] font-medium text-ink hover:border-ink"
                      >
                        {link.label}
                        <ArrowUpRight className="h-2.5 w-2.5" />
                      </Link>
                    ),
                  )}
                </div>
              ) : null}
            </div>
          ) : null}

          {action.error && action.status !== "rejected" ? (
            <p className="mt-2 text-[10.5px] leading-relaxed text-[#b51d3c]">{action.error}</p>
          ) : null}

          {pending && onDecide ? (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <Button
                variant="ink"
                size="sm"
                disabled={busy}
                onClick={() => onDecide(action.id, "approve")}
              >
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                Approve and run
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => onDecide(action.id, "reject")}
              >
                <X className="h-3 w-3" />
                Reject
              </Button>
              <span className="text-[10px] text-slate">Nothing external happens until you approve.</span>
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export function PlanView({
  plan,
  busyStep,
  onDecide,
  empty,
  className,
}: {
  plan: AgentPlan | null;
  busyStep?: string | null;
  onDecide?: (id: string, decision: "approve" | "reject") => void;
  empty?: React.ReactNode;
  className?: string;
}) {
  if (!plan) {
    return (
      <div className={cn("flex h-full min-h-[210px] flex-col items-center justify-center px-6 text-center", className)}>
        {empty ?? (
          <>
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-rule bg-paper">
              <Sparkles className="h-4 w-4 text-slate" strokeWidth={1.7} />
            </span>
            <p className="mt-3 max-w-[300px] text-[12px] leading-relaxed text-slate">
              Say what you need. I will show the plan first, then do only what you approve.
            </p>
          </>
        )}
      </div>
    );
  }

  const pending = plan.steps.filter((step) => step.mutating && step.status === "proposed").length;

  return (
    <div className={cn("overflow-hidden", className)}>
      <div className="border-b border-rule px-4 py-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={plan.intent === "Deletion blocked" ? "onair" : "ultra"} dot>
            {plan.intent}
          </Badge>
          <span className="font-mono text-[9.5px] text-slate">
            {plan.model ?? sourceLabel[plan.source]}
          </span>
          <span className="ml-auto text-[10px] text-slate">
            {pending > 0 ? `${pending} write${pending === 1 ? "" : "s"} waiting` : "No writes waiting"}
          </span>
        </div>
        <RichText text={plan.summary} compact className="mt-2.5 text-ink" />
        <p className="mt-1.5 text-[10px] italic leading-relaxed text-slate">“{plan.transcript}”</p>
      </div>

      {plan.steps.length > 0 ? (
        <ul className="divide-y divide-rule">
          {plan.steps.map((step) => (
            <PlanStep
              key={step.id}
              action={step}
              busy={busyStep === step.id}
              onDecide={onDecide}
            />
          ))}
        </ul>
      ) : plan.intent === "Deletion blocked" ? (
        <div className="flex items-start gap-2.5 bg-onair-soft/50 px-4 py-4 text-[11.5px] text-[#9b1b36]">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-onair" />
          <div>
            <p className="font-medium">No-deletion safety policy active</p>
            <p className="mt-0.5 text-[10.5px] leading-relaxed text-[#9b1b36]/85">
              Voice commands can create, update, search, schedule, draft, and export across HireVoice and Google Workspace — but deletions are blocked permanently.
            </p>
          </div>
        </div>
      ) : (
        <div className="px-4 py-6 text-center text-[11.5px] text-slate">
          No action was planned. Try naming a candidate, role, form, sheet, or time.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-rule bg-chalk/50 px-4 py-2">
        <span className="flex items-center gap-1.5 text-[9.5px] text-slate">
          <Check className="h-3 w-3 text-verified" />
          audit logged
        </span>
        <span className="flex items-center gap-1.5 text-[9.5px] text-slate">
          <CircleSlash2 className="h-3 w-3 text-slate" />
          no automatic rejections
        </span>
        <Link href="/app/voice" className="ml-auto text-[9.5px] font-medium text-slate hover:text-ink hover:underline">
          Open voice desk
        </Link>
      </div>
    </div>
  );
}
