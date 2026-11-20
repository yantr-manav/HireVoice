import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Search, ShieldCheck, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { getWorkspace } from "@/lib/data/workspace";
import { formatTime, languageLabel, stageLabel } from "@/lib/utils";

export const metadata: Metadata = { title: "Search" };

export default async function AskPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const workspace = await getWorkspace();
  const lower = query.toLowerCase();

  const candidateMatches = query
    ? workspace.candidates.filter((candidate) => {
        const haystack = [
          candidate.name,
          candidate.alias,
          candidate.roleTitle,
          candidate.location,
          ...candidate.transcript.map((segment) => segment.text),
          ...candidate.score.items.flatMap((item) => item.evidence.map((evidence) => evidence.quote)),
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(lower);
      })
    : [];

  const roleMatches = query
    ? workspace.roles.filter((role) =>
        [role.title, role.location, role.playbookName].join(" ").toLowerCase().includes(lower),
      )
    : [];

  return (
    <div className="mx-auto max-w-[980px] px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-[10.5px] font-medium text-slate">
            <Search className="h-3 w-3" />
            Workspace search
          </p>
          <h1 className="mt-1 font-display text-[30px] font-medium leading-none tracking-[-0.04em] text-ink sm:text-[36px]">
            {query ? `“${query}”` : "Search this workspace"}
          </h1>
          <p className="mt-1.5 text-[12.5px] text-slate">
            {query
              ? `${candidateMatches.length} candidate${candidateMatches.length === 1 ? "" : "s"} · ${roleMatches.length} role${roleMatches.length === 1 ? "" : "s"}`
              : "Find a candidate, a quote, or a role. Search runs only over this workspace."}
          </p>
        </div>
        <Badge tone="neutral">read-only</Badge>
      </div>

      <Panel className="mt-5 p-4">
        <form action="/app/ask" className="flex h-10 items-center gap-2 rounded-[6px] border border-rule bg-white px-3">
          <Search className="h-4 w-4 text-slate/70" />
          <input
            name="q"
            defaultValue={query}
            autoFocus
            placeholder="Try “refund”, “Sana”, or “Hinglish”"
            className="h-full flex-1 bg-transparent text-[12.5px] text-ink outline-none placeholder:text-slate/50"
          />
          <Button type="submit" variant="ink" size="sm">
            Search
          </Button>
        </form>
        <p className="mt-2 flex items-start gap-1.5 text-[9.5px] leading-relaxed text-slate">
          <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-verified" />
          This is deterministic full-text search, not a generative answer. The Gemini answer layer is not
          enabled in this demo, so nothing is inferred or invented.
        </p>
      </Panel>

      {query ? (
        <div className="mt-4 space-y-4">
          <Panel className="overflow-hidden">
            <PanelHeader title="Candidates" meta={`${candidateMatches.length} matches`} />
            {candidateMatches.length === 0 ? (
              <p className="px-4 py-6 text-center text-[11px] text-slate">
                No candidate matched. Try a shorter word.
              </p>
            ) : (
              <div className="divide-y divide-rule">
                {candidateMatches.slice(0, 8).map((candidate) => {
                  const matchingQuote = candidate.score.items
                    .flatMap((item) => item.evidence.map((evidence) => ({ ...evidence, label: item.label })))
                    .find((evidence) => evidence.quote.toLowerCase().includes(lower));
                  return (
                    <Link
                      key={candidate.id}
                      href={`/app/roles/${candidate.roleId}/candidates/${candidate.id}`}
                      className="flex items-start gap-3 px-4 py-3 transition hover:bg-white"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-rule bg-white font-mono text-[8px] text-slate">
                        {candidate.name.split(" ").map((part) => part[0]).join("")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[11.5px] font-medium text-ink">{candidate.name}</p>
                          <span className="font-mono text-[8.5px] text-slate">{candidate.alias}</span>
                          <Badge tone={candidate.stage === "shortlisted" ? "verified" : candidate.stage === "in_review" ? "flag" : "neutral"}>
                            {stageLabel(candidate.stage)}
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-[9.5px] text-slate">
                          {candidate.roleTitle} · {languageLabel(candidate.language)} · score {candidate.score.overall.toFixed(1)}
                        </p>
                        {matchingQuote ? (
                          <p className="mt-1 rounded-[4px] border border-ultramarine/15 bg-ultramarine-soft/50 px-2 py-1 text-[9.5px] leading-relaxed text-[#2536c9]">
                            “{matchingQuote.quote}” · {matchingQuote.label} at {formatTime(matchingQuote.tStartMs)}
                          </p>
                        ) : null}
                      </div>
                      <ArrowUpRight className="mt-1 h-3.5 w-3.5 shrink-0 text-slate/50" />
                    </Link>
                  );
                })}
              </div>
            )}
          </Panel>

          <Panel className="overflow-hidden">
            <PanelHeader title="Roles" meta={`${roleMatches.length} matches`} />
            {roleMatches.length === 0 ? (
              <p className="px-4 py-6 text-center text-[11px] text-slate">No role matched.</p>
            ) : (
              <div className="divide-y divide-rule">
                {roleMatches.map((role) => (
                  <Link
                    key={role.id}
                    href={`/app/roles/${role.id}`}
                    className="flex items-center gap-3 px-4 py-3 transition hover:bg-white"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[11.5px] font-medium text-ink">{role.title}</p>
                      <p className="text-[9.5px] text-slate">
                        {role.location} · {role.interviewed} interviews · playbook v{role.playbookVersion}
                      </p>
                    </div>
                    <ArrowUpRight className="h-3.5 w-3.5 text-slate/50" />
                  </Link>
                ))}
              </div>
            )}
          </Panel>
        </div>
      ) : (
        <Panel className="mt-4 p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-ultramarine" />
            <p className="text-[11.5px] font-medium text-ink">Try one of these</p>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {["refund", "Sana", "Hinglish", "empathy", "unverified"].map((term) => (
              <Link
                key={term}
                href={`/app/ask?q=${encodeURIComponent(term)}`}
                className="rounded-[4px] border border-rule bg-white px-2 py-1 text-[10px] text-slate transition hover:border-slate/50 hover:text-ink"
              >
                {term}
              </Link>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
