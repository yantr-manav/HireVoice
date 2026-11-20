import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CircleAlert,
  ClipboardCheck,
  Cpu,
  FileText,
  Headphones,
  Mic,
  Play,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";

export const metadata: Metadata = {
  title: "Demo guide",
  description: "A three-minute path through the Hirevoice demo for judges and pilot teams.",
  robots: { index: false, follow: false },
};

const path = [
  {
    step: "01",
    title: "Open Sana's evidence",
    time: "45 seconds",
    body: "A clean shortlist: 4.4 overall, seven of seven quotes verified. Click any quote to jump to the transcript moment. Then open the run trace and read what the verifier does not prove.",
    href: "/app/roles/role-support/candidates/cand-sana",
    cta: "Open Sana",
    icon: ClipboardCheck,
  },
  {
    step: "02",
    title: "Find the failed quote",
    time: "40 seconds",
    body: "Rahul's evidence is thin and one quote does not appear in the transcript. The quote is marked unverified and does not count toward the score. The result is human review, not rejection.",
    href: "/app/roles/role-support/candidates/cand-rahul",
    cta: "Open Rahul",
    icon: CircleAlert,
  },
  {
    step: "03",
    title: "Speak one command, approve one write",
    time: "40 seconds",
    body: "Open the voice desk and say or type \"Schedule Sana tomorrow at 3 with Meet\". Vaani turns it into a plan; the read steps run, the calendar write waits. Approve once, then find the record under Crew → Agent actions. Nothing sends without this gate.",
    href: "/app/voice",
    cta: "Open voice desk",
    icon: Cpu,
  },
  {
    step: "04",
    title: "Break the rule, not the candidate",
    time: "45 seconds",
    body: "In Playbook Studio, raise the shortlist threshold and simulate. Stored scores are replayed through the new rule. No model call, no candidate contact, no automatic rejection.",
    href: "/app/playbooks/support-exec",
    cta: "Open Studio",
    icon: FileText,
  },
  {
    step: "05",
    title: "Try the booth on your phone",
    time: "2 minutes",
    body: "Open the candidate invite or practice link. Consent comes before audio, the mic check is separate, and the practice report is private. This prototype transcribes in the browser where supported.",
    href: "/i/demo",
    cta: "Open the booth",
    icon: Headphones,
  },
];

export default function DemoGuidePage() {
  return (
    <div className="min-h-dvh bg-chalk">
      <header className="sticky top-0 z-40 border-b border-rule bg-chalk/92 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1100px] items-center gap-3 px-4 sm:px-6">
          <Logo />
          <Badge tone="flag" className="hidden sm:inline-flex">Demo guide</Badge>
          <div className="ml-auto flex items-center gap-1.5">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/">Product</Link>
            </Button>
            <Button variant="ink" size="sm" asChild>
              <Link href="/api/demo/enter">
                Enter workspace
                <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-rule bg-ink">
          <div className="rule-grid pointer-events-none absolute inset-0 opacity-[0.07]" />
          <div className="relative mx-auto max-w-[1100px] px-4 py-12 sm:px-6 sm:py-16">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="booth">Buildathon demo</Badge>
              <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-mist/40">
                3 minutes · no account
              </span>
            </div>
            <h1 className="mt-4 max-w-[760px] font-display text-[42px] font-medium leading-[0.98] tracking-[-0.05em] text-mist sm:text-[58px]">
              Judge the evidence, not the pitch.
            </h1>
            <p className="mt-4 max-w-[620px] text-[13px] leading-relaxed text-mist/55 sm:text-[14px]">
              The demo is seeded with twelve candidates, real transcript structures, one failed quote, one
              pending approval and one broken connection. Every path is labelled. Follow the five stops
              below and try to find a place where the product overclaims.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-2.5">
              <Button variant="booth" size="lg" asChild>
                <Link href="/api/demo/enter">
                  <Play className="h-3.5 w-3.5 fill-current" />
                  Enter the demo workspace
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="lg"
                className="text-mist/65 hover:bg-white/10 hover:text-mist"
                asChild
              >
                <Link href="/app/roles/role-support/candidates/cand-sana">
                  Start at Sana
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="mt-8 grid gap-px overflow-hidden rounded-[8px] border border-white/10 bg-white/10 sm:grid-cols-4">
              {[
                ["4.4", "Sana · 7/7 verified"],
                ["3.1", "Rahul · 1 failed quote"],
                ["3", "actions waiting"],
                ["1", "blocked connection"],
              ].map(([value, label]) => (
                <div key={label} className="bg-ink px-3 py-2.5">
                  <p className="font-mono text-[15px] text-mist">{value}</p>
                  <p className="mt-0.5 text-[8.5px] text-mist/35">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-rule bg-paper py-10 sm:py-14">
          <div className="mx-auto max-w-[1100px] px-4 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-ultramarine">
                  The path
                </p>
                <h2 className="mt-1.5 font-display text-[28px] font-medium tracking-[-0.04em] text-ink sm:text-[34px]">
                  Five stops, in order.
                </h2>
              </div>
              <span className="text-[10px] text-slate">Total about three minutes</span>
            </div>

            <ol className="mt-6 space-y-2.5">
              {path.map((item) => (
                <li
                  key={item.step}
                  className="flex flex-wrap items-start gap-3 rounded-[8px] border border-rule bg-white p-3.5 transition hover:border-slate/40"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] border border-rule bg-chalk/60 font-mono text-[10px] text-slate">
                    {item.step}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[12.5px] font-medium text-ink">{item.title}</h3>
                      <span className="font-mono text-[8.5px] uppercase tracking-[0.06em] text-slate/70">
                        {item.time}
                      </span>
                    </div>
                    <p className="mt-1 max-w-[720px] text-[10.5px] leading-relaxed text-slate">{item.body}</p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={item.href}>
                      {item.cta}
                      <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  </Button>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-b border-rule bg-chalk py-10 sm:py-14">
          <div className="mx-auto grid max-w-[1100px] gap-6 px-4 sm:px-6 lg:grid-cols-2">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-ultramarine">
                What to judge
              </p>
              <h2 className="mt-1.5 font-display text-[28px] font-medium tracking-[-0.04em] text-ink sm:text-[34px]">
                Four claims, each testable.
              </h2>
              <div className="mt-4 space-y-2.5">
                {[
                  {
                    title: "Evidence is inspectable",
                    body: "Every score opens a quote and a timestamp. Verified and unverified look different. Missing evidence is not scored as zero.",
                  },
                  {
                    title: "The human keeps the pen",
                    body: "Try to find an automatic rejection. There is none. Every external write shows the payload first.",
                  },
                  {
                    title: "The candidate is treated well",
                    body: "Consent is separate from participation. The booth works on a phone, in two languages, with a mic check and a pause.",
                  },
                  {
                    title: "The product is honest",
                    body: "The copy names limits: quote matching is not fairness, evidence quality is not job performance, and the prototype's voice path is labelled.",
                  },
                ].map((item) => (
                  <div key={item.title} className="rounded-[7px] border border-rule bg-paper p-3">
                    <p className="flex items-center gap-1.5 text-[11px] font-medium text-ink">
                      <Check className="h-3 w-3 text-verified" />
                      {item.title}
                    </p>
                    <p className="mt-1 text-[10px] leading-relaxed text-slate">{item.body}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-onair">
                Known limits
              </p>
              <h2 className="mt-1.5 font-display text-[28px] font-medium tracking-[-0.04em] text-ink sm:text-[34px]">
                What this build is not.
              </h2>
              <div className="mt-4 rounded-[8px] border border-onair/20 bg-onair-soft/35 p-4">
                <ul className="space-y-2.5">
                  {[
                    "The candidate booth is a working prototype. Questions are fixed and browser transcription is used where supported. It is not yet connected to Gemini Live for the public demo.",
                    "Workspace data is seeded. Supabase auth is wired; the demo workspace uses a signed demo cookie so judges do not need credentials. Recruiter decisions and agent actions persist in a local SQLite database.",
                    "Gmail and Calendar are real Google APIs, not mocks, once a Google OAuth client is added and an account is connected. Without credentials the same screens show clearly labelled demo mail and demo events; no send, invite or Meet link is faked.",
                    "Voice commands work through the browser's speech recognition, or by typing. Gemini and Gemma keys are optional: with no keys, command planning uses a deterministic local parser and drafts use built-in templates.",
                    "Nothing is deployed to production yet in this build. Cloud Run configuration is included for asia-south1.",
                    "Scoring and quote verification are represented by the seeded data model; the live scoring pipeline is the next engineering step.",
                    "No claim of zero bias, zero hallucination or perfect fairness is made anywhere in the product.",
                  ].map((limit) => (
                    <li key={limit} className="flex gap-2 text-[10.5px] leading-relaxed text-slate">
                      <CircleAlert className="mt-0.5 h-3 w-3 shrink-0 text-onair/70" />
                      {limit}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-3 flex items-start gap-2 rounded-[8px] border border-verified/25 bg-verified-soft/50 p-3">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-verified" />
                <p className="text-[10px] leading-relaxed text-[#0a7f51]">
                  The seeded candidates are fictional. The demo is safe to click through; no email, calendar
                  event or candidate record leaves the app.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-paper py-10 sm:py-12">
          <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-4 px-4 sm:px-6">
            <div>
              <h2 className="font-display text-[26px] font-medium tracking-[-0.04em] text-ink">
                Two more paths worth trying.
              </h2>
              <p className="mt-1 text-[11px] text-slate">
                The candidate booth and the practice flow are separate from the recruiter login.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="md" asChild>
                <Link href="/i/demo">
                  <Mic className="h-3.5 w-3.5" />
                  Candidate invite
                </Link>
              </Button>
              <Button variant="outline" size="md" asChild>
                <Link href="/practice">
                  <Headphones className="h-3.5 w-3.5" />
                  Practice interview
                </Link>
              </Button>
              <Button variant="ink" size="md" asChild>
                <Link href="/app/analytics">
                  <Sparkles className="h-3.5 w-3.5" />
                  Analytics
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-rule bg-chalk">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-2 px-4 py-4 text-[9.5px] text-slate sm:px-6">
          <span>Hirevoice · demo guide</span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3 text-verified" />
            Human decisions only. Sample data labelled throughout.
          </span>
        </div>
      </footer>
    </div>
  );
}
