"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowUpRight,
  CalendarPlus,
  Check,
  ChevronDown,
  CircleSlash2,
  Clock3,
  Cpu,
  FileText,
  Inbox,
  Lock,
  Mail,
  Plug,
  RotateCcw,
  ShieldCheck,
  Table2,
  Terminal,
  X,
} from "lucide-react";
import type { Agent, AgentRun, Approval, Workspace } from "@/lib/types";
import { cn, formatRelative, formatTime } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { ActionsFeed } from "@/components/crew/actions-feed";

const tabs = [
  { id: "crew", label: "Crew" },
  { id: "approvals", label: "Approvals" },
  { id: "runs", label: "Runs" },
  { id: "actions", label: "Agent actions" },
  { id: "permissions", label: "Permissions" },
] as const;

type Tab = (typeof tabs)[number]["id"];

function statusLabel(status: AgentRun["status"]) {
  if (status === "awaiting_approval") return "Awaiting approval";
  return status[0].toUpperCase() + status.slice(1);
}

function approvalIcon(kind: Approval["kind"]) {
  if (kind === "calendar") return CalendarPlus;
  if (kind === "sheets") return Table2;
  return Mail;
}

export function CrewConsole({ workspace, initialTab = "crew" }: { workspace: Workspace; initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [approvals, setApprovals] = useState(workspace.approvals);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [expandedRun, setExpandedRun] = useState<string | null>(workspace.runs[0]?.id ?? null);
  const [preview, setPreview] = useState<Approval | null>(null);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const pending = approvals.filter((approval) => approval.status === "pending");
  const decide = (approval: Approval, status: "approved" | "rejected") => {
    setApprovals((current) =>
      current.map((item) => (item.id === approval.id ? { ...item, status } : item)),
    );
    setPreview(null);
    if (status === "approved") {
      toast.success("Approved in this demo.", {
        description:
          approval.kind === "calendar"
            ? "In the live workspace the Scheduler would create the event once, then log the result."
            : "In the live workspace the email would send once and be recorded in the audit trail.",
      });
    } else {
      toast("Rejected. Nothing was sent.", {
        description: "The agent receives the reason and stops this run.",
      });
    }
  };

  return (
    <div className="mx-auto max-w-[1480px] px-4 py-5 sm:px-6 sm:py-7 xl:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium text-slate">
            {workspace.agents.length} agents · {pending.length} waiting for a human
          </p>
          <h1 className="mt-1 font-display text-[32px] font-medium leading-none tracking-[-0.04em] text-ink sm:text-[38px]">
            Crew
          </h1>
          <p className="mt-1.5 max-w-[600px] text-[13px] leading-relaxed text-slate">
            The agents that run interviews and prepare work. Every external action waits for your
            approval. No agent can reject a candidate.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-[6px] border border-verified/25 bg-verified-soft px-2.5 py-1.5 text-[10.5px] text-[#0a7f51]">
            <ShieldCheck className="h-3.5 w-3.5" />
            Human gate on every write
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-1 overflow-x-auto border-b border-rule scroll-thin">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            aria-selected={tab === item.id}
            role="tab"
            className={cn(
              "relative h-9 whitespace-nowrap px-3 text-[12px] font-medium transition",
              tab === item.id ? "text-ink" : "text-slate hover:text-ink",
            )}
          >
            {item.label}
            {item.id === "approvals" && pending.length > 0 ? (
              <span className="ml-1.5 rounded-[3px] border border-flag/35 bg-flag-soft px-1 font-mono text-[9px] text-[#7a5b00]">
                {pending.length}
              </span>
            ) : null}
            {tab === item.id ? (
              <span className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-ink" />
            ) : null}
          </button>
        ))}
      </div>

      {tab === "crew" ? (
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
          <Panel className="overflow-hidden">
            <PanelHeader title="The crew" meta="Tap an agent for scopes and tools" />
            <div className="divide-y divide-rule">
              {workspace.agents.map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => setSelectedAgent(agent)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white"
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-[7px] border",
                      agent.status === "blocked"
                        ? "border-onair/25 bg-onair-soft"
                        : agent.status === "waiting"
                          ? "border-flag/35 bg-flag-soft"
                          : agent.status === "working"
                            ? "border-ultramarine/25 bg-ultramarine-soft"
                            : "border-rule bg-chalk/60",
                    )}
                  >
                    <Cpu
                      className={cn(
                        "h-4 w-4",
                        agent.status === "blocked"
                          ? "text-onair"
                          : agent.status === "waiting"
                            ? "text-[#8e6a00]"
                            : agent.status === "working"
                              ? "text-ultramarine"
                              : "text-slate",
                      )}
                      strokeWidth={1.7}
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[12.5px] font-medium text-ink">{agent.name}</p>
                      <span className="font-mono text-[9px] uppercase tracking-[0.06em] text-slate/70">
                        {agent.tier}
                      </span>
                      <Badge tone={agent.autonomy === "auto" ? "neutral" : agent.autonomy === "ask" ? "flag" : "ultra"}>
                        {agent.autonomy === "auto" ? "automatic" : agent.autonomy === "ask" ? "asks first" : "suggests"}
                      </Badge>
                    </div>
                    <p className="mt-0.5 truncate text-[10.5px] text-slate">{agent.role}</p>
                    <p className="mt-1 flex items-center gap-2 font-mono text-[9px] text-slate/70">
                      <span>{agent.model}</span>
                      <span className="h-2 w-px bg-rule" />
                      <span>{agent.runsToday} runs today</span>
                      <span className="h-2 w-px bg-rule" />
                      <span>{Math.round(agent.successRate * 100)}% success</span>
                    </p>
                  </div>
                  <div className="hidden items-center gap-2 sm:flex">
                    <StatusDot status={agent.status} />
                    <span className="w-[72px] text-right text-[10px] text-slate">
                      {agent.status === "working"
                        ? "working"
                        : agent.status === "waiting"
                          ? "needs you"
                          : agent.status === "blocked"
                            ? "blocked"
                            : "idle"}
                    </span>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 -rotate-90 text-slate/50" />
                </button>
              ))}
            </div>
          </Panel>

          <div className="space-y-4">
            <Panel>
              <PanelHeader title="Waiting for you" meta={`${pending.length} actions`} />
              {pending.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <Check className="mx-auto h-5 w-5 text-verified" />
                  <p className="mt-2 text-[11px] text-slate">No approvals waiting. The crew is idle.</p>
                </div>
              ) : (
                <div className="divide-y divide-rule">
                  {pending.map((approval) => {
                    const Icon = approvalIcon(approval.kind);
                    return (
                      <button
                        key={approval.id}
                        type="button"
                        onClick={() => setPreview(approval)}
                        className="flex w-full items-start gap-2.5 px-4 py-2.5 text-left transition hover:bg-white"
                      >
                        <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[11px] font-medium leading-snug text-ink">
                            {approval.title}
                          </span>
                          <span className="mt-0.5 block text-[9.5px] text-slate">
                            {approval.agent} · {formatRelative(approval.createdAt)}
                          </span>
                        </span>
                        <ArrowUpRight className="h-3 w-3 shrink-0 text-slate/60" />
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="border-t border-rule px-4 py-2">
                <button
                  type="button"
                  onClick={() => setTab("approvals")}
                  className="flex w-full items-center justify-between text-[10px] text-slate hover:text-ink"
                >
                  Open approvals
                  <ArrowUpRight className="h-3 w-3" />
                </button>
              </div>
            </Panel>

            <Panel>
              <PanelHeader title="Operating rules" />
              <ul className="divide-y divide-rule">
                {[
                  "No agent can reject, close or withdraw a candidate.",
                  "Every email send, calendar write and sheet append needs a human.",
                  "A blocked connection stops the run. It never retries silently.",
                  "Score changes are written with a reason and a name.",
                ].map((rule) => (
                  <li key={rule} className="flex gap-2 px-4 py-2.5 text-[10.5px] leading-relaxed text-slate">
                    <Lock className="mt-0.5 h-3 w-3 shrink-0 text-slate/70" />
                    {rule}
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </div>
      ) : null}

      {tab === "approvals" ? (
        <div className="mt-4 space-y-3">
          {approvals.map((approval) => {
            const Icon = approvalIcon(approval.kind);
            return (
              <Panel key={approval.id} className={cn("overflow-hidden", approval.status !== "pending" && "opacity-70")}>
                <div className="flex flex-wrap items-start gap-3 px-4 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[7px] border border-rule bg-chalk/60">
                    <Icon className="h-4 w-4 text-slate" strokeWidth={1.7} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[12.5px] font-medium text-ink">{approval.title}</p>
                      <Badge
                        tone={approval.status === "approved" ? "verified" : approval.status === "rejected" ? "onair" : "flag"}
                        dot
                      >
                        {approval.status === "pending" ? "Needs approval" : approval.status}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-[10.5px] text-slate">
                      {approval.agent} · {approval.candidateAlias} · {formatRelative(approval.createdAt)}
                    </p>

                    <div className="mt-2.5 rounded-[6px] border border-rule bg-white p-3">
                      {approval.proposal.subject ? (
                        <p className="text-[10px] text-slate">
                          Subject: <span className="text-ink">{approval.proposal.subject}</span>
                        </p>
                      ) : null}
                      {approval.proposal.when ? (
                        <p className="text-[10px] text-slate">
                          When: <span className="text-ink">{approval.proposal.when}</span>
                        </p>
                      ) : null}
                      {approval.proposal.body ? (
                        <pre className="mt-1 whitespace-pre-wrap font-sans text-[10.5px] leading-relaxed text-ink">
                          {approval.proposal.body}
                        </pre>
                      ) : null}
                      {approval.proposal.attendees ? (
                        <p className="mt-1.5 font-mono text-[9px] text-slate">
                          {approval.proposal.attendees.join(" · ")}
                        </p>
                      ) : null}
                      {approval.kind === "calendar" ? (
                        <p className="mt-1.5 flex items-center gap-1 text-[9px] text-slate">
                          <Plug className="h-3 w-3" /> Google Meet link will be added on approval
                        </p>
                      ) : null}
                    </div>
                  </div>
                  {approval.status === "pending" ? (
                    <div className="flex items-center gap-1.5">
                      <Button variant="ghost" size="sm" onClick={() => decide(approval, "rejected")}>
                        <X className="h-3.5 w-3.5" />
                        Reject
                      </Button>
                      <Button variant="ink" size="sm" onClick={() => decide(approval, "approved")}>
                        <Check className="h-3.5 w-3.5" />
                        Approve
                      </Button>
                    </div>
                  ) : null}
                </div>
              </Panel>
            );
          })}
        </div>
      ) : null}

      {tab === "runs" ? (
        <Panel className="mt-4 overflow-hidden">
          <PanelHeader
            title="Run log"
            meta="Last 7 runs · one row per agent step"
            action={<span className="font-mono text-[9px] text-slate">retention 30 days</span>}
          />
          <ol className="divide-y divide-rule">
            {workspace.runs.map((run) => {
              const open = expandedRun === run.id;
              return (
                <li key={run.id}>
                  <button
                    type="button"
                    onClick={() => setExpandedRun(open ? null : run.id)}
                    className="flex w-full flex-wrap items-center gap-2.5 px-4 py-2.5 text-left transition hover:bg-white"
                  >
                    <span className="w-[64px] shrink-0 font-mono text-[9.5px] text-slate">{run.id}</span>
                    <span className="flex items-center gap-1.5">
                      <StatusDot
                        status={
                          run.status === "running"
                            ? "working"
                            : run.status === "awaiting_approval"
                              ? "waiting"
                              : run.status === "failed"
                                ? "blocked"
                                : "idle"
                        }
                      />
                      <span className="text-[11.5px] font-medium text-ink">{run.agentName}</span>
                    </span>
                    <span className="hidden text-[10px] text-slate sm:block">{run.trigger}</span>
                    {run.candidateAlias ? (
                      <span className="font-mono text-[9px] text-slate/80">{run.candidateAlias}</span>
                    ) : null}
                    <span className="ml-auto flex items-center gap-3 text-[9.5px] text-slate">
                      <span>{formatTime(run.durationMs)}</span>
                      <span className="font-mono">{(run.tokensIn + run.tokensOut).toLocaleString()} tok</span>
                      <Badge
                        tone={
                          run.status === "succeeded"
                            ? "verified"
                            : run.status === "awaiting_approval"
                              ? "flag"
                              : run.status === "failed"
                                ? "onair"
                                : "ultra"
                        }
                      >
                        {statusLabel(run.status)}
                      </Badge>
                      <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
                    </span>
                  </button>
                  {open ? (
                    <div className="animate-rise border-t border-rule bg-chalk/35 px-4 py-3">
                      <ol className="space-y-2">
                        {run.steps.map((step, index) => (
                          <li key={`${run.id}-${index}`} className="flex items-start gap-2.5">
                            <span
                              className={cn(
                                "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
                                step.status === "ok"
                                  ? "bg-verified"
                                  : step.status === "running"
                                    ? "animate-onair bg-ultramarine"
                                    : step.status === "awaiting"
                                      ? "bg-flag"
                                      : "bg-onair",
                              )}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="flex flex-wrap items-center gap-2">
                                <span className="font-mono text-[9.5px] text-ink">{step.tool}</span>
                                <span className="rounded-[2px] border border-rule bg-white px-1 font-mono text-[8px] text-slate">
                                  {step.level}
                                </span>
                                <span className="text-[9px] text-slate">{step.detail}</span>
                              </p>
                            </div>
                            <span className="font-mono text-[9px] text-slate">
                              {step.durationMs > 0 ? formatTime(step.durationMs) : "—"}
                            </span>
                          </li>
                        ))}
                      </ol>
                      <div className="mt-2.5 flex flex-wrap items-center gap-3 border-t border-rule/80 pt-2 text-[9px] text-slate">
                        <span className="flex items-center gap-1">
                          <Terminal className="h-3 w-3" /> Run trace kept for audit
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock3 className="h-3 w-3" /> {formatRelative(run.startedAt)}
                        </span>
                        {run.status === "awaiting_approval" ? (
                          <button
                            type="button"
                            onClick={() => setTab("approvals")}
                            className="ml-auto font-medium text-ultramarine hover:underline"
                          >
                            Open the approval
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </Panel>
      ) : null}

      {tab === "actions" ? <ActionsFeed actions={workspace.agentActions} /> : null}

      {tab === "permissions" ? (
        <div className="mt-4 space-y-4">
          <Panel className="overflow-x-auto">
            <PanelHeader title="Tool permissions" meta="What each agent may attempt" />
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="border-b border-rule bg-chalk/50 text-[9.5px] text-slate">
                  <th className="px-4 py-2 font-medium">Agent</th>
                  <th className="px-3 py-2 font-medium">Autonomy</th>
                  <th className="px-3 py-2 font-medium">Tools</th>
                  <th className="px-3 py-2 font-medium">Scopes</th>
                  <th className="px-4 py-2 font-medium">Ceiling</th>
                </tr>
              </thead>
              <tbody>
                {workspace.agents.map((agent) => (
                  <tr key={agent.id} className="border-b border-rule/70 last:border-b-0">
                    <td className="px-4 py-2.5">
                      <p className="text-[11.5px] font-medium text-ink">{agent.name}</p>
                      <p className="text-[9px] text-slate">{agent.role}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={agent.autonomy === "ask" ? "flag" : agent.autonomy === "auto" ? "neutral" : "ultra"}>
                        {agent.autonomy === "ask" ? "asks first" : agent.autonomy}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {agent.tools.map((tool) => (
                          <span key={tool} className="rounded-[2px] border border-rule bg-white px-1 py-0.5 font-mono text-[8px] text-slate">
                            {tool}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[8.5px] text-slate">
                      {agent.scopes.length > 0 ? agent.scopes.join(", ") : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-[9.5px] text-slate">
                      {agent.tools.some((tool) => tool.includes("send") || tool.includes("createEvent") || tool.includes("append"))
                        ? "Human approval required"
                        : "Read or prepare only"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <div className="grid gap-4 md:grid-cols-2">
            <Panel className="p-4">
              <div className="flex items-center gap-2">
                <CircleSlash2 className="h-4 w-4 text-onair" />
                <h2 className="text-[12px] font-semibold text-ink">Blocked on purpose</h2>
              </div>
              <ul className="mt-2 space-y-2 text-[10.5px] leading-relaxed text-slate">
                <li>No agent can add its own tool or scope.</li>
                <li>No agent can change a rubric weight without publishing a playbook.</li>
                <li>No agent can contact a candidate outside an approved template.</li>
              </ul>
            </Panel>
            <Panel className="p-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-ultramarine" />
                <h2 className="text-[12px] font-semibold text-ink">Audit trail</h2>
              </div>
              <p className="mt-2 text-[10.5px] leading-relaxed text-slate">
                Every run keeps its trigger, steps, approvals, token counts and the person who answered
                the gate. Exports are available for 30 days in the pilot.
              </p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => toast("Audit export is available in the live workspace.")}>
                Export audit log
              </Button>
            </Panel>
          </div>
        </div>
      ) : null}

      {selectedAgent ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 p-0 backdrop-blur-[2px] sm:items-center sm:p-6">
          <button type="button" className="absolute inset-0" aria-label="Close agent details" onClick={() => setSelectedAgent(null)} />
          <div className="relative w-full max-w-[480px] animate-rise overflow-hidden rounded-t-[20px] border border-rule bg-paper shadow-2xl sm:rounded-[20px]">
            <div className="flex items-start justify-between border-b border-rule px-5 py-4">
              <div className="flex items-center gap-3">
                <Avatar initials={selectedAgent.name.slice(0, 2)} size="sm" tone="ink" />
                <div>
                  <p className="text-[13px] font-semibold text-ink">{selectedAgent.name}</p>
                  <p className="text-[10.5px] text-slate">{selectedAgent.role}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedAgent(null)} aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="max-h-[70dvh] overflow-y-auto p-5 scroll-thin">
              <dl className="grid grid-cols-2 gap-2">
                {[
                  ["Model", selectedAgent.model],
                  ["Autonomy", selectedAgent.autonomy === "ask" ? "Asks first" : selectedAgent.autonomy],
                  ["Runs today", String(selectedAgent.runsToday)],
                  ["Success", `${Math.round(selectedAgent.successRate * 100)}%`],
                  ["Tier", selectedAgent.tier],
                  ["Last run", formatRelative(selectedAgent.lastRun)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-[5px] border border-rule bg-white px-2.5 py-2">
                    <dt className="text-[9px] text-slate">{label}</dt>
                    <dd className="mt-0.5 text-[11px] text-ink">{value}</dd>
                  </div>
                ))}
              </dl>

              <p className="mt-4 text-[10px] font-medium text-slate">Tools it can request</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {selectedAgent.tools.map((tool) => (
                  <span key={tool} className="rounded-[3px] border border-rule bg-white px-1.5 py-0.5 font-mono text-[9px] text-ink">
                    {tool}
                  </span>
                ))}
              </div>

              <p className="mt-4 text-[10px] font-medium text-slate">Scopes</p>
              <p className="mt-1 text-[10.5px] text-slate">
                {selectedAgent.scopes.length > 0 ? selectedAgent.scopes.join(" · ") : "No external scopes."}
              </p>

              <div className="mt-4 rounded-[6px] border border-flag/30 bg-flag-soft/60 p-3">
                <p className="text-[10px] font-medium text-[#6c5200]">Human gate</p>
                <p className="mt-1 text-[10px] leading-relaxed text-[#6c5200]/85">
                  {selectedAgent.autonomy === "auto"
                    ? "This agent can propose and prepare, but cannot send, schedule or change a candidate stage without a human."
                    : "Every external write from this agent waits in Approvals with the exact payload shown."}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-rule bg-chalk/40 px-5 py-3">
              <span className="flex items-center gap-1.5 text-[9.5px] text-slate">
                <Inbox className="h-3 w-3" />
                {selectedAgent.status === "waiting" ? "Has work waiting" : "No work waiting"}
              </span>
              <Button variant="ink" size="sm" asChild>
                <Link href="/app/crew?tab=runs">Open run log</Link>
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {preview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4 backdrop-blur-[2px]">
          <button type="button" className="absolute inset-0" aria-label="Close preview" onClick={() => setPreview(null)} />
          <div className="relative w-full max-w-[520px] animate-rise overflow-hidden rounded-[20px] border border-rule bg-paper shadow-2xl">
            <div className="flex items-start justify-between border-b border-rule px-5 py-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.08em] text-slate">Approval preview</p>
                <h2 className="mt-1 font-display text-[21px] font-medium tracking-[-0.03em] text-ink">
                  {preview.title}
                </h2>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setPreview(null)} aria-label="Close preview">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="max-h-[62dvh] overflow-y-auto p-5 scroll-thin">
              <div className="rounded-[6px] border border-rule bg-white p-3">
                {preview.proposal.subject ? (
                  <p className="text-[10.5px] text-slate">
                    Subject <span className="ml-1 text-ink">{preview.proposal.subject}</span>
                  </p>
                ) : null}
                {preview.proposal.when ? (
                  <p className="mt-1 text-[10.5px] text-slate">
                    When <span className="ml-1 text-ink">{preview.proposal.when}</span>
                  </p>
                ) : null}
                {preview.proposal.body ? (
                  <pre className="mt-2 whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-ink">
                    {preview.proposal.body}
                  </pre>
                ) : null}
                {preview.kind === "calendar" ? (
                  <div className="mt-3 space-y-1 border-t border-rule pt-2 text-[10px] text-slate">
                    <p>Attendees: {preview.proposal.attendees?.join(", ") ?? "—"}</p>
                    <p>Google Meet: added on approval</p>
                    <p>Calendar: meera@northstar.example</p>
                  </div>
                ) : null}
              </div>
              <div className="mt-3 flex items-start gap-2 rounded-[6px] border border-verified/25 bg-verified-soft/60 px-3 py-2">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-verified" />
                <p className="text-[10px] leading-relaxed text-[#0a7f51]">
                  This runs once. The payload above is what will be sent. Approval is recorded with your
                  name and the time.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-rule bg-chalk/40 px-5 py-3">
              <Button variant="ghost" size="md" onClick={() => setPreview(null)}>
                Cancel
              </Button>
              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="md" onClick={() => decide(preview, "rejected")}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  Send back
                </Button>
                <Button variant="ink" size="md" onClick={() => decide(preview, "approved")}>
                  <Check className="h-3.5 w-3.5" />
                  Approve once
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
