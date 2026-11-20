"use client";

import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  CalendarPlus,
  CheckCircle2,
  ClipboardCheck,
  CornerDownLeft,
  FileSignature,
  Loader2,
  Mic,
  ShieldCheck,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/panel";
import { PlanView } from "@/components/voice/plan-view";
import { useSpeechRecognition } from "@/components/voice/use-speech";
import { useVoiceAgent } from "@/components/voice/use-voice-agent";

const commandGroups = [
  {
    label: "Review & Pipeline",
    icon: ClipboardCheck,
    items: [
      "Who needs my review right now?",
      "Show pipeline summary",
      "Find Sana Khan's verified quotes",
    ],
  },
  {
    label: "Schedule & Shortlist",
    icon: CalendarPlus,
    items: [
      "Schedule Sana tomorrow at 3 PM with Meet",
      "Check my free calendar slots tomorrow",
      "Shortlist Sana Khan",
    ],
  },
  {
    label: "Offers & Workspace",
    icon: FileSignature,
    items: [
      "Generate offer letter for Sana at ₹28,000/month",
      "Create application form for Customer Support",
      "Clean messy data in my Tele Caller sheet",
    ],
  },
];

export function VoiceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const agent = useVoiceAgent();
  const [command, setCommand] = useState("");
  const [live, setLive] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const runRef = useRef(agent.run);
  runRef.current = agent.run;

  const submit = (text: string) => {
    const value = text.trim();
    if (!value || agent.busy) return;
    setCommand(value);
    void agent.run(value);
  };

  const onSpeechFinal = (text: string) => {
    setCommand(text);
    setLive(false);
    void runRef.current(text);
  };

  const speechRef = useRef(onSpeechFinal);
  speechRef.current = onSpeechFinal;

  const recognition = useSpeechRecognition({
    onFinal: (text) => speechRef.current(text),
  });

  useEffect(() => {
    if (!open) {
      recognition.stop();
      setLive(false);
    } else {
      const timer = window.setTimeout(() => inputRef.current?.focus(), 80);
      return () => window.clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const listening = live && recognition.listening;

  const toggleListening = () => {
    if (listening) {
      recognition.stop();
      setLive(false);
      return;
    }
    setLive(true);
    const started = recognition.start();
    if (!started) setLive(false);
  };

  const hasPendingApproval = Boolean(
    agent.plan?.steps.some((s) => s.mutating && s.status === "proposed"),
  );
  const allExecuted = Boolean(
    agent.plan && agent.plan.steps.length > 0 && agent.plan.steps.every((s) => s.status === "executed"),
  );
  const activeStep = allExecuted
    ? 4
    : hasPendingApproval
      ? 3
      : agent.busy
        ? 2
        : listening
          ? 1
          : agent.plan
            ? 2
            : 0;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-[3px]" />
        <Dialog.Content
          className="fixed left-1/2 top-[6%] z-50 flex max-h-[88dvh] w-[min(740px,calc(100vw-20px))] -translate-x-1/2 flex-col overflow-hidden rounded-[18px] border border-rule bg-paper shadow-[0_30px_100px_-20px_rgba(11,16,48,0.55)]"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <Dialog.Title className="sr-only">Ask Vaani recruiter voice assistant</Dialog.Title>

          {/* Header */}
          <div className="flex items-center gap-2.5 border-b border-white/10 bg-ink px-4 py-3 text-chalk">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-glow/15 text-glow">
              <Mic className="h-3.5 w-3.5" strokeWidth={2} />
            </span>
            <div>
              <p className="font-display text-[14px] font-medium leading-none tracking-[-0.02em]">
                Ask Vaani
              </p>
              <p className="mt-0.5 text-[10px] text-mist/55">
                Recruiter copilot · reads run instantly, writes wait for approval
              </p>
            </div>
            <span className="ml-auto hidden items-center gap-1 text-[10px] text-mist/50 sm:flex">
              <Kbd>⌘</Kbd>
              <Kbd>J</Kbd>
            </span>
            <Dialog.Close asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-mist hover:bg-white/10 hover:text-white"
                aria-label="Close Vaani"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </Dialog.Close>
          </div>

          {/* Clear 4-Step Workflow Indicator */}
          <div className="flex items-center justify-between gap-2 border-b border-rule bg-chalk/60 px-4 py-2 text-[10px]">
            {[
              { n: 1, label: "Speak or type" },
              { n: 2, label: "Plan & check" },
              { n: 3, label: "Approve write" },
              { n: 4, label: "Done" },
            ].map((step) => {
              const done = activeStep > step.n || (step.n === 4 && activeStep === 4);
              const current = activeStep === step.n;
              return (
                <div
                  key={step.n}
                  className={cn(
                    "flex items-center gap-1.5 font-medium",
                    done ? "text-verified" : current ? "text-ultramarine" : "text-slate/60",
                  )}
                >
                  {done ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <span
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded-full font-mono text-[9px]",
                        current ? "bg-ultramarine text-white" : "border border-rule bg-white text-slate",
                      )}
                    >
                      {step.n}
                    </span>
                  )}
                  <span className="hidden sm:inline">{step.label}</span>
                </div>
              );
            })}
          </div>

          {/* Input + Big Push-to-Talk Mic */}
          <div className="border-b border-rule bg-white px-4 py-3.5">
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={toggleListening}
                aria-label={listening ? "Stop listening" : "Start speaking"}
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border shadow-sm transition",
                  listening
                    ? "animate-pulse border-onair bg-onair text-white"
                    : "border-ultramarine/30 bg-ultramarine text-white hover:bg-[#2638d8]",
                )}
              >
                {listening ? <Square className="h-4 w-4 fill-current" /> : <Mic className="h-4.5 w-4.5" />}
              </button>

              <div className="min-w-0 flex-1">
                <textarea
                  ref={inputRef}
                  value={listening && recognition.interim ? recognition.interim : command}
                  onChange={(event) => setCommand(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      submit(command);
                    }
                  }}
                  rows={2}
                  placeholder='Click the mic or type: "Schedule Sana tomorrow at 3 PM with Meet"'
                  className="w-full resize-none bg-transparent text-[13.5px] leading-relaxed text-ink outline-none placeholder:text-slate/60"
                />
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px]">
                  {listening ? (
                    <span className="flex items-center gap-1.5 font-medium text-onair">
                      <span className="h-1.5 w-1.5 animate-onair rounded-full bg-onair" />
                      Listening live… speak clearly, then pause or click Stop.
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-slate/75">
                      <ShieldCheck className="h-3 w-3 text-verified" />
                      AI never auto-rejects or sends emails without your click.
                    </span>
                  )}
                  {recognition.error ? (
                    <span className="text-[#b51d3c]">{recognition.error}</span>
                  ) : null}
                </div>
              </div>

              <Button
                variant="ink"
                size="md"
                className="shrink-0"
                onClick={() => submit(command)}
                disabled={agent.busy || !command.trim()}
              >
                {agent.busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CornerDownLeft className="h-3.5 w-3.5" />}
                Run
              </Button>
            </div>
          </div>

          {/* Plan Output OR Categorized Recruiter Quick Actions */}
          <div className="min-h-[260px] flex-1 overflow-y-auto scroll-thin">
            {agent.plan || agent.busy ? (
              <div>
                {agent.plan ? (
                  <div className="flex items-center justify-between border-b border-rule bg-chalk/40 px-4 py-2">
                    <span className="flex items-center gap-1.5 text-[11px] font-medium text-ink">
                      <Sparkles className="h-3.5 w-3.5 text-ultramarine" />
                      {agent.plan.intent}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        agent.clear();
                        setCommand("");
                      }}
                      className="text-[10.5px] font-medium text-slate hover:text-ink"
                    >
                      New command
                    </button>
                  </div>
                ) : null}
                <PlanView plan={agent.plan} busyStep={agent.busyStep} onDecide={agent.decide} />
              </div>
            ) : (
              <div className="grid gap-3 p-4 sm:grid-cols-3">
                {commandGroups.map((group) => (
                  <div key={group.label} className="rounded-[10px] border border-rule bg-chalk/45 p-3">
                    <p className="flex items-center gap-1.5 text-[10.5px] font-semibold text-ink">
                      <group.icon className="h-3.5 w-3.5 text-ultramarine" />
                      {group.label}
                    </p>
                    <div className="mt-2 space-y-1.5">
                      {group.items.map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => {
                            setCommand(item);
                            submit(item);
                          }}
                          className="block w-full rounded-[6px] border border-rule bg-white px-2.5 py-1.5 text-left text-[11px] leading-snug text-ink transition hover:border-ultramarine/40 hover:bg-ultramarine-soft/30"
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
