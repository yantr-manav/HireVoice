"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowUpRight,
  Columns3,
  FileText,
  Filter,
  Link2,
  List,
  Mail,
  MoreHorizontal,
  Pause,
  Plus,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { Candidate, Playbook, Role, Stage } from "@/lib/types";
import { cn, formatRelative, languageLabel, scoreTone, stageLabel } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyLink } from "@/components/desk/copy-link";
import { Avatar } from "@/components/ui/avatar";

const stages: Stage[] = ["invited", "interviewed", "in_review", "shortlisted", "scheduled", "closed"];
const tabs = ["Pipeline", "Candidates", "Playbook", "Invite", "Settings"] as const;
type Tab = (typeof tabs)[number];

const stageTone: Record<Stage, string> = {
  invited: "bg-slate/40",
  interviewed: "bg-ink/40",
  in_review: "bg-flag",
  shortlisted: "bg-ultramarine",
  scheduled: "bg-verified",
  closed: "bg-slate/25",
};

export function RoleWorkspace({
  role,
  candidates,
  playbook,
}: {
  role: Role;
  candidates: Candidate[];
  playbook: Playbook;
}) {
  const [tab, setTab] = useState<Tab>("Pipeline");
  const [items, setItems] = useState(candidates);
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [anonymised, setAnonymised] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState("http://localhost:3000");
  const [lanUrl, setLanUrl] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState(`hv-${role.id}-live`);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("hv_public_base_url");
      setBaseUrl(saved || window.location.origin);
    }
    fetch("/api/network-info")
      .then((r) => (r.ok ? r.json() : null))
      .then((info: { lanUrl?: string | null } | null) => {
        if (info?.lanUrl) setLanUrl(info.lanUrl);
      })
      .catch(() => {});
  }, []);

  const normalizedBase = baseUrl.trim().replace(/\/$/, "") || "http://localhost:3000";
  const inviteLink = `${normalizedBase}/i/${inviteToken}`;

  const updateBaseUrl = (next: string) => {
    setBaseUrl(next);
    if (typeof window !== "undefined") {
      if (next.trim()) window.localStorage.setItem("hv_public_base_url", next.trim().replace(/\/$/, ""));
      else window.localStorage.removeItem("hv_public_base_url");
    }
  };
  const counts = useMemo(() => {
    return stages.reduce<Record<Stage, number>>((acc, stage) => {
      acc[stage] = stage === "invited" ? Math.max(role.invited - items.length, 0) : items.filter((item) => item.stage === stage).length;
      return acc;
    }, {} as Record<Stage, number>);
  }, [items, role.invited]);

  const move = (candidateId: string, stage: Stage) => {
    setItems((current) =>
      current.map((candidate) => (candidate.id === candidateId ? { ...candidate, stage } : candidate)),
    );
    const candidate = items.find((item) => item.id === candidateId);
    if (candidate && candidate.stage !== stage) {
      toast(`Moved ${anonymised ? candidate.alias : candidate.name} to ${stageLabel(stage)}.`, {
        description: "Stage changes write an audit event in the live workspace.",
      });
    }
  };

  return (
    <div>
      <div className="border-b border-rule bg-chalk">
        <div className="mx-auto max-w-[1600px] px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <Button variant="ghost" size="icon" asChild className="-ml-1">
                <Link href="/app/roles" aria-label="Back to roles">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-[27px] font-medium leading-none tracking-[-0.04em] text-ink">
                    {role.title}
                  </h1>
                  <Badge tone={role.status === "open" ? "verified" : role.status === "paused" ? "flag" : "neutral"} dot>
                    {role.status[0].toUpperCase() + role.status.slice(1)}
                  </Badge>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-slate">
                  <span>{role.location}</span>
                  <span className="h-2.5 w-px bg-rule" />
                  <span>{role.languages.map(languageLabel).join(" · ")}</span>
                  <span className="h-2.5 w-px bg-rule" />
                  <span>Hiring manager {role.hiringManager}</span>
                  <span className="h-2.5 w-px bg-rule" />
                  <span className="font-mono text-[9.5px]">playbook v{role.playbookVersion}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/app/playbooks/${playbook.id}`}>
                  <FileText className="h-3.5 w-3.5" />
                  Playbook
                </Link>
              </Button>
              <Button variant="primary" size="sm" onClick={() => setTab("Invite")}>
                <Plus className="h-3.5 w-3.5" />
                Invite candidates
              </Button>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-1 overflow-x-auto scroll-thin" role="tablist" aria-label="Role sections">
            {tabs.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setTab(item)}
                role="tab"
                aria-selected={tab === item}
                className={cn(
                  "relative h-8 whitespace-nowrap rounded-[4px] px-2.5 text-[11.5px] font-medium transition",
                  tab === item ? "bg-white text-ink shadow-[0_1px_0_rgba(16,26,44,0.05)]" : "text-slate hover:bg-ink/[0.04] hover:text-ink",
                )}
              >
                {item}
                {item === "Candidates" ? <span className="ml-1.5 font-mono text-[9px] text-slate">{items.length}</span> : null}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
        {tab === "Pipeline" ? (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="flex rounded-[5px] border border-rule bg-paper p-0.5">
                  <button
                    type="button"
                    onClick={() => setView("kanban")}
                    className={cn("flex h-6 items-center gap-1 rounded-[3px] px-2 text-[10px] font-medium", view === "kanban" ? "bg-ink text-chalk" : "text-slate")}
                  >
                    <Columns3 className="h-3 w-3" /> Board
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("table")}
                    className={cn("flex h-6 items-center gap-1 rounded-[3px] px-2 text-[10px] font-medium", view === "table" ? "bg-ink text-chalk" : "text-slate")}
                  >
                    <List className="h-3 w-3" /> Table
                  </button>
                </div>
                <button type="button" className="flex h-7 items-center gap-1 rounded-[5px] border border-rule bg-paper px-2 text-[10px] text-slate hover:border-slate/50">
                  <Filter className="h-3 w-3" /> Filters
                </button>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-[10.5px] text-slate">
                <span className="relative inline-flex h-4 w-7 items-center">
                  <input
                    type="checkbox"
                    checked={anonymised}
                    onChange={(event) => setAnonymised(event.target.checked)}
                    className="peer sr-only"
                  />
                  <span className="h-4 w-7 rounded-full border border-rule bg-white transition peer-checked:border-ultramarine peer-checked:bg-ultramarine" />
                  <span className="absolute left-0.5 h-3 w-3 rounded-full bg-slate transition peer-checked:translate-x-3 peer-checked:bg-white" />
                </span>
                Anonymised view
              </label>
            </div>

            {view === "kanban" ? (
              <div className="mt-4 flex gap-2.5 overflow-x-auto pb-4 scroll-thin">
                {stages.map((stage) => {
                  const laneItems = items.filter((item) => item.stage === stage);
                  const isInvited = stage === "invited";
                  return (
                    <div
                      key={stage}
                      className="flex w-[220px] shrink-0 flex-col rounded-[8px] border border-rule bg-chalk/55"
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => {
                        if (dragging) move(dragging, stage);
                        setDragging(null);
                      }}
                    >
                      <div className="flex items-center justify-between border-b border-rule px-2.5 py-2">
                        <div className="flex items-center gap-1.5">
                          <span className={cn("h-1.5 w-1.5 rounded-full", stageTone[stage])} />
                          <span className="text-[10.5px] font-medium text-ink">{stageLabel(stage)}</span>
                        </div>
                        <span className="font-mono text-[9px] text-slate">{counts[stage]}</span>
                      </div>
                      <div className="flex min-h-[120px] flex-col gap-1.5 p-1.5">
                        {isInvited ? (
                          <div className="rounded-[6px] border border-dashed border-rule bg-paper/60 px-2.5 py-3">
                            <p className="text-[10px] font-medium text-ink">{counts.invited} invitations sent</p>
                            <p className="mt-1 text-[9.5px] leading-relaxed text-slate">
                              Candidates who have not started yet are not shown by name. Open the Invite tab to copy the link.
                            </p>
                          </div>
                        ) : null}
                        {laneItems.map((candidate) => (
                          <div
                            key={candidate.id}
                            draggable
                            onDragStart={() => setDragging(candidate.id)}
                            onDragEnd={() => setDragging(null)}
                            className={cn(
                              "group cursor-grab rounded-[6px] border border-rule bg-paper p-2 transition hover:border-slate/40 active:cursor-grabbing",
                              dragging === candidate.id && "opacity-40",
                            )}
                          >
                            <div className="flex items-start justify-between gap-1">
                              <Link
                                href={`/app/roles/${role.id}/candidates/${candidate.id}`}
                                className="min-w-0 flex-1"
                              >
                                <span className="flex items-center gap-1.5">
                                  <Avatar
                                    initials={anonymised ? candidate.alias.slice(-2) : candidate.name.split(" ").map((part) => part[0]).join("")}
                                    size="xs"
                                    tone={candidate.stage === "shortlisted" ? "ultra" : "ink"}
                                  />
                                  <span className="truncate text-[10.5px] font-medium text-ink">
                                    {anonymised ? candidate.alias : candidate.name}
                                  </span>
                                </span>
                              </Link>
                              <MoreHorizontal className="h-3 w-3 shrink-0 text-slate/50 opacity-0 group-hover:opacity-100" />
                            </div>
                            <div className="mt-1.5 flex items-center gap-1.5">
                              <div className="h-1 flex-1 rounded-full bg-rule/70">
                                <div className="h-full rounded-full bg-ultramarine" style={{ width: `${(candidate.score.overall / 5) * 100}%` }} />
                              </div>
                              <span className={cn("font-mono text-[9px] tabular", scoreTone(candidate.score.overall))}>
                                {candidate.score.overall.toFixed(1)}
                              </span>
                            </div>
                            <div className="mt-1.5 flex items-center justify-between text-[8.5px] text-slate">
                              <span>{languageLabel(candidate.language)}</span>
                              <span className="flex items-center gap-0.5">
                                <ShieldCheck className={cn("h-2.5 w-2.5", candidate.score.evidenceQuality >= 0.7 ? "text-verified" : "text-flag")} />
                                {Math.round(candidate.score.evidenceQuality * 100)}%
                              </span>
                            </div>
                          </div>
                        ))}
                        {laneItems.length === 0 && !isInvited ? (
                          <p className="px-2 py-3 text-center text-[9px] text-slate/60">No candidates</p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-[10px] border border-rule bg-paper scroll-thin">
                <table className="w-full min-w-[700px] text-left">
                  <thead>
                    <tr className="border-b border-rule bg-chalk/50 text-[9.5px] text-slate">
                      <th className="px-4 py-2 font-medium">Candidate</th>
                      <th className="px-3 py-2 font-medium">Stage</th>
                      <th className="px-3 py-2 font-medium">Language</th>
                      <th className="px-3 py-2 font-medium">Overall</th>
                      <th className="px-3 py-2 font-medium">Evidence</th>
                      <th className="px-3 py-2 font-medium">Interview</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((candidate) => (
                      <tr key={candidate.id} className="border-b border-rule/70 last:border-b-0 hover:bg-white">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <Avatar
                              initials={anonymised ? candidate.alias.slice(-2) : candidate.name.split(" ").map((part) => part[0]).join("")}
                              size="xs"
                            />
                            <div>
                              <p className="text-[11.5px] font-medium text-ink">{anonymised ? candidate.alias : candidate.name}</p>
                              <p className="font-mono text-[8.5px] text-slate">{candidate.alias}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5"><Badge tone={candidate.stage === "shortlisted" ? "verified" : candidate.stage === "in_review" ? "flag" : "neutral"}>{stageLabel(candidate.stage)}</Badge></td>
                        <td className="px-3 py-2.5 text-[10px] text-slate">{languageLabel(candidate.language)}</td>
                        <td className={cn("px-3 py-2.5 font-mono text-[11px] tabular", scoreTone(candidate.score.overall))}>{candidate.score.overall.toFixed(1)}</td>
                        <td className="px-3 py-2.5 font-mono text-[10px] text-slate">{Math.round(candidate.score.evidenceQuality * 100)}%</td>
                        <td className="px-3 py-2.5 text-[10px] text-slate">{formatRelative(candidate.interviewAt)}</td>
                        <td className="px-4 py-2.5 text-right">
                          <Link href={`/app/roles/${role.id}/candidates/${candidate.id}`} className="inline-flex items-center gap-1 text-[10px] font-medium text-ultramarine">
                            Evidence <ArrowUpRight className="h-3 w-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}

        {tab === "Candidates" ? (
          <div className="rounded-[10px] border border-rule bg-paper p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-[13px] font-semibold text-ink">All candidates</h2>
                <p className="mt-1 text-[11px] text-slate">
                  Names are visible because anonymised view is off. Reveal contact details on each candidate is logged.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setTab("Pipeline");
                  setView("table");
                }}
              >
                <Users className="h-3.5 w-3.5" />
                Open table view
              </Button>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((candidate) => (
                <Link
                  key={candidate.id}
                  href={`/app/roles/${role.id}/candidates/${candidate.id}`}
                  className="flex items-center gap-2.5 rounded-[7px] border border-rule bg-white p-3 transition hover:border-slate/40"
                >
                  <Avatar initials={candidate.name.split(" ").map((part) => part[0]).join("")} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11.5px] font-medium text-ink">{candidate.name}</p>
                    <p className="truncate text-[9.5px] text-slate">{candidate.alias} · {stageLabel(candidate.stage)}</p>
                  </div>
                  <span className={cn("font-mono text-[11px] tabular", scoreTone(candidate.score.overall))}>{candidate.score.overall.toFixed(1)}</span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        {tab === "Playbook" ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="overflow-hidden rounded-[10px] border border-rule bg-paper">
              <div className="flex items-center justify-between border-b border-rule px-4 py-2.5">
                <div>
                  <p className="text-[12px] font-semibold text-ink">{playbook.name}</p>
                  <p className="mt-0.5 font-mono text-[9.5px] text-slate">playbook v{role.playbookVersion} · pinned to this role</p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/app/playbooks/${playbook.id}`}>Open Studio</Link>
                </Button>
              </div>
              <pre className="max-h-[520px] overflow-auto p-4 font-mono text-[10.5px] leading-[1.7] text-ink scroll-thin">
                {playbook.markdown}
              </pre>
            </div>
            <div className="space-y-3">
              <div className="rounded-[8px] border border-rule bg-paper p-4">
                <p className="text-[11px] font-medium text-ink">Compiled summary</p>
                <dl className="mt-3 space-y-2 text-[10.5px]">
                  <div className="flex justify-between gap-3"><dt className="text-slate">Questions</dt><dd className="text-ink">4</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate">Skills</dt><dd className="text-ink">4 · weights 30/30/20/20</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate">Shortlist rule</dt><dd className="text-right text-ink">score ≥ 4.0, quality ≥ 75%</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate">Review rule</dt><dd className="text-right text-ink">score ≥ 3.0 or quality &lt; 75%</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate">Auto-reject</dt><dd className="text-verified">never</dd></div>
                </dl>
              </div>
              {playbook.warnings.length > 0 ? (
                <div className="rounded-[8px] border border-flag/30 bg-flag-soft/70 p-3">
                  <p className="text-[10.5px] font-medium text-[#6c5200]">1 warning</p>
                  {playbook.warnings.map((warning) => (
                    <p key={warning.line} className="mt-1 text-[10px] leading-relaxed text-[#6c5200]/85">
                      Line {warning.line}: {warning.message}
                    </p>
                  ))}
                </div>
              ) : null}
              <p className="text-[9.5px] leading-relaxed text-slate">
                A role keeps its pinned version until you intentionally publish a new one. Rollback is available in
                Playbook Studio.
              </p>
            </div>
          </div>
        ) : null}

        {tab === "Invite" ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded-[10px] border border-rule bg-paper p-5">
              <p className="text-[10.5px] font-medium text-slate">Single-use invite link</p>
              <h2 className="mt-1 font-display text-[24px] font-medium tracking-[-0.03em] text-ink">
                Send one link. No account needed.
              </h2>
              <p className="mt-1.5 max-w-[500px] text-[11.5px] leading-relaxed text-slate">
                The candidate opens the link on a phone, reads the consent notice, passes a microphone check and
                completes a four-minute customer support screen.
              </p>
              <div className="mt-4 flex items-center gap-2 rounded-[7px] border border-rule bg-white p-2">
                <Link2 className="ml-1 h-3.5 w-3.5 text-slate" />
                <span className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-ink">{inviteLink}</span>
                <CopyLink value={inviteLink} />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setInviteToken(`hv-${role.id}-${Math.random().toString(36).slice(2, 6)}`)}
                >
                  New link
                </Button>
                <Button variant="ink" size="sm" asChild>
                  <Link href={`/i/${inviteToken}`} target="_blank">
                    Open
                  </Link>
                </Button>
              </div>

              <div className="mt-3 rounded-[8px] border border-rule bg-chalk/55 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[10px] font-medium text-ink">
                    Shareable base URL <span className="font-normal text-slate">(for phones before deployment)</span>
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => updateBaseUrl(typeof window !== "undefined" ? window.location.origin : "http://localhost:3000")}
                      className="rounded border border-rule bg-white px-2 py-0.5 font-mono text-[9.5px] text-slate hover:border-ink hover:text-ink"
                    >
                      localhost
                    </button>
                    {lanUrl ? (
                      <button
                        type="button"
                        onClick={() => updateBaseUrl(lanUrl)}
                        className="rounded border border-rule bg-white px-2 py-0.5 font-mono text-[9.5px] text-slate hover:border-ink hover:text-ink"
                      >
                        Wi-Fi LAN ({lanUrl.replace("http://", "")})
                      </button>
                    ) : null}
                  </div>
                </div>
                <input
                  type="url"
                  value={baseUrl}
                  onChange={(e) => updateBaseUrl(e.target.value)}
                  placeholder="https://xxxx.trycloudflare.com or http://localhost:3000"
                  className="mt-2 w-full rounded-[6px] border border-rule bg-white px-2.5 py-1.5 font-mono text-[10.5px] text-ink outline-none focus:border-ink"
                />
                <p className="mt-1.5 text-[9.5px] leading-relaxed text-slate">
                  For mobile microphone access from any phone before Cloud Run deploy, run{" "}
                  <code className="rounded bg-white px-1 py-0.5 font-mono text-[9px] text-ink">
                    npx cloudflared tunnel --url http://localhost:3000
                  </code>{" "}
                  and paste the HTTPS link above — the QR code updates instantly.
                </p>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge tone="verified" dot>expires in 7 days</Badge>
                <Badge tone="neutral">single use</Badge>
                <Badge tone="neutral">Hindi · English</Badge>
              </div>

              <div className="mt-5 grid gap-3 border-t border-rule pt-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[10px] font-medium text-slate">Bulk invite by email</span>
                  <textarea
                    rows={3}
                    placeholder="one@email.com, two@email.com"
                    className="mt-1 w-full resize-none rounded-[6px] border border-rule bg-white px-2.5 py-2 text-[11px] outline-none focus:border-ink"
                  />
                </label>
                <div className="rounded-[6px] border border-dashed border-rule bg-chalk/45 p-3">
                  <p className="text-[10px] font-medium text-ink">CSV import</p>
                  <p className="mt-1 text-[9.5px] leading-relaxed text-slate">
                    Columns: name, email, language. A candidate row is created only after the invite is accepted.
                  </p>
                  <Button variant="outline" size="sm" className="mt-2">Choose file</Button>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-end gap-2 border-t border-rule pt-3">
                <Button variant="ghost" size="sm">Copy template</Button>
                <Button variant="primary" size="sm" onClick={() => toast.success("Invite prepared in this demo.", { description: "In the live workspace, Comms would create a Gmail draft for approval." })}>
                  <Mail className="h-3.5 w-3.5" />
                  Draft invite email
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col items-center rounded-[10px] border border-rule bg-paper p-5">
                <div className="rounded-[8px] border border-rule bg-white p-3">
                  <QRCodeSVG value={inviteLink} size={144} bgColor="#FFFFFF" fgColor="#101A2C" level="M" />
                </div>
                <p className="mt-3 text-[10.5px] font-medium text-ink">Scan with a phone</p>
                <p className="mt-1 text-center text-[9.5px] leading-relaxed text-slate">
                  Works on Android Chrome and iPhone Safari. The mic check runs before the interview.
                </p>
              </div>
              <div className="rounded-[8px] border border-rule bg-paper p-4">
                <p className="text-[10.5px] font-medium text-ink">Candidate sees</p>
                <ol className="mt-2 space-y-2">
                  {["Welcome and language", "Consent and fairness", "Microphone check", "Four-minute interview", "What happens next"].map((step, index) => (
                    <li key={step} className="flex items-center gap-2 text-[10px] text-slate">
                      <span className="flex h-4 w-4 items-center justify-center rounded-full border border-rule bg-white font-mono text-[8px] text-slate">{index + 1}</span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        ) : null}

        {tab === "Settings" ? (
          <div className="max-w-[760px] space-y-4">
            <div className="rounded-[10px] border border-rule bg-paper p-5">
              <h2 className="text-[12px] font-semibold text-ink">Role settings</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[10px] font-medium text-slate">Role title</span>
                  <input defaultValue={role.title} className="mt-1 h-9 w-full rounded-[6px] border border-rule bg-white px-2.5 text-[11.5px] outline-none focus:border-ink" />
                </label>
                <label className="block">
                  <span className="text-[10px] font-medium text-slate">Location</span>
                  <input defaultValue={role.location} className="mt-1 h-9 w-full rounded-[6px] border border-rule bg-white px-2.5 text-[11.5px] outline-none focus:border-ink" />
                </label>
                <label className="block">
                  <span className="text-[10px] font-medium text-slate">Languages</span>
                  <input defaultValue={role.languages.map(languageLabel).join(", ")} className="mt-1 h-9 w-full rounded-[6px] border border-rule bg-white px-2.5 text-[11.5px] outline-none focus:border-ink" />
                </label>
                <label className="block">
                  <span className="text-[10px] font-medium text-slate">Hiring manager</span>
                  <input defaultValue={role.hiringManager} className="mt-1 h-9 w-full rounded-[6px] border border-rule bg-white px-2.5 text-[11.5px] outline-none focus:border-ink" />
                </label>
              </div>
              <div className="mt-4 flex justify-end">
                <Button variant="ink" size="sm" onClick={() => toast.success("Role settings saved in this demo.")}>Save role</Button>
              </div>
            </div>
            <div className="rounded-[10px] border border-rule bg-paper p-5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-verified" />
                <h2 className="text-[12px] font-semibold text-ink">Data and retention</h2>
              </div>
              <p className="mt-1 text-[10.5px] leading-relaxed text-slate">
                Audio is stored only with separate recording consent. Transcript text is redacted before scoring.
                This role inherits the organisation retention window.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone="neutral">Audio · 14 days</Badge>
                <Badge tone="neutral">Transcript · 90 days</Badge>
                <Badge tone="verified" dot>human review required</Badge>
              </div>
            </div>
            <div className="rounded-[10px] border border-onair/20 bg-onair-soft/35 p-5">
              <div className="flex items-center gap-2">
                <Pause className="h-4 w-4 text-onair" />
                <h2 className="text-[12px] font-semibold text-ink">Pause or close this role</h2>
              </div>
              <p className="mt-1 text-[10.5px] leading-relaxed text-slate">
                Pausing stops new invites. Closing stops the role and keeps existing interview evidence available
                to the review team.
              </p>
              <div className="mt-3 flex gap-2">
                <Button variant="outline" size="sm" onClick={() => toast("Role paused in this demo.")}>Pause role</Button>
                <Button variant="danger" size="sm" onClick={() => toast("Close requires a reason and is logged in the live workspace.")}>Close role</Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
