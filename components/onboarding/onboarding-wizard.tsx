"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  CircleAlert,
  FileText,
  Headphones,
  Languages,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import type { Workspace } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const steps = [
  { id: 1, label: "Role" },
  { id: 2, label: "Interview" },
  { id: 3, label: "Rubric" },
  { id: 4, label: "Decisions" },
] as const;

const languages = [
  { id: "hi", label: "हिंदी" },
  { id: "en", label: "English" },
  { id: "hinglish", label: "Hinglish" },
  { id: "mr", label: "मराठी" },
];

const skillOptions = [
  { id: "clarity", label: "Clarity", description: "Clear, organised sentences" },
  { id: "empathy", label: "Empathy", description: "Acknowledges feelings before solving" },
  { id: "listening", label: "Listening", description: "Answers what was asked" },
  { id: "problem_solving", label: "Problem solving", description: "Proposes concrete next steps" },
  { id: "accuracy", label: "Accuracy", description: "Spots a discrepancy and checks it" },
  { id: "ownership", label: "Ownership", description: "Says what they would do next" },
];

type Question = { id: number; text: string; probe: string };

export function OnboardingWizard({ workspace }: { workspace: Workspace }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("Hyderabad · on-site");
  const [manager, setManager] = useState(workspace.user.name);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(["hi", "en"]);
  const [questions, setQuestions] = useState<Question[]>([
    { id: 1, text: "Introduce yourself and tell me why this job interests you.", probe: "What they say first" },
    { id: 2, text: "Describe a time you helped someone who was upset.", probe: "Specific example" },
    { id: 3, text: "A customer says their refund is late. Calm them and solve it.", probe: "Role-play" },
  ]);
  const [skills, setSkills] = useState<string[]>(["clarity", "empathy", "listening", "problem_solving"]);
  const [shortlist, setShortlist] = useState(4.0);
  const [evidenceFloor, setEvidenceFloor] = useState(75);
  const [published, setPublished] = useState(false);

  const weights = useMemo(() => {
    if (skills.length === 0) return {};
    const base = Math.floor((100 / skills.length) * 10) / 10;
    const values: Record<string, number> = {};
    skills.forEach((skill, index) => {
      values[skill] = index === 0 ? Math.round((100 - base * (skills.length - 1)) * 10) / 10 : base;
    });
    return values;
  }, [skills]);

  const canContinue =
    step === 1
      ? title.trim().length > 2 && selectedLanguages.length > 0
      : step === 2
        ? questions.length >= 2 && questions.every((question) => question.text.trim().length > 8)
        : step === 3
          ? skills.length >= 2
          : true;

  const toggleLanguage = (id: string) => {
    setSelectedLanguages((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const toggleSkill = (id: string) => {
    setSkills((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const publish = () => {
    setPublished(true);
    toast.success("Role created in this demo.", {
      description: "A playbook draft, invite link and approval rules were prepared. Nothing was sent.",
    });
  };

  if (published) {
    return (
      <div className="mx-auto max-w-[820px] px-4 py-10 sm:px-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-verified/25 bg-verified-soft">
          <Check className="h-5 w-5 text-verified" />
        </div>
        <p className="mt-5 text-[11px] font-medium text-slate">Role created</p>
        <h1 className="mt-1 font-display text-[36px] font-medium leading-[1.05] tracking-[-0.045em] text-ink sm:text-[44px]">
          {title || "Your role"} is ready to invite.
        </h1>
        <p className="mt-3 max-w-[560px] text-[13px] leading-relaxed text-slate">
          In the live workspace this creates the role, a playbook draft and a single-use invite link. No
          candidate is emailed until you approve the draft.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            { label: "Playbook", value: "Draft v1", note: "publish when ready" },
            { label: "Decision rule", value: `${shortlist.toFixed(1)} / ${evidenceFloor}%`, note: "score / evidence" },
            { label: "Auto-reject", value: "Never", note: "human decision only" },
          ].map((item) => (
            <div key={item.label} className="rounded-[8px] border border-rule bg-paper p-3.5">
              <p className="text-[9.5px] text-slate">{item.label}</p>
              <p className="mt-1 font-display text-[19px] font-medium tracking-[-0.03em] text-ink">{item.value}</p>
              <p className="mt-0.5 text-[9px] text-slate">{item.note}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-[10px] border border-rule bg-paper p-4">
          <p className="text-[10px] font-medium text-slate">Next steps</p>
          <ol className="mt-2 space-y-2">
            {[
              "Review the generated playbook and edit the questions.",
              "Copy the invite link or scan the QR on a phone.",
              "Complete one demo interview yourself before sending it to a candidate.",
            ].map((item, index) => (
              <li key={item} className="flex items-center gap-2 text-[11px] text-slate">
                <span className="flex h-4 w-4 items-center justify-center rounded-full border border-rule bg-white font-mono text-[8px]">
                  {index + 1}
                </span>
                {item}
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button variant="ink" size="md" asChild>
            <Link href="/app/roles">
              Open roles
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
          <Button variant="outline" size="md" asChild>
            <Link href="/i/demo">
              <Headphones className="h-3.5 w-3.5" />
              Try the candidate booth
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1480px] px-4 py-5 sm:px-6 sm:py-7 xl:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium text-slate">
            Step {step} of 4 · about 4 minutes
          </p>
          <h1 className="mt-1 font-display text-[32px] font-medium leading-none tracking-[-0.04em] text-ink sm:text-[38px]">
            Create a role
          </h1>
          <p className="mt-1.5 max-w-[560px] text-[13px] leading-relaxed text-slate">
            You are building the interview, the rubric and the decision rule together. The candidate sees
            plain language; the desk sees the evidence.
          </p>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/app">
            <ArrowLeft className="h-3.5 w-3.5" />
            Leave setup
          </Link>
        </Button>
      </div>

      <div className="mt-5 flex items-center gap-1 overflow-x-auto border-b border-rule scroll-thin" role="tablist">
        {steps.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => (item.id < step || canContinue ? setStep(item.id) : null)}
            role="tab"
            aria-selected={step === item.id}
            className={cn(
              "relative flex h-9 items-center gap-1.5 whitespace-nowrap px-3 text-[11.5px] font-medium transition",
              step === item.id ? "text-ink" : item.id < step ? "text-slate hover:text-ink" : "text-slate/60",
            )}
          >
            <span
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded-full border font-mono text-[8px]",
                item.id < step
                  ? "border-verified/30 bg-verified-soft text-[#0a7f51]"
                  : step === item.id
                    ? "border-ink bg-ink text-chalk"
                    : "border-rule bg-white text-slate",
              )}
            >
              {item.id < step ? <Check className="h-2.5 w-2.5" /> : item.id}
            </span>
            {item.label}
            {step === item.id ? <span className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-ink" /> : null}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-[10px] border border-rule bg-paper">
          {step === 1 ? (
            <div className="p-5">
              <h2 className="text-[13px] font-semibold text-ink">Role basics</h2>
              <p className="mt-0.5 text-[10.5px] text-slate">
                Keep the title honest. It appears on the invite and the candidate report.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="text-[10px] font-medium text-slate">Role title</span>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="e.g. Customer Support Executive · voice"
                    className="mt-1 h-10 w-full rounded-[6px] border border-rule bg-white px-3 text-[12px] text-ink outline-none placeholder:text-slate/50 focus:border-ink"
                  />
                  {title.trim().length > 0 && title.trim().length < 3 ? (
                    <span className="mt-1 block text-[9px] text-onair">Use at least 3 characters.</span>
                  ) : null}
                </label>
                <label className="block">
                  <span className="text-[10px] font-medium text-slate">Location</span>
                  <input
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    className="mt-1 h-10 w-full rounded-[6px] border border-rule bg-white px-3 text-[12px] text-ink outline-none focus:border-ink"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-medium text-slate">Hiring manager</span>
                  <input
                    value={manager}
                    onChange={(event) => setManager(event.target.value)}
                    className="mt-1 h-10 w-full rounded-[6px] border border-rule bg-white px-3 text-[12px] text-ink outline-none focus:border-ink"
                  />
                </label>
              </div>

              <div className="mt-5">
                <span className="flex items-center gap-1.5 text-[10px] font-medium text-slate">
                  <Languages className="h-3 w-3" />
                  Languages the interview can run in
                </span>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {languages.map((language) => {
                    const active = selectedLanguages.includes(language.id);
                    return (
                      <button
                        key={language.id}
                        type="button"
                        onClick={() => toggleLanguage(language.id)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-[5px] border px-2.5 py-1.5 text-[11px] transition",
                          active
                            ? "border-ink bg-ink text-chalk"
                            : "border-rule bg-white text-slate hover:border-slate/50",
                        )}
                      >
                        {active ? <Check className="h-3 w-3" /> : null}
                        {language.label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-[9.5px] leading-relaxed text-slate">
                  A candidate can switch language mid-answer. The interview keeps going; the transcript
                  records the switch.
                </p>
              </div>

              <div className="mt-5 rounded-[6px] border border-rule bg-chalk/45 px-3 py-2.5">
                <p className="flex items-center gap-1.5 text-[10px] font-medium text-ink">
                  <Users className="h-3 w-3" />
                  Who reviews
                </p>
                <p className="mt-1 text-[10px] leading-relaxed text-slate">
                  Every completed interview lands in the shared review queue. Shortlisting needs a named
                  recruiter; no threshold moves a candidate on its own.
                </p>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-[13px] font-semibold text-ink">Interview script</h2>
                  <p className="mt-0.5 text-[10.5px] text-slate">
                    Four minutes, three questions. Every question maps to at least one skill.
                  </p>
                </div>
                <Badge tone="neutral">{questions.length} questions · ~4 min</Badge>
              </div>

              <div className="mt-4 space-y-2.5">
                {questions.map((question, index) => (
                  <div key={question.id} className="rounded-[7px] border border-rule bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 font-mono text-[9px] text-slate">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-ink text-[8px] text-chalk">
                          {index + 1}
                        </span>
                        question
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (questions.length <= 2) {
                            toast.error("Keep at least two questions.");
                            return;
                          }
                          setQuestions((current) => current.filter((item) => item.id !== question.id));
                        }}
                        className="text-slate/60 transition hover:text-onair"
                        aria-label={`Remove question ${index + 1}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <input
                      value={question.text}
                      onChange={(event) =>
                        setQuestions((current) =>
                          current.map((item) => (item.id === question.id ? { ...item, text: event.target.value } : item)),
                        )
                      }
                      className="mt-1.5 w-full bg-transparent text-[12px] text-ink outline-none"
                      placeholder="What would you ask?"
                    />
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <Sparkles className="h-3 w-3 text-slate/60" />
                      <input
                        value={question.probe}
                        onChange={(event) =>
                          setQuestions((current) =>
                            current.map((item) => (item.id === question.id ? { ...item, probe: event.target.value } : item)),
                          )
                        }
                        className="w-full bg-transparent text-[9.5px] text-slate outline-none placeholder:text-slate/50"
                        placeholder="What a good answer should show"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() =>
                  setQuestions((current) => [
                    ...current,
                    {
                      id: Math.max(...current.map((item) => item.id), 0) + 1,
                      text: "",
                      probe: "What a good answer should show",
                    },
                  ])
                }
              >
                <Plus className="h-3.5 w-3.5" />
                Add a question
              </Button>

              <div className="mt-4 rounded-[6px] border border-flag/30 bg-flag-soft/50 px-3 py-2.5">
                <p className="flex items-center gap-1.5 text-[10px] font-medium text-[#6c5200]">
                  <CircleAlert className="h-3 w-3" />
                  Keep it job-related
                </p>
                <p className="mt-1 text-[9.5px] leading-relaxed text-[#6c5200]/85">
                  Avoid questions about family, marriage, caste, religion or health. The pilot review checks
                  scripts against this rule before a role goes live.
                </p>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="p-5">
              <h2 className="text-[13px] font-semibold text-ink">Scoring rubric</h2>
              <p className="mt-0.5 text-[10.5px] text-slate">
                Pick the skills this role actually needs. Weights are normalised automatically.
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {skillOptions.map((skill) => {
                  const active = skills.includes(skill.id);
                  return (
                    <button
                      key={skill.id}
                      type="button"
                      onClick={() => toggleSkill(skill.id)}
                      className={cn(
                        "flex items-start gap-2.5 rounded-[7px] border p-3 text-left transition",
                        active ? "border-ink/25 bg-white" : "border-rule bg-chalk/30 hover:border-slate/40",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border",
                          active ? "border-ink bg-ink text-chalk" : "border-rule bg-white",
                        )}
                      >
                        {active ? <Check className="h-2.5 w-2.5" /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-[11.5px] font-medium text-ink">{skill.label}</span>
                          {active ? (
                            <span className="font-mono text-[9px] text-slate">{weights[skill.id] ?? 0}%</span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block text-[9.5px] leading-relaxed text-slate">
                          {skill.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 rounded-[7px] border border-rule bg-chalk/40 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-medium text-ink">Weight preview</p>
                  <span className="font-mono text-[9px] text-slate">normalised to 100%</span>
                </div>
                <div className="mt-2 flex h-3 overflow-hidden rounded-[3px]">
                  {skills.map((skill, index) => (
                    <span
                      key={skill}
                      className={cn(
                        "h-full",
                        ["bg-ink", "bg-ultramarine", "bg-verified", "bg-flag", "bg-onair", "bg-slate"][index % 6],
                      )}
                      style={{ width: `${weights[skill] ?? 0}%` }}
                    />
                  ))}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[8.5px] text-slate">
                  {skills.map((skill) => (
                    <span key={skill} className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-sm bg-slate/60" />
                      {skill.replace("_", " ")} · {weights[skill] ?? 0}%
                    </span>
                  ))}
                </div>
              </div>

              <p className="mt-3 text-[9.5px] leading-relaxed text-slate">
                Scores are attached to at least one transcript quote. If a skill has no quote, it is marked
                “insufficient evidence” and does not count toward the overall score.
              </p>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="p-5">
              <h2 className="text-[13px] font-semibold text-ink">Decision rules</h2>
              <p className="mt-0.5 text-[10.5px] text-slate">
                A suggestion is not a decision. The last rule is fixed and cannot be edited.
              </p>

              <div className="mt-4 space-y-2.5">
                <div className="rounded-[7px] border border-verified/25 bg-verified-soft/35 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-[10.5px] font-medium text-ink">
                      <span className="h-1.5 w-1.5 rounded-full bg-verified" />
                      Suggest shortlist
                    </span>
                    <span className="font-mono text-[9px] text-slate">no external action</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate">
                    overall ≥
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      max="5"
                      value={shortlist}
                      onChange={(event) => setShortlist(Number(event.target.value))}
                      className="h-7 w-14 rounded-[4px] border border-rule bg-white px-1.5 font-mono text-[10px] text-ink outline-none focus:border-ink"
                    />
                    and evidence quality ≥
                    <input
                      type="number"
                      step="5"
                      min="0"
                      max="100"
                      value={evidenceFloor}
                      onChange={(event) => setEvidenceFloor(Number(event.target.value))}
                      className="h-7 w-14 rounded-[4px] border border-rule bg-white px-1.5 font-mono text-[10px] text-ink outline-none focus:border-ink"
                    />
                    %
                  </div>
                </div>

                <div className="rounded-[7px] border border-flag/30 bg-flag-soft/35 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-[10.5px] font-medium text-ink">
                      <span className="h-1.5 w-1.5 rounded-full bg-flag" />
                      Send to a human
                    </span>
                    <span className="font-mono text-[9px] text-slate">default</span>
                  </div>
                  <p className="mt-1.5 text-[9.5px] leading-relaxed text-slate">
                    Anything below the shortlist rule, any unverified quote, or any thin evidence goes to the
                    review queue. This rule is fixed.
                  </p>
                </div>

                <div className="rounded-[7px] border border-rule bg-chalk/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-[10.5px] font-medium text-ink">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate" />
                      Draft feedback
                    </span>
                    <span className="font-mono text-[9px] text-slate">approval required</span>
                  </div>
                  <p className="mt-1.5 text-[9.5px] leading-relaxed text-slate">
                    A kind, specific note is prepared for the recruiter to edit and approve. It is never
                    sent automatically.
                  </p>
                </div>

                <div className="flex items-start gap-2 rounded-[7px] border border-onair/20 bg-onair-soft/35 p-3">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-onair" />
                  <div>
                    <p className="text-[10px] font-medium text-ink">Auto-reject is off and cannot be turned on.</p>
                    <p className="mt-0.5 text-[9.5px] leading-relaxed text-slate">
                      Every outcome is recorded with the recruiter&apos;s name, the reason and the evidence
                      reviewed.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex items-center justify-between border-t border-rule bg-chalk/40 px-5 py-3">
            <Button
              variant="ghost"
              size="md"
              onClick={() => setStep((current) => Math.max(1, current - 1))}
              disabled={step === 1}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </Button>
            {step < 4 ? (
              <Button variant="ink" size="md" onClick={() => setStep((current) => current + 1)} disabled={!canContinue}>
                Continue
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button variant="primary" size="md" onClick={publish}>
                <Check className="h-3.5 w-3.5" />
                Create role and playbook
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-[10px] border border-rule bg-paper p-4">
            <p className="text-[10px] font-medium text-slate">Live summary</p>
            <p className="mt-1.5 font-display text-[20px] font-medium leading-tight tracking-[-0.03em] text-ink">
              {title || "Untitled role"}
            </p>
            <p className="mt-0.5 text-[10px] text-slate">{location}</p>
            <dl className="mt-3 space-y-2 border-t border-rule pt-2.5 text-[10px]">
              <div className="flex justify-between gap-2">
                <dt className="text-slate">Languages</dt>
                <dd className="text-right text-ink">
                  {selectedLanguages.map((id) => languages.find((item) => item.id === id)?.label).join(" · ") || "None"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate">Questions</dt>
                <dd className="text-ink">{questions.length}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate">Skills</dt>
                <dd className="text-right text-ink">{skills.map((skill) => skill.replace("_", " ")).join(" · ") || "None"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate">Shortlist</dt>
                <dd className="text-ink">
                  ≥ {shortlist.toFixed(1)} · {evidenceFloor}%
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate">Auto-reject</dt>
                <dd className="text-verified">Never</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-[10px] border border-ink/10 bg-ink p-4 text-chalk">
            <div className="flex items-center gap-2 text-[9.5px] uppercase tracking-[0.08em] text-mist/45">
              <Headphones className="h-3 w-3 text-glow" />
              Candidate preview
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-mist">
              “Hi, I&apos;m Vaani. This is a four-minute conversation about how you handle customers. You can
              pause or stop at any time.”
            </p>
            <p className="mt-2 text-[9.5px] leading-relaxed text-mist/45">
              Consent comes first. The candidate hears the recording rule before the first question.
            </p>
          </div>

          <div className="rounded-[8px] border border-rule bg-paper p-3.5">
            <p className="flex items-center gap-1.5 text-[10px] font-medium text-ink">
              <FileText className="h-3 w-3" />
              Generated playbook
            </p>
            <p className="mt-1 text-[9.5px] leading-relaxed text-slate">
              A markdown draft is created with these questions, weights and rules. You can edit it in
              Playbook Studio before publishing.
            </p>
            <Link href="/app/playbooks/support-exec" className="mt-2 inline-flex items-center gap-1 text-[9.5px] font-medium text-ultramarine">
              See an example
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
