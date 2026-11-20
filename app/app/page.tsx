import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  AudioLines,
  CalendarPlus,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  FileSignature,
  Kanban,
  Mail,
  Plus,
  QrCode,
  Send,
  ShieldCheck,
  Sparkles,
  Table2,
  Timer,
  UploadCloud,
} from "lucide-react";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Avatar } from "@/components/ui/avatar";
import { Funnel } from "@/components/desk/funnel";
import { CopyLink } from "@/components/desk/copy-link";
import { getWorkspace } from "@/lib/data/workspace";
import { siteUrl } from "@/lib/config";
import { formatRelative, languageLabel, scoreTone, stageLabel } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Home" };

export default async function HomePage() {
  const workspace = await getWorkspace();
  const supportRole = workspace.roles[0];
  const pending = workspace.approvals.filter((approval) => approval.status === "pending");
  const rahul = workspace.candidates.find((candidate) => candidate.id === "cand-rahul") ?? workspace.candidates[1];
  const recent = workspace.candidates.slice(0, 6);
  const activeAgents = workspace.agents.filter((agent) => agent.tier === "P0");
  const dateLabel = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Kolkata",
  }).format(new Date());
  const istHour = Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }).format(new Date()),
  );
  const greeting = istHour < 12 ? "Good morning" : istHour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="mx-auto max-w-[1480px] px-4 py-5 sm:px-6 sm:py-7 xl:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium text-slate">{dateLabel}</p>
          <h1 className="mt-1 font-display text-[32px] font-medium leading-[1.05] tracking-[-0.04em] text-ink sm:text-[38px]">
            {greeting}, {workspace.user.name.split(" ")[0]}.
          </h1>
          <p className="mt-1.5 text-[13px] text-slate">
            {workspace.metrics.completed} interviews completed. {workspace.metrics.inReview} are waiting for a
            human decision.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="md" asChild>
            <Link href="/demo">Demo guide</Link>
          </Button>
          <Button variant="primary" size="md" asChild>
            <Link href="/app/onboarding">
              <Plus className="h-3.5 w-3.5" />
              Create a role
            </Link>
          </Button>
        </div>
      </div>

      <Panel className="mt-6 overflow-hidden">
        <div className="grid grid-cols-2 divide-x divide-y divide-rule sm:grid-cols-4 sm:divide-y-0">
          {[
            { label: "Interviews completed", value: workspace.metrics.completed, suffix: "" },
            { label: "Needs your review", value: workspace.metrics.inReview, suffix: "" },
            { label: "Shortlisted", value: workspace.metrics.shortlisted, suffix: "" },
            { label: "Hours saved this week", value: workspace.metrics.hoursSaved, suffix: " est." },
          ].map((metric) => (
            <div key={metric.label} className="px-4 py-3.5">
              <p className="text-[10.5px] text-slate">{metric.label}</p>
              <p className="mt-1 font-display text-[26px] font-medium leading-none tracking-[-0.04em] text-ink">
                {metric.value}
                <span className="ml-0.5 font-sans text-[11px] font-normal tracking-normal text-slate">{metric.suffix}</span>
              </p>
            </div>
          ))}
        </div>
      </Panel>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          {
            href: "/app/drive",
            title: "Walk-in Drive Mode",
            desc: "Projector QR code & live ranked lobby queue",
            icon: QrCode,
          },
          {
            href: "/app/upload-call",
            title: "Upload Screening Call",
            desc: "Diarize & score existing mobile calls with Gemini",
            icon: UploadCloud,
          },
          {
            href: "/app/review",
            title: "Evidence Review Queue",
            desc: "Inspect verified quotes & re-route across mandates",
            icon: ClipboardCheck,
          },
          {
            href: "/app/playbooks",
            title: "Playbook Studio",
            desc: "Edit rubrics, simulate thresholds & publish",
            icon: Sparkles,
          },
          {
            href: "/app/voice",
            title: "Vaani Voice Desk",
            desc: "Speak commands with approval-gated Calendar/Meet",
            icon: AudioLines,
          },
        ].map((tile) => (
          <Link
            key={tile.href}
            href={tile.href}
            className="group flex items-start gap-3 rounded-[10px] border border-rule bg-paper p-3.5 transition hover:border-ink/40 hover:bg-white"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[7px] border border-rule bg-chalk/60 text-ink transition group-hover:border-ultramarine/30 group-hover:bg-ultramarine-soft group-hover:text-ultramarine">
              <tile.icon className="h-4 w-4" strokeWidth={1.7} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 text-[12.5px] font-semibold text-ink">
                {tile.title}
                <ArrowUpRight className="ml-auto h-3.5 w-3.5 text-slate/60 transition group-hover:text-ink" />
              </p>
              <p className="mt-0.5 text-[10.5px] leading-snug text-slate">{tile.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-8">
          <Panel className="overflow-hidden">
            <PanelHeader
              title="Needs you"
              meta={`${pending.length + 2} decisions`}
              action={
                <Link href="/app/crew?tab=approvals" className="text-[11px] font-medium text-ultramarine hover:underline hover:underline-offset-2">
                  Open approvals
                </Link>
              }
            />
            <div className="divide-y divide-rule">
              <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-[6px] border border-ultramarine/15 bg-ultramarine-soft">
                  <CalendarPlus className="h-4 w-4 text-ultramarine" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-medium text-ink">Approve a Meet invite for Manoj Patil</p>
                  <p className="mt-0.5 text-[11px] text-slate">
                    Friday 20 Nov, 10:00 IST · Scheduler is waiting · external action
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/app/crew?tab=approvals">Review action</Link>
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-[6px] border border-flag/30 bg-flag-soft">
                  <AlertTriangle className="h-4 w-4 text-[#8e6a00]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-medium text-ink">
                    Review {rahul.name} — one quote failed verification
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate">
                    {rahul.roleTitle} · {languageLabel(rahul.language)} · evidence quality 54%
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/app/roles/${rahul.roleId}/candidates/${rahul.id}`}>Open evidence</Link>
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-[6px] border border-ink/10 bg-white">
                  <Mail className="h-4 w-4 text-slate" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-medium text-ink">Approve feedback for Karan Thakur</p>
                  <p className="mt-0.5 text-[11px] text-slate">
                    Comms drafted a kindness-first email. It has not been sent.
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/app/crew?tab=approvals">Read draft</Link>
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-[6px] border border-onair/20 bg-onair-soft">
                  <AlertTriangle className="h-4 w-4 text-onair" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-medium text-ink">Reconnect Sheets — tracker append stopped</p>
                  <p className="mt-0.5 text-[11px] text-slate">
                    The reporter tried once at 09:00 and did not retry. No candidate data was lost.
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/app/connections">Open connections</Link>
                </Button>
              </div>
            </div>
          </Panel>

          <div className="grid gap-4 md:grid-cols-2">
            <Panel>
              <PanelHeader
                title="Active role"
                meta={supportRole.location}
                action={<Badge tone="verified" dot>Open</Badge>}
              />
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-[21px] font-medium leading-tight tracking-[-0.03em] text-ink">
                      {supportRole.title}
                    </h3>
                    <p className="mt-1 text-[11.5px] text-slate">
                      {supportRole.languages.map(languageLabel).join(" · ")} · playbook v{supportRole.playbookVersion}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/app/roles/${supportRole.id}`}>Open role</Link>
                  </Button>
                </div>
                <div className="mt-4">
                  <Funnel role={supportRole} />
                </div>
                <div className="mt-4 flex items-center gap-2 rounded-[6px] border border-rule bg-chalk/60 px-2.5 py-2">
                  <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-slate">
                    {`${siteUrl}/i/hv-${supportRole.id}`}
                  </span>
                  <CopyLink value={`${siteUrl}/i/hv-${supportRole.id}`} label="Copy invite" />
                </div>
              </div>
            </Panel>

            <Panel>
              <PanelHeader title="Today" meta="In your timezone · IST" />
              <div className="p-4">
                <div className="flex items-baseline justify-between">
                  <div>
                    <p className="text-[11px] text-slate">Median result time</p>
                    <p className="mt-1 font-display text-[30px] font-medium leading-none tracking-[-0.04em] text-ink">
                      {workspace.metrics.medianResultSeconds}s
                    </p>
                  </div>
                  <Badge tone="verified">under 45s target</Badge>
                </div>
                <div className="mt-4 space-y-2.5">
                  <div className="flex items-center justify-between text-[11.5px]">
                    <span className="flex items-center gap-2 text-slate">
                      <CheckCircle2 className="h-3.5 w-3.5 text-verified" /> Quote verification
                    </span>
                    <span className="font-mono text-[10.5px] text-ink">
                      {workspace.metrics.verifiedQuotes}/{workspace.metrics.totalQuotes}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11.5px]">
                    <span className="flex items-center gap-2 text-slate">
                      <Timer className="h-3.5 w-3.5 text-slate" /> Completion rate
                    </span>
                    <span className="font-mono text-[10.5px] text-ink">
                      {Math.round(workspace.metrics.completionRate * 100)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11.5px]">
                    <span className="flex items-center gap-2 text-slate">
                      <ShieldCheck className="h-3.5 w-3.5 text-ultramarine" /> Human-owned outcomes
                    </span>
                    <span className="font-mono text-[10.5px] text-ink">100%</span>
                  </div>
                </div>
                <p className="mt-4 border-t border-rule pt-3 text-[10px] leading-relaxed text-slate">
                  Evidence quality is a heuristic based on transcript quality, rubric coverage and
                  verified quotes. It is not a prediction of job performance.
                </p>
              </div>
            </Panel>
          </div>

          <Panel className="overflow-hidden">
            <PanelHeader
              title="Recent interviews"
              meta="Latest 6"
              action={
                <Link href="/app/pipeline" className="text-[11px] font-medium text-ultramarine hover:underline hover:underline-offset-2">
                  View pipeline
                </Link>
              }
            />
            <div className="divide-y divide-rule">
              {recent.map((candidate) => (
                <Link
                  key={candidate.id}
                  href={`/app/roles/${candidate.roleId}/candidates/${candidate.id}`}
                  className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white"
                >
                  <Avatar
                    initials={candidate.name.split(" ").map((part) => part[0]).join("")}
                    size="sm"
                    tone={candidate.stage === "shortlisted" ? "ultra" : "ink"}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium text-ink">{candidate.name}</p>
                    <p className="truncate font-mono text-[9.5px] text-slate">{candidate.alias}</p>
                  </div>
                  <span className="hidden w-20 sm:block">
                    <span className="block h-1.5 w-full rounded-full bg-rule">
                      <span
                        className="block h-full rounded-full bg-ultramarine"
                        style={{ width: `${(candidate.score.overall / 5) * 100}%` }}
                      />
                    </span>
                  </span>
                  <span className={`w-8 text-right font-mono text-[11px] tabular ${scoreTone(candidate.score.overall)}`}>
                    {candidate.score.overall.toFixed(1)}
                  </span>
                  <Badge tone={candidate.stage === "shortlisted" ? "verified" : candidate.stage === "in_review" ? "flag" : "neutral"} className="hidden sm:inline-flex">
                    {stageLabel(candidate.stage)}
                  </Badge>
                  <span className="hidden w-16 text-right text-[10px] text-slate md:block">
                    {formatRelative(candidate.interviewAt)}
                  </span>
                  <ArrowUpRight className="h-3.5 w-3.5 text-slate/60" />
                </Link>
              ))}
            </div>
          </Panel>
        </div>

        <div className="space-y-4 xl:col-span-4">
          <Panel>
            <PanelHeader
              title="Crew"
              meta="3 waiting"
              action={
                <Link href="/app/crew" className="text-[11px] font-medium text-ultramarine hover:underline hover:underline-offset-2">
                  Open
                </Link>
              }
            />
            <div className="divide-y divide-rule">
              {activeAgents.map((agent) => (
                <div key={agent.id} className="flex items-center gap-2.5 px-4 py-2.5">
                  <StatusDot status={agent.status} />
                  <span className="min-w-0 flex-1 text-[12px] font-medium text-ink">{agent.name}</span>
                  <span className="truncate text-[10px] text-slate">
                    {agent.status === "working"
                      ? "scoring"
                      : agent.status === "waiting"
                        ? "needs approval"
                        : agent.status === "blocked"
                          ? "blocked"
                          : "idle"}
                  </span>
                  <span className="font-mono text-[9.5px] text-slate/70">{agent.model.replace("Gemini ", "")}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-rule bg-chalk/50 px-4 py-2">
              <span className="text-[10px] text-slate">Every write action needs a human.</span>
              <Link href="/app/crew?tab=permissions" className="text-[10px] font-medium text-ultramarine">
                Permissions
              </Link>
            </div>
          </Panel>

          <Panel className="overflow-hidden">
            <PanelHeader
              title="Live feed"
              meta="Agent steps"
              action={<span className="flex items-center gap-1.5 text-[10px] text-slate"><span className="h-1.5 w-1.5 animate-onair rounded-full bg-verified" /> live</span>}
            />
            <ol className="divide-y divide-rule">
              {workspace.feed.slice(0, 6).map((item) => (
                <li key={item.id} className="flex gap-3 px-4 py-2.5">
                  <span className="mt-0.5 font-mono text-[9px] tabular text-slate/70">
                    {new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(new Date(item.time))}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11.5px] leading-snug text-ink">{item.message}</p>
                    <p className="mt-0.5 text-[9.5px] text-slate">{item.agent}</p>
                  </div>
                  <span
                    className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                      item.tone === "verified"
                        ? "bg-verified"
                        : item.tone === "flag"
                          ? "bg-flag"
                          : item.tone === "onair"
                            ? "bg-onair"
                            : "bg-slate/35"
                    }`}
                  />
                </li>
              ))}
            </ol>
            <div className="border-t border-rule px-4 py-2.5">
              <Link href="/app/crew?tab=runs" className="flex items-center justify-between text-[10.5px] text-slate hover:text-ink">
                View all runs
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </Panel>

          <div className="rounded-[10px] border border-ink/10 bg-ink p-4 text-chalk">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.08em] text-mist/45">
              <Sparkles className="h-3 w-3 text-glow" />
              Judge path
            </div>
            <p className="mt-2 font-display text-[19px] font-medium leading-tight tracking-[-0.03em] text-mist">
              Start with one candidate and follow the evidence.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="booth" size="sm" asChild>
                <Link href="/app/roles/role-support/candidates/cand-sana">
                  <ClipboardCheck className="h-3.5 w-3.5" />
                  Open Sana
                </Link>
              </Button>
              <Button variant="ghost" size="sm" className="text-mist/70 hover:bg-white/10 hover:text-mist" asChild>
                <Link href="/i/demo">
                  <Send className="h-3.5 w-3.5" />
                  Try the booth
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
