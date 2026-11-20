"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { markdown } from "@codemirror/lang-markdown";
import { EditorView } from "@codemirror/view";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  CircleAlert,
  FileCode2,
  GitCompare,
  History,
  Play,
  Plus,
  Rocket,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import type { Candidate, Playbook } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const CodeMirror = dynamic(() => import("@uiw/react-codemirror").then((mod) => mod.default), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-paper text-[11px] text-slate">Loading editor…</div>
  ),
});

const editorTheme = EditorView.theme({
  "&": {
    backgroundColor: "#FAFBFC",
    color: "#101A2C",
    fontSize: "11.5px",
    height: "100%",
  },
  ".cm-scroller": { fontFamily: "var(--font-geist-mono)", lineHeight: "1.75" },
  ".cm-content": { padding: "14px 0", caretColor: "#3347F5" },
  ".cm-gutters": {
    backgroundColor: "#EEF1F5",
    color: "#8b95a7",
    border: "none",
    borderRight: "1px solid #D5DBE5",
    minWidth: "34px",
  },
  ".cm-activeLine": { backgroundColor: "rgba(51,71,245,0.035)" },
  ".cm-activeLineGutter": { backgroundColor: "rgba(51,71,245,0.06)", color: "#3347F5" },
  ".cm-cursor": { borderLeftColor: "#3347F5" },
  ".cm-selectionBackground, ::selection": { backgroundColor: "rgba(51,71,245,0.16) !important" },
  ".cm-line": { padding: "0 12px" },
});

type Thresholds = {
  shortlist: number;
  quality: number;
  review: number;
};

function parseThresholds(text: string): Thresholds {
  const shortlist = Number(text.match(/overall\s*>=\s*([\d.]+)\s*and\s*evidence_quality\s*>=\s*([\d.]+)/i)?.[1] ?? 4);
  const quality = Number(text.match(/overall\s*>=\s*[\d.]+\s*and\s*evidence_quality\s*>=\s*([\d.]+)/i)?.[1] ?? 0.75);
  const review = Number(text.match(/if\s*overall\s*>=\s*([\d.]+)/i)?.[1] ?? 3);
  return { shortlist, quality, review };
}

function routeCandidate(candidate: Candidate, thresholds: Thresholds) {
  const score = candidate.score.overall;
  const quality = candidate.score.evidenceQuality;
  if (score >= thresholds.shortlist && quality >= thresholds.quality) return "shortlist";
  if (score >= thresholds.review || quality < thresholds.quality) return "review";
  return "feedback";
}

const versionMarkdown: Record<number, string> = {};

export function PlaybookStudio({ playbook, candidates }: { playbook: Playbook; candidates: Candidate[] }) {
  const [markdownText, setMarkdownText] = useState(playbook.markdown);
  const [baseline, setBaseline] = useState(playbook.markdown);
  const [version, setVersion] = useState(playbook.version);
  const [tab, setTab] = useState<"flow" | "rules" | "diff">("flow");
  const [warning, setWarning] = useState<Playbook["warnings"][number] | null>(
    playbook.warnings[0] ?? null,
  );
  const [simulation, setSimulation] = useState<null | {
    before: Record<string, number>;
    after: Record<string, number>;
    changed: { name: string; from: string; to: string }[];
    thresholds: Thresholds;
  }>(null);
  const [versions, setVersions] = useState(playbook.versions);
  const [snippetOpen, setSnippetOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);

  const thresholds = useMemo(() => parseThresholds(markdownText), [markdownText]);
  const baselineThresholds = useMemo(() => parseThresholds(baseline), [baseline]);
  const dirty = markdownText !== baseline;

  const compile = () => {
    const parsed = parseThresholds(markdownText);
    if (!Number.isFinite(parsed.shortlist) || parsed.shortlist < 1 || parsed.shortlist > 5) {
      setWarning({ line: 20, severity: "error", message: "The shortlist threshold must be between 1 and 5." });
      toast.error("The playbook has an error. Check line 20.");
      return false;
    }
    setWarning(
      playbook.warnings[0] ?? null,
    );
    toast.success("Playbook compiled.", {
      description: `${parsed.shortlist} shortlist floor · ${Math.round(parsed.quality * 100)}% evidence floor · never auto-reject`,
    });
    return true;
  };

  const simulate = () => {
    const before: Record<string, number> = { shortlist: 0, review: 0, feedback: 0 };
    const after: Record<string, number> = { shortlist: 0, review: 0, feedback: 0 };
    const changed: { name: string; from: string; to: string }[] = [];
    for (const candidate of candidates) {
      const oldRoute = routeCandidate(candidate, baselineThresholds);
      const newRoute = routeCandidate(candidate, thresholds);
      before[oldRoute] += 1;
      after[newRoute] += 1;
      if (oldRoute !== newRoute) changed.push({ name: candidate.name, from: oldRoute, to: newRoute });
    }
    setSimulation({ before, after, changed, thresholds });
    setTab("rules");
    toast("Simulation complete.", { description: "No model calls. Stored scores replayed through the compiled rule." });
  };

  const publish = () => {
    const nextVersion = version + 1;
    setVersion(nextVersion);
    setBaseline(markdownText);
    setVersions((current) => [
      {
        version: nextVersion,
        publishedAt: new Date().toISOString(),
        publishedBy: "Meera R.",
        note: `Threshold ${thresholds.shortlist.toFixed(1)} · evidence ${Math.round(thresholds.quality * 100)}%`,
      },
      ...current,
    ]);
    setSimulation(null);
    toast.success(`Published v${nextVersion}.`, {
      description: "Open roles keep their pinned version until you republish them.",
    });
  };

  const restore = (target: number) => {
    const source = versionMarkdown[target] ?? (target === playbook.version ? baseline : playbook.markdown);
    setMarkdownText(source);
    setVersionsOpen(false);
    toast(`Loaded v${target} into the editor.`, { description: "Publish to create a new version. Nothing changed yet." });
  };

  versionMarkdown[playbook.version] = baseline;

  return (
    <div className="flex min-h-[calc(100dvh-48px)] flex-col">
      <div className="border-b border-rule bg-chalk">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild className="-ml-1">
              <Link href="/app/playbooks" aria-label="Back to playbooks">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-[24px] font-medium leading-none tracking-[-0.035em] text-ink">
                  {playbook.name}
                </h1>
                <Badge tone={dirty ? "flag" : "verified"} dot>
                  {dirty ? "unpublished changes" : "published"}
                </Badge>
                <span className="font-mono text-[9.5px] text-slate">v{version}</span>
              </div>
              <p className="mt-1 text-[10.5px] text-slate">
                {playbook.roleTitle} · configuration, not executable code · never auto-reject
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={compile}>
              <FileCode2 className="h-3.5 w-3.5" />
              Compile
            </Button>
            <Button variant="outline" size="sm" onClick={simulate}>
              <Play className="h-3.5 w-3.5" />
              Simulate
            </Button>
            <div className="relative">
              <Button variant="outline" size="sm" onClick={() => setVersionsOpen((open) => !open)}>
                <History className="h-3.5 w-3.5" />
                Versions
                <ChevronDown className="h-3 w-3" />
              </Button>
              {versionsOpen ? (
                <div className="absolute right-0 top-full z-30 mt-1 w-[280px] rounded-[8px] border border-rule bg-paper p-1 shadow-xl">
                  {versions.map((item) => (
                    <button
                      key={item.version}
                      type="button"
                      onClick={() => restore(item.version)}
                      className="flex w-full items-start gap-2 rounded-[5px] px-2 py-1.5 text-left hover:bg-chalk"
                    >
                      <span className="mt-0.5 font-mono text-[9px] text-slate">v{item.version}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[10.5px] text-ink">{item.note}</span>
                        <span className="block text-[8.5px] text-slate">{item.publishedBy} · {new Date(item.publishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                      </span>
                      <RotateCcw className="mt-0.5 h-2.5 w-2.5 text-slate" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <Button variant="primary" size="sm" onClick={publish} disabled={!dirty}>
              <Rocket className="h-3.5 w-3.5" />
              Publish v{version + 1}
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-[1600px] flex-1 grid-cols-1 gap-3 px-4 py-3 sm:px-6 lg:grid-cols-2">
        <section className="flex min-h-[560px] flex-col overflow-hidden rounded-[8px] border border-rule bg-paper">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-ink">playbook.md</span>
              <span className="font-mono text-[9px] text-slate">{markdownText.split("\n").length} lines</span>
            </div>
            <div className="relative flex items-center gap-1.5">
              {warning ? (
                <span className="flex items-center gap-1 text-[9px] text-[#8e6a00]">
                  <CircleAlert className="h-3 w-3" />
                  1 warning
                </span>
              ) : null}
              <Button variant="ghost" size="sm" onClick={() => setSnippetOpen((open) => !open)}>
                <Plus className="h-3 w-3" />
                Insert
              </Button>
              {snippetOpen ? (
                <div className="absolute right-0 top-full z-20 mt-1 w-[260px] rounded-[7px] border border-rule bg-paper p-1 shadow-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setMarkdownText((current) => `${current.trimEnd()}\n- if overall >= 3.5 and evidence_quality >= 0.70: send to review\n`);
                      setSnippetOpen(false);
                      toast.success("Decision rule inserted. Compile before publishing.");
                    }}
                    className="flex w-full items-center gap-2 rounded-[4px] px-2 py-1.5 text-left text-[10.5px] text-ink hover:bg-chalk"
                  >
                    <Plus className="h-3 w-3 text-slate" />
                    Add a decision rule
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMarkdownText((current) => `${current.trimEnd()}\n- every candidate gets a written note in the tracker\n`);
                      setSnippetOpen(false);
                      toast.success("Output step inserted. It will be saved but cannot run without a connector.");
                    }}
                    className="flex w-full items-center gap-2 rounded-[4px] px-2 py-1.5 text-left text-[10.5px] text-ink hover:bg-chalk"
                  >
                    <Plus className="h-3 w-3 text-slate" />
                    Add an output action
                  </button>
                </div>
              ) : null}
            </div>
          </div>
          <div className="min-h-[430px] flex-1 overflow-hidden">
            <CodeMirror
              value={markdownText}
              height="100%"
              theme={editorTheme}
              extensions={[markdown(), EditorView.lineWrapping]}
              basicSetup={{
                lineNumbers: true,
                foldGutter: false,
                highlightActiveLine: true,
                highlightActiveLineGutter: true,
                autocompletion: false,
              }}
              onChange={(value) => setMarkdownText(value)}
            />
          </div>
          {warning ? (
            <div className="flex items-start gap-2 border-t border-flag/30 bg-flag-soft/60 px-3 py-2">
              <CircleAlert className="mt-0.5 h-3 w-3 shrink-0 text-[#8e6a00]" />
              <div className="min-w-0 flex-1">
                <p className="text-[9.5px] font-medium text-[#6c5200]">Line {warning.line} · {warning.severity}</p>
                <p className="text-[9.5px] leading-relaxed text-[#6c5200]/80">{warning.message}</p>
              </div>
              <button type="button" onClick={() => setWarning(null)} className="text-[#8e6a00]/60 hover:text-[#6c5200]" aria-label="Dismiss warning">
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : null}
          <div className="flex items-center justify-between border-t border-rule bg-chalk/45 px-3 py-1.5">
            <span className="text-[9px] text-slate">
              Safe markdown. Arbitrary tool names and code blocks are rejected.
            </span>
            <span className="font-mono text-[9px] text-slate">sha256 · cached</span>
          </div>
        </section>

        <section className="flex min-h-[560px] flex-col overflow-hidden rounded-[8px] border border-rule bg-paper">
          <div className="flex items-center gap-0 border-b border-rule px-2">
            {[
              { id: "flow" as const, label: "Flow" },
              { id: "rules" as const, label: "Rules" },
              { id: "diff" as const, label: "Diff", count: dirty ? "1" : undefined },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  "relative flex h-9 items-center gap-1.5 px-3 text-[11px] font-medium transition",
                  tab === item.id ? "text-ink" : "text-slate hover:text-ink",
                )}
              >
                {item.label}
                {item.count ? <span className="rounded-[2px] bg-flag-soft px-1 font-mono text-[8px] text-[#7a5b00]">{item.count}</span> : null}
                {tab === item.id ? <span className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-ink" /> : null}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-1.5 pr-1">
              <span className="text-[9px] text-slate">Score ≥ {thresholds.shortlist.toFixed(1)}</span>
              <span className="h-2.5 w-px bg-rule" />
              <span className="text-[9px] text-slate">Quality ≥ {Math.round(thresholds.quality * 100)}%</span>
            </div>
          </div>

          {simulation ? (
            <div className="border-b border-ultramarine/20 bg-ultramarine-soft/55 px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-medium text-[#2536c9]">Simulation · last {candidates.length} stored scores</p>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[9.5px] text-[#2536c9]/85">
                    <span>Shortlist {simulation.before.shortlist} → <b>{simulation.after.shortlist}</b></span>
                    <span>Review {simulation.before.review} → <b>{simulation.after.review}</b></span>
                    <span>Feedback {simulation.before.feedback} → <b>{simulation.after.feedback}</b></span>
                    <span>{simulation.changed.length} candidate{simulation.changed.length === 1 ? "" : "s"} changed</span>
                  </div>
                  {simulation.changed.length > 0 ? (
                    <p className="mt-1 truncate text-[9px] text-[#2536c9]/70">
                      {simulation.changed.slice(0, 3).map((item) => `${item.name}: ${item.from} → ${item.to}`).join(" · ")}
                    </p>
                  ) : null}
                </div>
                <button type="button" onClick={() => setSimulation(null)} className="text-[#2536c9]/60 hover:text-[#2536c9]" aria-label="Clear simulation">
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-auto p-4 scroll-thin">
            {tab === "flow" ? <FlowGraph thresholds={thresholds} /> : null}
            {tab === "rules" ? <RulesView thresholds={thresholds} markdownText={markdownText} /> : null}
            {tab === "diff" ? <DiffView before={baseline} after={markdownText} /> : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-rule bg-chalk/45 px-3 py-2">
            <span className="flex items-center gap-1.5 text-[9px] text-slate">
              <Sparkles className="h-3 w-3 text-ultramarine" />
              Deterministic compiler. Same markdown, same rules.
            </span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={simulate}>
                <Play className="h-3 w-3" />
                Simulate
              </Button>
              <Button variant="ink" size="sm" onClick={publish} disabled={!dirty}>
                <Check className="h-3 w-3" />
                Publish v{version + 1}
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function FlowGraph({ thresholds }: { thresholds: Thresholds }) {
  const nodes = [
    { id: "invite", label: "Invite", sub: "one-use link", x: 24, y: 24, w: 160, h: 48 },
    { id: "interview", label: "Interview", sub: "Gemini Live · 4 min", x: 24, y: 100, w: 160, h: 48 },
    { id: "score", label: "Score", sub: "rubric + verified quotes", x: 24, y: 176, w: 160, h: 48 },
    { id: "decision", label: "Decision", sub: `score ≥ ${thresholds.shortlist.toFixed(1)} · quality ≥ ${Math.round(thresholds.quality * 100)}%`, x: 24, y: 252, w: 200, h: 48 },
    { id: "shortlist", label: "Shortlist", sub: "Scheduler asks first", x: 306, y: 218, w: 210, h: 48, tone: "verified" as const },
    { id: "review", label: "Human review", sub: "evidence uncertain", x: 306, y: 282, w: 210, h: 48, tone: "flag" as const },
    { id: "feedback", label: "Feedback draft", sub: "never auto-reject", x: 306, y: 346, w: 210, h: 48, tone: "neutral" as const },
  ];
  return (
    <div className="relative mx-auto h-[410px] min-w-[540px] max-w-[560px]">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 560 410" aria-hidden="true">
        <defs>
          <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 z" fill="#B9C1CE" />
          </marker>
        </defs>
        <line x1="104" y1="72" x2="104" y2="98" stroke="#B9C1CE" strokeWidth="1" markerEnd="url(#arrow)" />
        <line x1="104" y1="148" x2="104" y2="174" stroke="#B9C1CE" strokeWidth="1" markerEnd="url(#arrow)" />
        <line x1="104" y1="224" x2="104" y2="250" stroke="#B9C1CE" strokeWidth="1" markerEnd="url(#arrow)" />
        <path d="M224 276 C270 276 270 242 304 242" fill="none" stroke="#B9C1CE" strokeWidth="1" markerEnd="url(#arrow)" />
        <path d="M224 276 L304 306" fill="none" stroke="#B9C1CE" strokeWidth="1" markerEnd="url(#arrow)" />
        <path d="M224 276 C270 276 270 370 304 370" fill="none" stroke="#B9C1CE" strokeWidth="1" markerEnd="url(#arrow)" />
      </svg>
      {nodes.map((node) => (
        <div
          key={node.id}
          className={cn(
            "absolute rounded-[7px] border bg-paper px-3 py-2 shadow-[0_1px_0_rgba(16,26,44,0.03)] transition-all duration-300",
            node.tone === "verified"
              ? "border-verified/35"
              : node.tone === "flag"
                ? "border-flag/40"
                : "border-rule",
          )}
          style={{ left: node.x, top: node.y, width: node.w, height: node.h }}
        >
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                node.tone === "verified" ? "bg-verified" : node.tone === "flag" ? "bg-flag" : "bg-ink/50",
              )}
            />
            <span className="text-[10.5px] font-medium text-ink">{node.label}</span>
          </div>
          <p className="mt-0.5 truncate text-[8.5px] text-slate">{node.sub}</p>
        </div>
      ))}
      <div className="absolute bottom-1 left-4 font-mono text-[8.5px] text-slate/60">
        compiled from markdown · no arbitrary code
      </div>
    </div>
  );
}

function RulesView({ thresholds, markdownText }: { thresholds: Thresholds; markdownText: string }) {
  const skills = Array.from(markdownText.matchAll(/- (\w[\w\s]*?)\s*\(weight ([\d.]+)\)/g)).map((match) => ({
    name: match[1],
    weight: Number(match[2]),
  }));
  return (
    <div className="space-y-3">
      <div className="rounded-[7px] border border-rule bg-chalk/40 p-3">
        <p className="text-[10px] font-medium text-ink">Decision rules</p>
        <div className="mt-2 space-y-1.5 font-mono text-[9.5px] text-slate">
          <p><span className="text-slate/60">01</span> if overall &gt;= {thresholds.shortlist.toFixed(1)} and evidence_quality &gt;= {thresholds.quality.toFixed(2)} <span className="text-verified">→ shortlist</span></p>
          <p><span className="text-slate/60">02</span> if overall &gt;= {thresholds.review.toFixed(1)} or evidence_quality &lt; {thresholds.quality.toFixed(2)} <span className="text-flag">→ review</span></p>
          <p><span className="text-slate/60">03</span> if overall &lt; {thresholds.review.toFixed(1)} <span className="text-slate">→ feedback draft</span></p>
          <p><span className="text-slate/60">04</span> decision.auto_reject <span className="text-onair">= false</span></p>
        </div>
      </div>
      <div className="rounded-[7px] border border-rule bg-paper p-3">
        <p className="text-[10px] font-medium text-ink">Skills and weights</p>
        <div className="mt-2 space-y-1.5">
          {skills.length > 0 ? (
            skills.map((skill) => (
              <div key={skill.name} className="flex items-center gap-2">
                <span className="w-[120px] shrink-0 truncate text-[10px] text-ink">{skill.name}</span>
                <span className="h-1.5 flex-1 rounded-full bg-rule">
                  <span className="block h-full rounded-full bg-ultramarine" style={{ width: `${skill.weight * 100}%` }} />
                </span>
                <span className="w-8 text-right font-mono text-[9px] text-slate">{Math.round(skill.weight * 100)}%</span>
              </div>
            ))
          ) : (
            <p className="text-[9.5px] text-slate">No skills parsed yet.</p>
          )}
        </div>
        {skills.length > 0 && skills.reduce((sum, skill) => sum + skill.weight, 0) !== 1 ? (
          <p className="mt-2 flex items-center gap-1 text-[9px] text-[#8e6a00]">
            <CircleAlert className="h-3 w-3" /> Weights do not sum to 1. The compiler will normalise them.
          </p>
        ) : null}
      </div>
      <div className="rounded-[7px] border border-rule bg-paper p-3">
        <p className="text-[10px] font-medium text-ink">Tool allowlist</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {["calendar.freeBusy", "calendar.createEvent", "gmail.createDraft", "gmail.sendEmail", "sheets.appendRow"].map((tool) => (
            <span key={tool} className="rounded-[3px] border border-rule bg-white px-1.5 py-0.5 font-mono text-[8.5px] text-slate">{tool}</span>
          ))}
        </div>
        <p className="mt-2 text-[8.5px] leading-relaxed text-slate">
          External writes always require approval. The model cannot add a tool to this list.
        </p>
      </div>
    </div>
  );
}

function DiffView({ before, after }: { before: string; after: string }) {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  const max = Math.max(beforeLines.length, afterLines.length);
  const rows = Array.from({ length: max }).map((_, index) => {
    const oldLine = beforeLines[index];
    const newLine = afterLines[index];
    if (oldLine === newLine) return { type: "same" as const, text: newLine ?? "" };
    return { type: oldLine === undefined ? ("added" as const) : newLine === undefined ? ("removed" as const) : ("changed" as const), text: newLine ?? oldLine ?? "" };
  });
  const changes = rows.filter((row) => row.type !== "same");
  if (changes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-[11px] text-slate">No changes against the published version.</p>
      </div>
    );
  }
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-medium text-ink">Changes against v3</p>
        <span className="font-mono text-[9px] text-slate">{changes.length} changed lines</span>
      </div>
      <div className="overflow-hidden rounded-[6px] border border-rule">
        {rows.slice(Math.max(0, rows.findIndex((row) => row.type !== "same") - 3), Math.max(0, rows.findIndex((row) => row.type !== "same") - 3) + 24).map((row, index) => (
          <div
            key={index}
            className={cn(
              "flex gap-3 px-2.5 py-[3px] font-mono text-[9.5px]",
              row.type === "added" ? "bg-verified-soft text-[#0a7f51]" : row.type === "removed" ? "bg-onair-soft text-[#a61c3a]" : row.type === "changed" ? "bg-flag-soft text-[#6c5200]" : "bg-paper text-slate",
            )}
          >
            <span className="w-3 shrink-0 text-current/60">{row.type === "added" ? "+" : row.type === "removed" ? "−" : row.type === "changed" ? "~" : " "}</span>
            <span className="whitespace-pre-wrap break-words">{row.text || " "}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 flex items-center gap-1 text-[9px] text-slate">
        <GitCompare className="h-3 w-3" />
        Publish writes a new version. Rollback is one click.
      </p>
    </div>
  );
}
