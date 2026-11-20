"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarPlus,
  Check,
  FileSignature,
  Kanban,
  Loader2,
  Mail,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import type { Candidate, Stage, Workspace } from "@/lib/types";
import { cn, languageLabel, scoreTone } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

const STAGES: {
  id: Stage;
  label: string;
  accent: string;
  decisionAction?: "review" | "shortlist" | "scheduled" | "close";
}[] = [
  { id: "invited", label: "Invited", accent: "bg-slate/40" },
  { id: "interviewed", label: "Interviewed", accent: "bg-ink/40" },
  { id: "in_review", label: "In Review", accent: "bg-flag", decisionAction: "review" },
  { id: "shortlisted", label: "Shortlisted", accent: "bg-ultramarine", decisionAction: "shortlist" },
  { id: "scheduled", label: "Scheduled", accent: "bg-verified", decisionAction: "scheduled" },
  { id: "closed", label: "Closed", accent: "bg-onair/70", decisionAction: "close" },
];

export function PipelineBoard({ workspace }: { workspace: Workspace }) {
  const [candidates, setCandidates] = useState<Candidate[]>(workspace.candidates);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [langFilter, setLangFilter] = useState<string>("all");
  const [scoreFilter, setScoreFilter] = useState<"all" | "top" | "review">("all");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return candidates.filter((c) => {
      if (roleFilter !== "all" && c.roleId !== roleFilter) return false;
      if (langFilter !== "all" && c.language !== langFilter) return false;
      if (scoreFilter === "top" && c.score.overall < 4.0) return false;
      if (scoreFilter === "review" && c.reviewReasons.length === 0 && c.stage !== "in_review") return false;
      if (term) {
        const hay = `${c.name} ${c.alias} ${c.roleTitle} ${c.location} ${c.email}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [candidates, roleFilter, langFilter, scoreFilter, query]);

  const byStage = useMemo(() => {
    const map = new Map<Stage, Candidate[]>();
    for (const s of STAGES) map.set(s.id, []);
    for (const c of filtered) {
      map.get(c.stage)?.push(c);
    }
    for (const s of STAGES) {
      map.get(s.id)?.sort((a, b) => b.score.overall - a.score.overall);
    }
    return map;
  }, [filtered]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const avgScore = total ? filtered.reduce((acc, c) => acc + c.score.overall, 0) / total : 0;
    const avgEq = total ? Math.round(filtered.reduce((acc, c) => acc + c.score.evidenceQuality, 0) / total) : 0;
    const inReview = filtered.filter((c) => c.stage === "in_review").length;
    const shortlisted = filtered.filter((c) => c.stage === "shortlisted").length;
    const scheduled = filtered.filter((c) => c.stage === "scheduled").length;
    return { total, avgScore, avgEq, inReview, shortlisted, scheduled };
  }, [filtered]);

  const moveStage = async (candidate: Candidate, target: Stage, action: "review" | "shortlist" | "scheduled" | "close") => {
    setBusyId(candidate.id);
    const previous = candidate.stage;
    setCandidates((curr) => curr.map((c) => (c.id === candidate.id ? { ...c, stage: target } : c)));
    try {
      const res = await fetch("/api/candidates/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateId: candidate.id,
          roleId: candidate.roleId,
          action,
          note: `Moved on Pipeline Board from ${previous} to ${target}`,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Stage update failed.");
      }
      toast.success(`${candidate.name} → ${target.replace(/_/g, " ")}`, {
        description: "Saved to the hiring audit trail. No email was sent automatically.",
      });
    } catch (error) {
      setCandidates((curr) => curr.map((c) => (c.id === candidate.id ? { ...c, stage: previous } : c)));
      toast.error("Could not move candidate", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setBusyId(null);
    }
  };

  const toggleCompare = (id: string) => {
    setCompareIds((curr) => {
      if (curr.includes(id)) return curr.filter((x) => x !== id);
      if (curr.length >= 3) {
        toast("Compare up to 3 candidates at once");
        return curr;
      }
      return [...curr, id];
    });
  };

  const compared = useMemo(
    () => compareIds.map((id) => candidates.find((c) => c.id === id)).filter((c): c is Candidate => Boolean(c)),
    [compareIds, candidates],
  );

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 sm:py-7 xl:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate">
            <Kanban className="h-3.5 w-3.5" />
            Hiring Pipeline · Recruiter Board
          </p>
          <h1 className="mt-1 font-display text-[32px] font-medium leading-none tracking-[-0.04em] text-ink sm:text-[38px]">
            Candidate Pipeline
          </h1>
          <p className="mt-1.5 max-w-[660px] text-[13px] leading-relaxed text-slate">
            Track every candidate from invite through final interview, compare top contenders side by side, and advance
            stages with full recruiter control.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {compareIds.length >= 2 ? (
            <Button variant="primary" size="sm" onClick={() => setCompareOpen(true)}>
              <Scale className="h-3.5 w-3.5" />
              Compare {compareIds.length} candidates
            </Button>
          ) : (
            <span className="rounded-[6px] border border-rule bg-paper px-2.5 py-1.5 text-[10.5px] text-slate">
              Select 2–3 cards to compare side-by-side
            </span>
          )}
          <Button variant="outline" size="sm" asChild>
            <Link href="/app/forms">Application Forms</Link>
          </Button>
          <Button variant="ink" size="sm" asChild>
            <Link href="/app/offer">
              <FileSignature className="h-3.5 w-3.5" />
              Offer Studio
            </Link>
          </Button>
        </div>
      </div>

      <Panel className="mt-5 overflow-hidden">
        <div className="grid grid-cols-2 divide-x divide-y divide-rule sm:grid-cols-5 sm:divide-y-0">
          {[
            { label: "Visible candidates", value: String(stats.total) },
            { label: "Waiting human review", value: String(stats.inReview) },
            { label: "Shortlisted", value: String(stats.shortlisted) },
            { label: "Scheduled", value: String(stats.scheduled) },
            { label: "Avg score · evidence", value: `${stats.avgScore.toFixed(1)}/5 · ${stats.avgEq}%` },
          ].map((metric) => (
            <div key={metric.label} className="px-4 py-3">
              <p className="text-[10px] text-slate">{metric.label}</p>
              <p className="mt-1 font-display text-[22px] font-medium leading-none tracking-[-0.03em] text-ink">
                {metric.value}
              </p>
            </div>
          ))}
        </div>
      </Panel>

      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-[10px] border border-rule bg-paper px-3.5 py-2.5">
        <div className="flex h-8 min-w-[200px] flex-1 items-center gap-1.5 rounded-[6px] border border-rule bg-white px-2.5 sm:max-w-[280px]">
          <Search className="h-3.5 w-3.5 text-slate/60" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, alias, city…"
            className="h-full w-full bg-transparent text-[11.5px] text-ink outline-none placeholder:text-slate/55"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="h-8 rounded-[6px] border border-rule bg-white px-2.5 text-[11px] text-ink outline-none"
          aria-label="Filter by role"
        >
          <option value="all">All roles</option>
          {workspace.roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title}
            </option>
          ))}
        </select>

        <select
          value={langFilter}
          onChange={(e) => setLangFilter(e.target.value)}
          className="h-8 rounded-[6px] border border-rule bg-white px-2.5 text-[11px] text-ink outline-none"
          aria-label="Filter by language"
        >
          <option value="all">All languages</option>
          <option value="en">English</option>
          <option value="hi">Hindi</option>
          <option value="hinglish">Hinglish</option>
          <option value="mr">Marathi</option>
        </select>

        <div className="flex items-center gap-1 rounded-[6px] border border-rule bg-chalk/60 p-0.5">
          {(
            [
              { id: "all", label: "All" },
              { id: "top", label: "4.0+ Score" },
              { id: "review", label: "Needs Review" },
            ] as const
          ).map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setScoreFilter(chip.id)}
              className={cn(
                "rounded-[4px] px-2 py-1 text-[10.5px] font-medium transition",
                scoreFilter === chip.id ? "bg-ink text-chalk" : "text-slate hover:text-ink",
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <span className="ml-auto hidden items-center gap-1.5 text-[10px] text-slate xl:flex">
          <ShieldCheck className="h-3.5 w-3.5 text-verified" />
          Voice: “Move Sana to shortlisted” · “Show pipeline summary”
        </span>
      </div>

      <div className="mt-4 overflow-x-auto pb-4 scroll-thin">
        <div className="grid min-w-[1260px] grid-cols-6 gap-3">
          {STAGES.map((stage) => {
            const list = byStage.get(stage.id) ?? [];
            return (
              <section
                key={stage.id}
                className="flex flex-col rounded-[12px] border border-rule bg-paper/80"
              >
                <div className="flex items-center gap-2 border-b border-rule px-3 py-2.5">
                  <span className={cn("h-2 w-2 rounded-full", stage.accent)} />
                  <h2 className="text-[11.5px] font-semibold text-ink">{stage.label}</h2>
                  <span className="ml-auto rounded-[4px] border border-rule bg-white px-1.5 py-0.5 font-mono text-[9.5px] text-slate">
                    {list.length}
                  </span>
                </div>

                <div className="flex-1 space-y-2.5 p-2.5">
                  {list.length === 0 ? (
                    <div className="rounded-[8px] border border-dashed border-rule px-3 py-6 text-center text-[10.5px] text-slate/75">
                      No candidates in {stage.label.toLowerCase()}
                    </div>
                  ) : (
                    list.map((candidate) => {
                      const isCompared = compareIds.includes(candidate.id);
                      const isBusy = busyId === candidate.id;
                      const initials = candidate.name
                        .split(" ")
                        .map((part) => part[0])
                        .join("")
                        .slice(0, 2);

                      return (
                        <article
                          key={candidate.id}
                          className={cn(
                            "rounded-[9px] border bg-white p-3 transition",
                            isCompared ? "border-ultramarine ring-1 ring-ultramarine/30" : "border-rule hover:border-slate/45",
                          )}
                        >
                          <div className="flex items-start gap-2">
                            <Avatar
                              initials={initials}
                              size="xs"
                              tone={candidate.stage === "shortlisted" ? "ultra" : "ink"}
                            />
                            <div className="min-w-0 flex-1">
                              <Link
                                href={`/app/roles/${candidate.roleId}/candidates/${candidate.id}`}
                                className="block truncate text-[12px] font-semibold text-ink hover:text-ultramarine"
                              >
                                {candidate.name}
                              </Link>
                              <p className="truncate font-mono text-[9px] text-slate">
                                {candidate.alias} · {candidate.location}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleCompare(candidate.id)}
                              title={isCompared ? "Remove from comparison" : "Compare candidate"}
                              className={cn(
                                "flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] border text-[9px] transition",
                                isCompared
                                  ? "border-ultramarine bg-ultramarine text-white"
                                  : "border-rule bg-chalk/50 text-slate hover:border-ink",
                              )}
                            >
                              {isCompared ? <Check className="h-3 w-3" /> : <Scale className="h-2.5 w-2.5" />}
                            </button>
                          </div>

                          <p className="mt-1.5 truncate text-[10px] text-slate">{candidate.roleTitle}</p>

                          <div className="mt-2 flex items-center gap-2">
                            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-rule/80">
                              <span
                                className={cn(
                                  "block h-full rounded-full",
                                  candidate.score.overall >= 4
                                    ? "bg-verified"
                                    : candidate.score.overall >= 3
                                      ? "bg-ultramarine"
                                      : "bg-flag",
                                )}
                                style={{ width: `${Math.min(100, (candidate.score.overall / 5) * 100)}%` }}
                              />
                            </span>
                            <span className={cn("font-mono text-[10.5px] font-semibold tabular", scoreTone(candidate.score.overall))}>
                              {candidate.score.overall.toFixed(1)}
                            </span>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-1">
                            <span className="rounded-[3px] border border-rule bg-chalk/60 px-1.5 py-0.5 text-[8.5px] text-slate">
                              {languageLabel(candidate.language)}
                            </span>
                            <span className="rounded-[3px] border border-rule bg-chalk/60 px-1.5 py-0.5 font-mono text-[8.5px] text-slate">
                              EQ {candidate.score.evidenceQuality}%
                            </span>
                          </div>

                          {candidate.reviewReasons.length > 0 ? (
                            <p className="mt-2 line-clamp-2 rounded-[5px] border border-flag/30 bg-flag-soft/60 px-2 py-1 text-[9px] leading-snug text-[#6c5200]">
                              {candidate.reviewReasons[0]}
                            </p>
                          ) : null}

                          <div className="mt-2.5 flex flex-wrap items-center gap-1 border-t border-rule/70 pt-2">
                            {candidate.stage !== "shortlisted" && candidate.stage !== "scheduled" ? (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void moveStage(candidate, "shortlisted", "shortlist")}
                                className="inline-flex items-center gap-1 rounded-[4px] bg-ink px-2 py-1 text-[9.5px] font-medium text-chalk transition hover:bg-[#1b2942] disabled:opacity-50"
                              >
                                {isBusy ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Check className="h-2.5 w-2.5" />}
                                Shortlist
                              </button>
                            ) : null}

                            {candidate.stage === "shortlisted" ? (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void moveStage(candidate, "scheduled", "scheduled")}
                                className="inline-flex items-center gap-1 rounded-[4px] bg-verified px-2 py-1 text-[9.5px] font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                              >
                                {isBusy ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <CalendarPlus className="h-2.5 w-2.5" />}
                                Mark Scheduled
                              </button>
                            ) : null}

                            {(candidate.stage === "shortlisted" || candidate.stage === "scheduled") ? (
                              <Link
                                href={`/app/offer?candidateId=${encodeURIComponent(candidate.id)}`}
                                className="inline-flex items-center gap-1 rounded-[4px] border border-ultramarine/30 bg-ultramarine-soft/70 px-1.5 py-1 text-[9.5px] font-medium text-[#2536c9] hover:border-ultramarine"
                              >
                                <FileSignature className="h-2.5 w-2.5" />
                                Offer
                              </Link>
                            ) : null}

                            <Link
                              href={`/app/roles/${candidate.roleId}/candidates/${candidate.id}`}
                              className="ml-auto inline-flex items-center gap-0.5 text-[9.5px] font-medium text-slate hover:text-ink"
                            >
                              Evidence
                              <ArrowUpRight className="h-2.5 w-2.5" />
                            </Link>
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {compareOpen && compared.length >= 2 ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-[2px]">
          <button type="button" className="absolute inset-0" aria-label="Close comparison" onClick={() => setCompareOpen(false)} />
          <div className="relative max-h-[90dvh] w-full max-w-[960px] animate-rise overflow-y-auto rounded-[20px] border border-rule bg-paper shadow-2xl scroll-thin">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-rule bg-paper px-5 py-4">
              <div>
                <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-slate">
                  <Sparkles className="h-3 w-3 text-ultramarine" />
                  Side-by-side Hiring Comparison
                </p>
                <h2 className="mt-0.5 font-display text-[22px] font-medium tracking-[-0.03em] text-ink">
                  Compare {compared.length} candidates
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => { setCompareIds([]); setCompareOpen(false); }}>
                  Clear selection
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setCompareOpen(false)} aria-label="Close">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid gap-4 p-5 md:grid-cols-3">
              {compared.map((c) => (
                <div key={c.id} className="flex flex-col rounded-[12px] border border-rule bg-white p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-[14px] font-semibold text-ink">{c.name}</h3>
                      <p className="font-mono text-[9.5px] text-slate">
                        {c.alias} · {c.location}
                      </p>
                    </div>
                    <Badge tone={c.score.overall >= 4 ? "verified" : "ultra"}>{c.score.overall.toFixed(1)}/5</Badge>
                  </div>
                  <p className="mt-1 text-[10.5px] text-slate">
                    {c.roleTitle} · {languageLabel(c.language)}
                  </p>

                  <div className="mt-3 space-y-2 border-t border-rule/80 pt-3">
                    {c.score.items.map((skill) => (
                      <div key={skill.id}>
                        <div className="flex items-center justify-between text-[10.5px]">
                          <span className="text-slate">{skill.label}</span>
                          <span className="font-mono font-semibold text-ink">
                            {skill.insufficientEvidence ? "—" : `${skill.value.toFixed(1)}/5`}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-rule/70">
                          <div
                            className="h-full rounded-full bg-ultramarine"
                            style={{ width: `${skill.insufficientEvidence ? 10 : (skill.value / 5) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="mt-3 rounded-[7px] border border-rule/70 bg-chalk/45 p-2.5 text-[10.5px] leading-relaxed text-ink/90">
                    {c.score.summary}
                  </p>

                  <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
                    <Button variant="ink" size="sm" className="flex-1" asChild>
                      <Link href={`/app/roles/${c.roleId}/candidates/${c.id}`}>
                        Open evidence
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/app/mail?to=${encodeURIComponent(c.email)}&candidateId=${c.id}&compose=1`}>
                        <Mail className="h-3 w-3" />
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/app/offer?candidateId=${c.id}`}>
                        <FileSignature className="h-3 w-3" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
