import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Clock3,
  FileText,
  Headphones,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { getLiveCandidate } from "@/lib/db/repo";
import { formatDuration, formatTime, languageLabel } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Your interview report",
  robots: { index: false, follow: false },
};

export default async function ReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const realCandidate = await getLiveCandidate(token);
  const isDemo = token === "demo" || !realCandidate;
  const highlights = realCandidate
    ? realCandidate.score.items
        .flatMap((item) =>
          item.evidence
            .filter((ev) => ev.verified)
            .map((ev) => ({
              skill: item.label,
              quote: ev.quote,
              time: formatTime(ev.tStartMs),
              note: item.reasoning,
            })),
        )
        .slice(0, 4)
    : [
        {
          skill: "Empathy",
          quote: "I'd first say I'm sorry this has taken so long, then check the reference number with them.",
          time: "0:41",
          note: "You named the customer's frustration before moving to a fix.",
        },
        {
          skill: "Clarity",
          quote: "So there are two things I can do: check where the refund is, and tell you exactly when it will land.",
          time: "1:12",
          note: "You made the next step easy to follow.",
        },
        {
          skill: "Problem solving",
          quote: "If the refund is stuck, I would raise it with the payments team and call you back today.",
          time: "2:05",
          note: "You offered a concrete action and a time.",
        },
      ];

  return (
    <div className="min-h-dvh bg-chalk">
      <header className="border-b border-rule bg-paper">
        <div className="mx-auto flex h-14 max-w-[760px] items-center justify-between px-4 sm:px-6">
          <Logo />
          <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.08em] text-slate">
            <Lock className="h-3 w-3" />
            Private link
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-[760px] px-4 py-8 sm:px-6 sm:py-12">
        <div className="flex items-center gap-2">
          <Badge tone="verified" dot>Interview complete</Badge>
          <span className="font-mono text-[9px] text-slate">Ref {token.toUpperCase()}</span>
          {isDemo ? <Badge tone="flag">Demo report</Badge> : null}
        </div>

        <h1 className="mt-4 font-display text-[38px] font-medium leading-[1.0] tracking-[-0.045em] text-ink sm:text-[48px]">
          Your interview summary.
        </h1>
        <p className="mt-3 max-w-[560px] text-[13px] leading-relaxed text-slate">
          Thank you for speaking with us for the Customer Support Executive role at Northstar BPO. This
          page is yours. It explains what happened next and what the team heard.
        </p>

        <section className="mt-6 overflow-hidden rounded-[10px] border border-rule bg-paper">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-4 py-3">
            <div>
              <p className="text-[10px] text-slate">Next step</p>
              <p className="mt-0.5 text-[13px] font-medium text-ink">A 30-minute conversation with the team</p>
            </div>
            <Badge tone="ultra" dot>Friday · 3:00 PM IST</Badge>
          </div>
          <div className="grid gap-0 divide-y divide-rule sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {[
              { icon: Clock3, label: "Format", value: "Google Meet" },
              { icon: Headphones, label: "With", value: "Meera R." },
              { icon: Mail, label: "Link", value: "Sent by email" },
            ].map((item) => (
              <div key={item.label} className="px-4 py-3">
                <item.icon className="h-3.5 w-3.5 text-slate" />
                <p className="mt-1.5 text-[9px] text-slate">{item.label}</p>
                <p className="mt-0.5 text-[11px] text-ink">{item.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-4 rounded-[10px] border border-rule bg-paper p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[13px] font-semibold text-ink">What the team heard</h2>
            <span className="font-mono text-[9px] text-slate">
              {realCandidate
                ? `${formatDuration(realCandidate.durationMs)} · ${languageLabel(realCandidate.language)}`
                : "4 min · English"}
            </span>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-slate">
            {realCandidate
              ? realCandidate.score.summary
              : "A person reviewed the transcript. These are the moments that stood out, with the exact words you used."}
          </p>

          <div className="mt-4 space-y-2.5">
            {highlights.map((item, idx) => (
              <div key={`${item.time}-${idx}`} className="rounded-[7px] border border-rule bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge tone="verified">{item.skill}</Badge>
                  <span className="font-mono text-[9px] text-slate">{item.time}</span>
                </div>
                <blockquote className="mt-2 text-[12px] leading-relaxed text-ink">“{item.quote}”</blockquote>
                <p className="mt-1.5 border-t border-rule/70 pt-1.5 text-[10px] text-slate">{item.note}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-[10px] border border-verified/25 bg-verified-soft/40 p-4">
            <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.06em] text-[#0a7f51]">
              <Check className="h-3 w-3" />
              Keep doing this
            </p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-ink">
              You slow down when the customer is upset. That is the hardest part of the job and it came
              through clearly.
            </p>
          </div>
          <div className="rounded-[10px] border border-flag/30 bg-flag-soft/40 p-4">
            <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.06em] text-[#6c5200]">
              <Sparkles className="h-3 w-3" />
              One thing to practise
            </p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-ink">
              When a question has two parts, answer both before adding detail. It keeps the answer easy to
              follow on a phone line.
            </p>
          </div>
        </section>

        <section className="mt-4 rounded-[10px] border border-rule bg-paper p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-verified" />
            <h2 className="text-[12px] font-semibold text-ink">What happens now</h2>
          </div>
          <ol className="mt-3 space-y-2">
            {[
              "The team makes a human decision. A score does not reject you on its own.",
              "If they need more evidence, they review the transcript before deciding.",
              "You will get an email within one working day, whatever the outcome.",
              "You can ask for a copy of your data or ask us to delete it.",
            ].map((item, index) => (
              <li key={item} className="flex gap-2.5 text-[10.5px] leading-relaxed text-slate">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-rule bg-white font-mono text-[8px] text-slate">
                  {index + 1}
                </span>
                {item}
              </li>
            ))}
          </ol>
          <div className="mt-3 flex flex-wrap gap-2 border-t border-rule pt-3">
            <Button variant="outline" size="sm" asChild>
              <Link href="/practice">
                <Headphones className="h-3.5 w-3.5" />
                Try a practice interview
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/">
                Back to Hirevoice
              </Link>
            </Button>
          </div>
        </section>

        <details className="mt-4 rounded-[8px] border border-rule bg-paper px-4 py-3">
          <summary className="flex cursor-pointer items-center gap-2 text-[10.5px] font-medium text-slate">
            <FileText className="h-3.5 w-3.5" />
            Transcript and data request
          </summary>
          <p className="mt-2 text-[10px] leading-relaxed text-slate">
            The full transcript is available on request. Audio is deleted after 14 days when recording
            consent was given. To request a copy or deletion, reply to the email that brought you here and
            quote reference {token.toUpperCase()}.
          </p>
        </details>

        <p className="mt-5 flex items-start gap-1.5 text-[9px] leading-relaxed text-slate">
          <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-verified" />
          This report is generated from the transcript and reviewed by a recruiter. It is not an automated
          rejection. {isDemo ? "This is a seeded demo report; the candidate is fictional." : ""}
        </p>

        <div className="mt-6 border-t border-rule pt-4">
          <Link href="/" className="inline-flex items-center gap-1 text-[10.5px] text-slate hover:text-ink">
            Hirevoice
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </main>
    </div>
  );
}
