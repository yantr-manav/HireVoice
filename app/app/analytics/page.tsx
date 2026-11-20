import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Clock3, ShieldCheck, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { getWorkspace } from "@/lib/data/workspace";
import { languageLabel, scoreTone } from "@/lib/utils";

export const metadata: Metadata = { title: "Analytics" };

const bucketLabels = ["1.0–1.9", "2.0–2.9", "3.0–3.4", "3.5–3.9", "4.0–4.4", "4.5–5.0"];

function bucketFor(score: number) {
  if (score < 2) return 0;
  if (score < 3) return 1;
  if (score < 3.5) return 2;
  if (score < 4) return 3;
  if (score < 4.5) return 4;
  return 5;
}

export default async function AnalyticsPage() {
  const workspace = await getWorkspace();
  const candidates = workspace.candidates;
  const buckets = bucketLabels.map((label, index) => ({
    label,
    count: candidates.filter((candidate) => bucketFor(candidate.score.overall) === index).length,
  }));
  const maxBucket = Math.max(...buckets.map((bucket) => bucket.count), 1);

  const languages = Array.from(new Set(candidates.map((candidate) => candidate.language))).map((language) => ({
    language,
    count: candidates.filter((candidate) => candidate.language === language).length,
  }));
  const totalLanguage = languages.reduce((sum, item) => sum + item.count, 0) || 1;

  const verified = workspace.metrics.verifiedQuotes;
  const totalQuotes = workspace.metrics.totalQuotes;
  const completion = Math.round(workspace.metrics.completionRate * 100);

  const roleRows = workspace.roles.map((role) => ({
    ...role,
    completion: Math.round((role.interviewed / Math.max(role.invited, 1)) * 100),
    shortlistRate: Math.round((role.shortlisted / Math.max(role.interviewed, 1)) * 100),
  }));

  const reviewByReason = candidates
    .flatMap((candidate) => candidate.reviewReasons)
    .reduce<Record<string, number>>((acc, reason) => {
      acc[reason] = (acc[reason] ?? 0) + 1;
      return acc;
    }, {});

  return (
    <div className="mx-auto max-w-[1480px] px-4 py-5 sm:px-6 sm:py-7 xl:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium text-slate">Rolling 30 days · all roles</p>
          <h1 className="mt-1 font-display text-[32px] font-medium leading-none tracking-[-0.04em] text-ink sm:text-[38px]">
            Analytics
          </h1>
          <p className="mt-1.5 max-w-[600px] text-[13px] leading-relaxed text-slate">
            Operational measures, not predictions. Every number here is counted from completed
            interviews and verified transcript quotes.
          </p>
        </div>
        <Badge tone="neutral">No candidate ranking by model</Badge>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            label: "Median time to result",
            value: `${workspace.metrics.medianResultSeconds}s`,
            note: "target under 45s",
            icon: Clock3,
          },
          {
            label: "Completion rate",
            value: `${completion}%`,
            note: `${workspace.metrics.completed} of ${workspace.metrics.invites} invited`,
            icon: TrendingUp,
          },
          {
            label: "Quotes verified",
            value: `${verified}/${totalQuotes}`,
            note: `${Math.round((verified / Math.max(totalQuotes, 1)) * 100)}% matched in code`,
            icon: CheckCircle2,
          },
          {
            label: "Human-owned outcomes",
            value: "100%",
            note: "no automatic rejection",
            icon: ShieldCheck,
          },
        ].map((metric) => (
          <Panel key={metric.label} className="p-4">
            <div className="flex items-start justify-between">
              <p className="text-[10.5px] text-slate">{metric.label}</p>
              <metric.icon className="h-3.5 w-3.5 text-slate/70" strokeWidth={1.7} />
            </div>
            <p className="mt-2 font-display text-[30px] font-medium leading-none tracking-[-0.04em] text-ink">
              {metric.value}
            </p>
            <p className="mt-1.5 text-[9.5px] text-slate">{metric.note}</p>
          </Panel>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-12">
        <Panel className="xl:col-span-7">
          <PanelHeader title="Score distribution" meta={`${candidates.length} completed interviews`} />
          <div className="p-4">
            <div className="flex h-[190px] items-end gap-2">
              {buckets.map((bucket) => (
                <div key={bucket.label} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                  <span className="font-mono text-[9px] tabular text-slate">{bucket.count}</span>
                  <div className="flex h-[145px] w-full items-end">
                    <div
                      className={
                        bucket.label === "4.0–4.4" || bucket.label === "4.5–5.0"
                          ? "w-full rounded-t-[3px] bg-verified/80"
                          : bucket.label === "3.0–3.4" || bucket.label === "3.5–3.9"
                            ? "w-full rounded-t-[3px] bg-flag/80"
                            : "w-full rounded-t-[3px] bg-onair/65"
                      }
                      style={{ height: `${Math.max(4, (bucket.count / maxBucket) * 100)}%` }}
                    />
                  </div>
                  <span className="whitespace-nowrap font-mono text-[8px] text-slate/80">{bucket.label}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-rule pt-2.5">
              <p className="text-[9.5px] leading-relaxed text-slate">
                A score is a rubric summary, not a hiring probability. Review decides.
              </p>
              <span className="font-mono text-[9px] text-slate">
                mean {((candidates.reduce((sum, candidate) => sum + candidate.score.overall, 0) / Math.max(candidates.length, 1))).toFixed(1)}
              </span>
            </div>
          </div>
        </Panel>

        <Panel className="xl:col-span-5">
          <PanelHeader title="Pipeline by role" meta="Invited → scheduled" />
          <div className="divide-y divide-rule">
            {roleRows.map((role) => (
              <div key={role.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/app/roles/${role.id}`} className="min-w-0">
                    <p className="truncate text-[11.5px] font-medium text-ink hover:underline hover:underline-offset-2">
                      {role.title}
                    </p>
                    <p className="text-[9.5px] text-slate">
                      {role.status} · playbook v{role.playbookVersion}
                    </p>
                  </Link>
                  <span className="text-right font-mono text-[9px] text-slate">
                    {role.invited} → {role.scheduled}
                  </span>
                </div>
                <div className="mt-2 flex h-2 overflow-hidden rounded-[2px] bg-rule/50">
                  <span className="h-full bg-ink/20" style={{ width: `${role.completion}%` }} />
                  <span className="h-full bg-flag" style={{ width: `${(role.inReview / Math.max(role.invited, 1)) * 100}%` }} />
                  <span className="h-full bg-ultramarine" style={{ width: `${(role.shortlisted / Math.max(role.invited, 1)) * 100}%` }} />
                  <span className="h-full bg-verified" style={{ width: `${(role.scheduled / Math.max(role.invited, 1)) * 100}%` }} />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[9px] text-slate">
                  <span>{role.completion}% completed</span>
                  <span>{role.shortlistRate}% shortlisted</span>
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-1 border-t border-rule bg-chalk/45 px-4 py-2 text-[8.5px] text-slate">
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-sm bg-ink/20" /> Done</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-sm bg-flag" /> Review</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-sm bg-ultramarine" /> Shortlist</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-sm bg-verified" /> Scheduled</span>
          </div>
        </Panel>

        <Panel className="xl:col-span-4">
          <PanelHeader title="Language mix" meta="Completed interviews" />
          <div className="p-4">
            {languages.map((item) => (
              <div key={item.language} className="mb-3 last:mb-0">
                <div className="flex items-center justify-between text-[10.5px]">
                  <span className="text-ink">{languageLabel(item.language)}</span>
                  <span className="font-mono text-[9.5px] text-slate">
                    {item.count} · {Math.round((item.count / totalLanguage) * 100)}%
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full rounded-full bg-rule/60">
                  <div
                    className="h-full rounded-full bg-ultramarine/80"
                    style={{ width: `${(item.count / totalLanguage) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            <p className="mt-4 border-t border-rule pt-2.5 text-[9.5px] leading-relaxed text-slate">
              Mixed-language interviews are scored in the language the candidate used. Quotes are
              verified against the same transcript.
            </p>
          </div>
        </Panel>

        <Panel className="xl:col-span-4">
          <PanelHeader title="Why work reaches review" meta="Review reasons" />
          <div className="divide-y divide-rule">
            {Object.entries(reviewByReason).length > 0 ? (
              Object.entries(reviewByReason)
                .sort((a, b) => b[1] - a[1])
                .map(([reason, count]) => (
                  <div key={reason} className="flex items-center gap-2.5 px-4 py-2.5">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-flag" />
                    <span className="min-w-0 flex-1 text-[10.5px] text-ink">{reason}</span>
                    <span className="font-mono text-[9.5px] text-slate">{count}</span>
                  </div>
                ))
            ) : (
              <p className="px-4 py-6 text-center text-[10.5px] text-slate">No reviews recorded.</p>
            )}
          </div>
          <div className="border-t border-rule bg-chalk/45 px-4 py-2 text-[9px] leading-relaxed text-slate">
            Review is the default when evidence is thin. It is never a penalty.
          </div>
        </Panel>

        <Panel className="xl:col-span-4">
          <PanelHeader title="Evidence quality" meta="Verified quote share" />
          <div className="p-4">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-[30px] font-medium leading-none tracking-[-0.04em] text-ink">
                {Math.round((verified / Math.max(totalQuotes, 1)) * 100)}%
              </span>
              <span className="text-[10.5px] text-slate">of quotes matched</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-rule/60">
              <div
                className="h-full rounded-full bg-verified"
                style={{ width: `${(verified / Math.max(totalQuotes, 1)) * 100}%` }}
              />
            </div>
            <div className="mt-1.5 flex justify-between font-mono text-[9px] text-slate">
              <span>{verified} verified</span>
              <span>{totalQuotes - verified} unverified</span>
            </div>
            <div className="mt-4 space-y-2 border-t border-rule pt-3">
              {candidates.slice(0, 5).map((candidate) => (
                <div key={candidate.id} className="flex items-center gap-2">
                  <Link
                    href={`/app/roles/${candidate.roleId}/candidates/${candidate.id}`}
                    className="min-w-0 flex-1 truncate text-[10px] text-ink hover:underline hover:underline-offset-2"
                  >
                    {candidate.name}
                  </Link>
                  <div className="h-1.5 w-[80px] rounded-full bg-rule/60">
                    <div
                      className={
                        candidate.score.evidenceQuality >= 0.8
                          ? "h-full rounded-full bg-verified"
                          : candidate.score.evidenceQuality >= 0.6
                            ? "h-full rounded-full bg-flag"
                            : "h-full rounded-full bg-onair"
                      }
                      style={{ width: `${candidate.score.evidenceQuality * 100}%` }}
                    />
                  </div>
                  <span className={`w-8 text-right font-mono text-[9px] ${scoreTone(candidate.score.overall)}`}>
                    {candidate.score.overall.toFixed(1)}
                  </span>
                  <ArrowUpRight className="h-2.5 w-2.5 text-slate/50" />
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      <p className="mt-4 max-w-[820px] text-[9.5px] leading-relaxed text-slate">
        Evidence quality combines verified quote share, self-consistency, rubric coverage and transcript
        quality. It describes how well the interview is supported, not how well someone will perform in
        the job. Hiring decisions remain human.
      </p>
    </div>
  );
}
