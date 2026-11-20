import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Clock3,
  FileText,
  Headphones,
  Mic,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { VoiceOrb } from "@/components/voice/voice-orb";
import { MicWave } from "@/components/voice/mic-wave";
import { EvidenceShowcase } from "@/components/marketing/evidence-showcase";
import { candidates } from "@/lib/demo/data";

export const metadata: Metadata = {
  title: "Hirevoice — Hire by talking",
  description:
    "Voice-first screening for BPO teams. A four-minute call, a rubric tied to exact transcript quotes, and a recruiter who owns the decision.",
};

const sana = candidates.find((candidate) => candidate.id === "cand-sana") ?? candidates[0];

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-chalk">
      <header className="sticky top-0 z-40 border-b border-rule bg-chalk/92 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1320px] items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Logo />
          <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label="Primary">
            {[
              { href: "#evidence", label: "Evidence" },
              { href: "#desk", label: "Desk and Booth" },
              { href: "#how", label: "How it runs" },
              { href: "#trust", label: "Trust" },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-[5px] px-2.5 py-1.5 text-[12px] text-slate transition hover:bg-ink/[0.04] hover:text-ink"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            <Link
              href="/practice"
              className="hidden rounded-[5px] px-2.5 py-1.5 text-[12px] text-slate transition hover:text-ink sm:block"
            >
              For candidates
            </Link>
            <Button variant="outline" size="sm" asChild>
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button variant="ink" size="sm" asChild>
              <Link href="/api/demo/enter">
                Open demo
                <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-rule">
          <div className="rule-grid pointer-events-none absolute inset-0 opacity-45 [mask-image:linear-gradient(to_bottom,black,transparent_75%)]" />
          <div className="relative mx-auto grid max-w-[1320px] gap-10 px-4 pb-12 pt-12 sm:px-6 sm:pb-16 sm:pt-16 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:gap-12 lg:px-8 lg:pb-20 lg:pt-20">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-rule bg-paper px-2.5 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-verified" />
                <span className="text-[10.5px] font-medium tracking-[0.02em] text-slate">
                  Voice screening for BPO and staffing teams
                </span>
              </div>

              <h1 className="mt-5 max-w-[640px] font-display text-[48px] font-medium leading-[0.95] tracking-[-0.055em] text-ink sm:text-[64px] lg:text-[70px]">
                Hire by talking.
                <br />
                Decide by{" "}
                <span className="relative inline-block">
                  evidence.
                  <span className="absolute -bottom-1 left-0 h-[3px] w-full rounded-full bg-ultramarine/70" />
                </span>
              </h1>

              <p className="mt-5 max-w-[520px] text-[14px] leading-relaxed text-slate sm:text-[15px]">
                Candidates show how they actually speak to customers in a four-minute voice screen. You
                get a rubric score tied to the exact transcript moment behind it — and you make the call.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-2.5">
                <Button variant="ink" size="lg" asChild>
                  <Link href="/api/demo/enter">
                    Open the demo workspace
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button variant="outline" size="lg" asChild>
                  <Link href="/practice">
                    <Mic className="h-4 w-4" />
                    Try a practice interview
                  </Link>
                </Button>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10.5px] text-slate">
                <span className="flex items-center gap-1.5">
                  <Check className="h-3 w-3 text-verified" />
                  Seeded demo, clearly labelled
                </span>
                <span className="flex items-center gap-1.5">
                  <Check className="h-3 w-3 text-verified" />
                  No account needed
                </span>
                <span className="flex items-center gap-1.5">
                  <Check className="h-3 w-3 text-verified" />
                  Never auto-rejects
                </span>
              </div>

              <dl className="mt-8 grid max-w-[520px] grid-cols-3 gap-4 border-t border-rule pt-4">
                {[
                  ["4 min", "screen length"],
                  ["38 s", "median result"],
                  ["104/112", "quotes verified"],
                ].map(([value, label]) => (
                  <div key={label}>
                    <dt className="font-display text-[21px] font-medium leading-none tracking-[-0.03em] text-ink">
                      {value}
                    </dt>
                    <dd className="mt-1 text-[9.5px] text-slate">{label}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="relative mx-auto w-full max-w-[540px] lg:max-w-none">
              <div className="absolute -inset-8 -z-10 rounded-[40px] bg-[radial-gradient(circle_at_60%_40%,rgba(51,71,245,0.12),transparent_65%)]" />
              <div className="overflow-hidden rounded-[20px] border border-ink/10 bg-booth p-1 shadow-[0_40px_100px_-45px_rgba(11,16,48,0.75)]">
                <div className="relative overflow-hidden rounded-[17px] border border-white/10 bg-booth-2">
                  <div className="booth-grid pointer-events-none absolute inset-0 opacity-60" />
                  <div className="relative flex items-center justify-between border-b border-white/10 px-4 py-3">
                    <span className="flex items-center gap-2 text-[9.5px] font-medium uppercase tracking-[0.1em] text-mist/60">
                      <span className="animate-onair h-1.5 w-1.5 rounded-full bg-onair" />
                      Live screen · 02:14 / 04:00
                    </span>
                    <span className="font-mono text-[9px] text-mist/35">16 kHz · mono</span>
                  </div>

                  <div className="relative flex flex-col items-center px-4 py-5">
                    <VoiceOrb size="md" progress={0.54} label="Vaani" sublabel="Listening" listening />

                    <div className="mt-4 w-full max-w-[360px] rounded-[8px] border border-white/10 bg-booth/70 px-3 py-2.5">
                      <p className="text-[11px] leading-relaxed text-mist/80">
                        “A customer says their refund is late. Walk me through what you would say first.”
                      </p>
                      <div className="mt-2 flex items-center gap-2 border-t border-white/10 pt-2">
                        <span className="font-mono text-[8.5px] uppercase tracking-[0.08em] text-mist/35">
                          Question 3 of 4
                        </span>
                        <span className="ml-auto flex items-end gap-[2px]">
                          {[0.35, 0.6, 0.9, 0.7, 0.4].map((height, index) => (
                            <span
                              key={index}
                              className="w-[2px] rounded-full bg-glow/80"
                              style={{ height: `${Math.round(height * 14)}px` }}
                            />
                          ))}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="relative flex items-center justify-between border-t border-white/10 px-4 py-2.5">
                    <span className="flex items-center gap-1.5 text-[9px] text-mist/40">
                      <ShieldCheck className="h-3 w-3 text-glow/70" />
                      Recording consent on file
                    </span>
                    <span className="font-mono text-[8.5px] uppercase tracking-[0.1em] text-mist/30">
                      candidate booth
                    </span>
                  </div>
                </div>
              </div>

              <div className="absolute -bottom-5 -left-3 hidden w-[250px] rounded-[10px] border border-rule bg-paper p-3 shadow-[0_20px_50px_-24px_rgba(11,16,48,0.45)] sm:block lg:-left-8">
                <div className="flex items-center gap-1.5">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full border border-verified/25 bg-verified-soft">
                    <Check className="h-2.5 w-2.5 text-verified" />
                  </span>
                  <span className="text-[9px] font-medium text-ink">Verified in transcript</span>
                  <span className="ml-auto font-mono text-[8px] text-slate">0:41</span>
                </div>
                <p className="mt-1.5 text-[9.5px] leading-relaxed text-slate">
                  “I&apos;d first say I&apos;m sorry this has taken so long, then check the reference number with
                  them.”
                </p>
                <div className="mt-1.5 flex items-center gap-1 border-t border-rule/80 pt-1.5">
                  <Badge tone="verified">Empathy 4.5</Badge>
                  <span className="font-mono text-[8px] text-slate">quote 3 of 7</span>
                </div>
              </div>

              <div className="absolute -top-4 right-2 hidden items-center gap-1.5 rounded-full border border-rule bg-paper px-2.5 py-1 shadow-sm md:flex">
                <Clock3 className="h-3 w-3 text-slate" />
                <span className="text-[9px] text-slate">Result in 38s</span>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-rule bg-paper">
          <div className="mx-auto flex max-w-[1320px] flex-wrap items-center gap-x-8 gap-y-3 px-4 py-3.5 sm:px-6 lg:px-8">
            <span className="text-[9.5px] font-medium uppercase tracking-[0.1em] text-slate">
              Demo workspace, this week
            </span>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              {[
                ["54", "invites sent"],
                ["37", "interviews completed"],
                ["69%", "completion"],
                ["6", "waiting for review"],
                ["11.5 h", "recruiter time saved"],
              ].map(([value, label]) => (
                <span key={label} className="flex items-baseline gap-1.5">
                  <span className="font-mono text-[11px] tabular text-ink">{value}</span>
                  <span className="text-[9.5px] text-slate">{label}</span>
                </span>
              ))}
            </div>
            <span className="ml-auto hidden text-[9px] text-slate/70 sm:block">
              Sample data, not live candidates.
            </span>
          </div>
        </section>

        <section id="evidence" className="border-b border-rule bg-chalk py-14 sm:py-20">
          <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="max-w-[620px]">
                <p className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-ultramarine">
                  The signature screen
                </p>
                <h2 className="mt-2 font-display text-[34px] font-medium leading-[1.02] tracking-[-0.045em] text-ink sm:text-[46px]">
                  The receipt for every score.
                </h2>
                <p className="mt-3 text-[13px] leading-relaxed text-slate sm:text-[14px]">
                  Every skill score cites a transcript segment. A deterministic verifier checks the quote
                  against the words actually spoken. Quotes that fail are marked unverified and do not
                  support the score.
                </p>
              </div>
              <Link
                href={`/app/roles/${sana.roleId}/candidates/${sana.id}`}
                className="group inline-flex items-center gap-1.5 text-[11.5px] font-medium text-ultramarine"
              >
                Open this candidate in the demo
                <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            </div>

            <div className="mt-7">
              <EvidenceShowcase candidate={sana} />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                {
                  title: "Verified is visual",
                  body: "Filled diamonds are matched quotes. Hollow diamonds failed the check. The difference is never hidden in a tooltip.",
                },
                {
                  title: "Thin evidence is named",
                  body: "A skill without a usable quote is marked insufficient evidence — not scored as a zero.",
                },
                {
                  title: "No chain-of-thought theatre",
                  body: "The trace shows inputs and rule outputs. It does not pretend to reveal a model’s private reasoning.",
                },
              ].map((item) => (
                <div key={item.title} className="border-t border-rule pt-3">
                  <p className="text-[11.5px] font-medium text-ink">{item.title}</p>
                  <p className="mt-1 text-[10.5px] leading-relaxed text-slate">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="desk" className="border-b border-rule bg-paper py-14 sm:py-20">
          <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="max-w-[620px]">
                <p className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-ultramarine">
                  Two rooms, one loop
                </p>
                <h2 className="mt-2 font-display text-[34px] font-medium leading-[1.02] tracking-[-0.045em] text-ink sm:text-[46px]">
                  A quiet desk. A focused booth.
                </h2>
                <p className="mt-3 text-[13px] leading-relaxed text-slate sm:text-[14px]">
                  The recruiter gets a dense, calm workspace built for decisions. The candidate gets a
                  dark, single-purpose booth built for a phone in a noisy room.
                </p>
              </div>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-2">
              <div className="overflow-hidden rounded-[14px] border border-rule bg-chalk">
                <div className="flex items-center justify-between border-b border-rule px-4 py-2.5">
                  <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate">
                    The desk · recruiter
                  </span>
                  <Badge tone="neutral">Light, dense, audited</Badge>
                </div>
                <div className="p-4">
                  <div className="rounded-[8px] border border-rule bg-paper">
                    <div className="flex items-center justify-between border-b border-rule px-3 py-2">
                      <span className="text-[10.5px] font-semibold text-ink">Review queue</span>
                      <span className="font-mono text-[9px] text-slate">6 waiting</span>
                    </div>
                    <div className="divide-y divide-rule/70">
                      {[
                        { name: "Rahul Mehta", reason: "Unverified quote", score: "3.1", tone: "text-flag" },
                        { name: "Neha Kulkarni", reason: "Evidence quality 58%", score: "3.4", tone: "text-flag" },
                        { name: "Karan Thakur", reason: "Below role bar", score: "2.6", tone: "text-onair" },
                      ].map((row) => (
                        <div key={row.name} className="flex items-center gap-2 px-3 py-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full border border-rule bg-white font-mono text-[7px] text-slate">
                            {row.name.split(" ").map((part) => part[0]).join("")}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[10px] font-medium text-ink">{row.name}</span>
                            <span className="block text-[8px] text-slate">{row.reason}</span>
                          </span>
                          <span className={`font-mono text-[9px] ${row.tone}`}>{row.score}</span>
                          <ChevronRight className="h-3 w-3 text-slate/40" />
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between border-t border-rule bg-chalk/50 px-3 py-1.5">
                      <span className="text-[8px] text-slate">J/K move · A shortlist · R reject</span>
                      <span className="font-mono text-[8px] text-slate">78% agreement</span>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {[
                      ["38s", "median result"],
                      ["7/7", "quotes verified"],
                      ["100%", "human-owned"],
                    ].map(([value, label]) => (
                      <div key={label} className="rounded-[6px] border border-rule bg-paper px-2.5 py-2">
                        <p className="font-mono text-[11px] text-ink">{value}</p>
                        <p className="mt-0.5 text-[8px] text-slate">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="booth-theme overflow-hidden rounded-[14px] border border-ink/20 bg-booth">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
                  <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-mist/50">
                    The booth · candidate
                  </span>
                  <span className="flex items-center gap-1.5 font-mono text-[8.5px] uppercase tracking-[0.08em] text-mist/40">
                    <span className="h-1.5 w-1.5 rounded-full bg-glow/70" />
                    phone first
                  </span>
                </div>
                <div className="p-4">
                  <MicWave />
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[6px] border border-white/10 bg-booth-2/70 px-3 py-2">
                    <span className="flex items-center gap-1.5 text-[9px] text-mist/55">
                      <Headphones className="h-3 w-3 text-glow/70" />
                      Works in Hindi, English and Hinglish
                    </span>
                    <Link href="/i/demo" className="text-[9px] font-medium text-glow hover:underline">
                      Open the booth
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="how" className="border-b border-rule bg-chalk py-14 sm:py-20">
          <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8">
            <div className="max-w-[620px]">
              <p className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-ultramarine">
                How it runs
              </p>
              <h2 className="mt-2 font-display text-[34px] font-medium leading-[1.02] tracking-[-0.045em] text-ink sm:text-[46px]">
                From invite to a decision you can defend.
              </h2>
            </div>

            <div className="mt-8 grid gap-px overflow-hidden rounded-[10px] border border-rule bg-rule md:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  step: "01",
                  title: "Send one link",
                  body: "A single-use invite. No account, no app install. The candidate consents before the first question.",
                  icon: Users,
                },
                {
                  step: "02",
                  title: "Run the screen",
                  body: "Vaani asks the playbook questions in the candidate’s language. A mic check runs first; silence is handled kindly.",
                  icon: Headphones,
                },
                {
                  step: "03",
                  title: "Score and verify",
                  body: "Privacy redaction, rubric mapping and deterministic quote verification. Typically under a minute.",
                  icon: Sparkles,
                },
                {
                  step: "04",
                  title: "Decide, then act",
                  body: "The desk shows the evidence. A recruiter shortlists or closes. Any email or calendar write waits for approval.",
                  icon: ShieldCheck,
                },
              ].map((item) => (
                <div key={item.step} className="bg-paper p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-slate/70">{item.step}</span>
                    <item.icon className="h-4 w-4 text-slate/60" strokeWidth={1.7} />
                  </div>
                  <h3 className="mt-3 font-display text-[19px] font-medium leading-tight tracking-[-0.03em] text-ink">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-[10.5px] leading-relaxed text-slate">{item.body}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3 rounded-[8px] border border-rule bg-paper px-4 py-3">
              <FileText className="h-4 w-4 text-slate" />
              <p className="min-w-0 flex-1 text-[10.5px] leading-relaxed text-slate">
                The playbook is markdown, not code. Edit questions and thresholds, compile, replay stored
                scores, then publish a version. Open roles stay pinned until you republish.
              </p>
              <Link href="/app/playbooks/support-exec" className="text-[10.5px] font-medium text-ultramarine">
                Open Playbook Studio
              </Link>
            </div>
          </div>
        </section>

        <section id="trust" className="border-b border-rule bg-paper py-14 sm:py-20">
          <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-12">
              <div>
                <p className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-ultramarine">
                  Guardrails, not slogans
                </p>
                <h2 className="mt-2 font-display text-[34px] font-medium leading-[1.02] tracking-[-0.045em] text-ink sm:text-[46px]">
                  Honest about what the machine cannot prove.
                </h2>
                <p className="mt-3 text-[13px] leading-relaxed text-slate">
                  Quote matching proves the words exist. It does not prove the score is fair, the rubric
                  is perfect or the candidate will succeed. The product is built around that limit.
                </p>
              </div>

              <div className="grid gap-px overflow-hidden rounded-[10px] border border-rule bg-rule sm:grid-cols-2">
                {[
                  {
                    title: "A human owns every outcome",
                    body: "No threshold can close, reject or withdraw a candidate. The router can only suggest and route to review.",
                  },
                  {
                    title: "External writes ask first",
                    body: "Email sends, Meet invites and sheet appends show the exact payload. One approval, one run, full audit.",
                  },
                  {
                    title: "Consent before audio",
                    body: "Recording consent is separate from participation. Saying no keeps the interview available; audio is deleted.",
                  },
                  {
                    title: "Evidence quality is labelled",
                    body: "It is a heuristic from verified quotes, consistency, coverage and transcript quality — never a performance probability.",
                  },
                  {
                    title: "Redaction before scoring",
                    body: "Names, phone numbers and email addresses are removed from scoring input. Revealing contact is a logged action.",
                  },
                  {
                    title: "No silent retries",
                    body: "A blocked connection stops the run and surfaces the error. It does not retry in the background.",
                  },
                ].map((item) => (
                  <div key={item.title} className="bg-paper p-4">
                    <div className="flex items-start gap-2">
                      <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-verified" />
                      <div>
                        <p className="text-[11.5px] font-medium text-ink">{item.title}</p>
                        <p className="mt-1 text-[10.5px] leading-relaxed text-slate">{item.body}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-booth py-14 sm:py-20">
          <div className="booth-theme relative mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8">
            <div className="booth-grid pointer-events-none absolute inset-0 -mx-4 opacity-40 sm:-mx-6 lg:-mx-8" />
            <div className="relative flex flex-wrap items-end justify-between gap-6">
              <div className="max-w-[620px]">
                <p className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-glow/70">
                  For candidates
                </p>
                <h2 className="mt-2 font-display text-[36px] font-medium leading-[1.0] tracking-[-0.045em] text-mist sm:text-[50px]">
                  Your turn. Four minutes, no account.
                </h2>
                <p className="mt-3 max-w-[500px] text-[13px] leading-relaxed text-mist/55">
                  Try the same kind of screen a recruiter would send. You will get a private practice
                  report with one thing to keep and one thing to try. Nothing is sent to an employer.
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  <Button variant="booth" size="lg" asChild>
                    <Link href="/practice">
                      <Mic className="h-4 w-4" />
                      Start a practice interview
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="lg"
                    className="text-mist/70 hover:bg-white/10 hover:text-mist"
                    asChild
                  >
                    <Link href="/i/demo">
                      See the invite flow
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="w-full max-w-[360px] rounded-[12px] border border-white/10 bg-booth-2/80 p-4">
                <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-mist/40">
                  Practice report
                </p>
                <p className="mt-2 font-display text-[24px] font-medium leading-tight tracking-[-0.035em] text-mist">
                  Clear structure. One fixable habit.
                </p>
                <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-mist/55">Clarity</span>
                    <span className="font-mono text-mist">4.2</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-mist/55">Empathy</span>
                    <span className="font-mono text-mist">3.8</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-mist/55">Listening</span>
                    <span className="font-mono text-mist">3.5</span>
                  </div>
                </div>
                <p className="mt-3 text-[9.5px] leading-relaxed text-mist/40">
                  Practice scores are for you. They are not sent to any recruiter.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-rule bg-chalk py-14 sm:py-16">
          <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
            <div>
              <h2 className="font-display text-[30px] font-medium leading-tight tracking-[-0.04em] text-ink sm:text-[38px]">
                Walk the demo like a judge.
              </h2>
              <p className="mt-1.5 max-w-[540px] text-[12.5px] leading-relaxed text-slate">
                One candidate with clean evidence, one with a failed quote, one approval waiting, one
                blocked connection. Each path is labelled and takes under three minutes.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="ink" size="lg" asChild>
                <Link href="/demo">
                  Open the judge guide
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="/api/demo/enter">Enter the workspace</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-paper">
        <div className="mx-auto max-w-[1320px] px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <Logo />
              <p className="mt-2 max-w-[300px] text-[10.5px] leading-relaxed text-slate">
                Voice-first screening with evidence a recruiter can inspect. Built for BPO and staffing
                teams in India.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-x-10 gap-y-2 text-[10.5px] sm:grid-cols-3">
              <Link href="/app" className="text-slate hover:text-ink">Recruiter desk</Link>
              <Link href="/practice" className="text-slate hover:text-ink">Candidate practice</Link>
              <Link href="/demo" className="text-slate hover:text-ink">Demo guide</Link>
              <Link href="/app/playbooks" className="text-slate hover:text-ink">Playbooks</Link>
              <Link href="/app/crew" className="text-slate hover:text-ink">Crew</Link>
              <Link href="/sign-in" className="text-slate hover:text-ink">Sign in</Link>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-rule pt-3 text-[9.5px] text-slate">
            <span>© 2026 Hirevoice · Google Cloud Run asia-south1</span>
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-verified" />
              Demo data is clearly labelled. No candidate is auto-rejected.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
