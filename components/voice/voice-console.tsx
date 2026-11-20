"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowUp,
  AudioLines,
  CalendarPlus,
  ClipboardCheck,
  FileSignature,
  History,
  Loader2,
  Mic,
  Plus,
  ShieldCheck,
  Sparkles,
  Square,
  Users,
  X,
} from "lucide-react";
import type { AgentAction, AgentPlan, AiStatus, Workspace } from "@/lib/types";
import { cn, formatRelative } from "@/lib/utils";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlanView } from "@/components/voice/plan-view";
import { useSpeechRecognition } from "@/components/voice/use-speech";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  plan?: AgentPlan | null;
  error?: string | null;
  pending?: boolean;
  createdAt: string;
};

export function VoiceConsole({ workspace }: { workspace: Workspace }) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyStep, setBusyStep] = useState<string | null>(null);
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const firstName = workspace.user.name.split(" ")[0] || "there";
  const topCandidate = workspace.candidates[0]?.name ?? "Sana Khan";

  useEffect(() => {
    let active = true;
    fetch("/api/ai/status")
      .then((res) => res.json())
      .then((data: AiStatus) => {
        if (active) setStatus(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  const sendMessage = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || busy) return;

      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        text,
        createdAt: new Date().toISOString(),
      };
      const assistantId = `a-${Date.now() + 1}`;
      const pendingMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        text: "",
        pending: true,
        createdAt: new Date().toISOString(),
      };

      setInput("");
      setMessages((prev) => [...prev, userMsg, pendingMsg]);
      setBusy(true);

      try {
        const res = await fetch("/api/agent/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: text }),
        });
        const data = (await res.json()) as { plan?: AgentPlan; error?: string };
        if (!res.ok || !data.plan) {
          throw new Error(data.error ?? "I couldn't plan that request. Try rephrasing it.");
        }
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, pending: false, text: data.plan?.summary ?? "", plan: data.plan }
              : m,
          ),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Something went wrong.";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, pending: false, error: message } : m,
          ),
        );
      } finally {
        setBusy(false);
        inputRef.current?.focus();
      }
    },
    [busy],
  );

  const sendRef = useRef(sendMessage);
  sendRef.current = sendMessage;

  const speech = useSpeechRecognition({
    onFinal: (spoken) => {
      if (spoken.trim()) void sendRef.current(spoken);
    },
  });

  const decideStep = useCallback(
    async (actionId: string, decision: "approve" | "reject") => {
      setBusyStep(actionId);
      try {
        const res = await fetch("/api/agent/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actionId, decision }),
        });
        const data = (await res.json()) as { action?: AgentAction; error?: string };
        if (!res.ok || !data.action) {
          throw new Error(data.error ?? "Action could not be completed.");
        }
        const updated = data.action;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.plan
              ? {
                  ...msg,
                  plan: {
                    ...msg.plan,
                    steps: msg.plan.steps.map((s) => (s.id === updated.id ? updated : s)),
                  },
                }
              : msg,
          ),
        );
        if (decision === "reject") {
          toast("Action cancelled", { description: "Nothing external was sent." });
        } else if (updated.status === "failed") {
          toast.error(updated.error ?? "Action failed");
        } else {
          toast.success(updated.result?.title ?? "Done", {
            description: updated.result?.detail,
          });
        }
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Action failed");
      } finally {
        setBusyStep(null);
      }
    },
    [router],
  );

  const starters = [
    {
      icon: ClipboardCheck,
      title: "Who needs my review?",
      prompt: "Who needs my review right now?",
      sub: "Inspect flagged quotes & pending decisions",
    },
    {
      icon: CalendarPlus,
      title: `Schedule ${topCandidate.split(" ")[0]}`,
      prompt: `Schedule ${topCandidate} tomorrow at 3 PM with Meet`,
      sub: "Checks availability & previews a Meet invite",
    },
    {
      icon: Users,
      title: "Pipeline snapshot",
      prompt: "Show pipeline summary",
      sub: "See stage counts & top verified candidates",
    },
    {
      icon: FileSignature,
      title: "Draft an offer letter",
      prompt: `Generate offer letter for ${topCandidate} at ₹28,000/month`,
      sub: "Prepares a formatted offer doc for approval",
    },
  ];

  const recentActions = workspace.agentActions.slice(0, 12);

  return (
    <div className="relative flex h-[calc(100dvh-48px)] flex-col bg-chalk">
      {/* Minimal Top Bar */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-rule bg-paper/90 px-4 backdrop-blur-sm sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-glow">
            <AudioLines className="h-3.5 w-3.5" />
          </span>
          <span className="font-display text-[15px] font-medium tracking-[-0.02em] text-ink">
            Vaani
          </span>
          <Badge tone={status?.configured ? "verified" : "neutral"} dot>
            {status?.configured ? "Gemini live" : "Local parser"}
          </Badge>
        </div>

        <div className="flex items-center gap-1.5">
          {messages.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setMessages([]);
                setInput("");
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              New chat
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setHistoryOpen((v) => !v)}
          >
            <History className="h-3.5 w-3.5" />
            Activity
            {recentActions.length > 0 ? (
              <span className="ml-0.5 rounded bg-chalk px-1 font-mono text-[9.5px] text-slate">
                {recentActions.length}
              </span>
            ) : null}
          </Button>
        </div>
      </div>

      {/* Scrollable Chat Thread */}
      <div className="flex-1 overflow-y-auto px-4 py-6 scroll-thin sm:px-6">
        <div className="mx-auto flex min-h-full max-w-[780px] flex-col">
          {messages.length === 0 ? (
            <div className="my-auto py-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-ink/10 bg-ink text-glow shadow-sm">
                <Sparkles className="h-5 w-5" />
              </div>
              <h1 className="mt-4 font-display text-[28px] font-medium leading-tight tracking-[-0.035em] text-ink sm:text-[34px]">
                How can I help with hiring today, {firstName}?
              </h1>
              <p className="mx-auto mt-2 max-w-[480px] text-[13px] leading-relaxed text-slate">
                Ask by voice or text. I can review candidates, schedule Google Meet rounds, clean sheets, or draft offers — and I always ask before sending anything.
              </p>

              <div className="mt-7 grid gap-2.5 text-left sm:grid-cols-2">
                {starters.map((item) => (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => void sendMessage(item.prompt)}
                    className="group flex items-start gap-3 rounded-[12px] border border-rule bg-paper p-3.5 transition hover:border-ultramarine/45 hover:bg-white hover:shadow-sm"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border border-rule bg-chalk/70 text-ink transition group-hover:border-ultramarine/30 group-hover:bg-ultramarine-soft group-hover:text-ultramarine">
                      <item.icon className="h-4 w-4" strokeWidth={1.7} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-ink">{item.title}</p>
                      <p className="mt-0.5 text-[11px] leading-snug text-slate">{item.sub}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-5 pb-4">
              {messages.map((msg) =>
                msg.role === "user" ? (
                  <div key={msg.id} className="flex justify-end">
                    <div className="max-w-[82%] rounded-[18px] rounded-br-[4px] bg-ink px-4 py-2.5 text-[13.5px] leading-relaxed text-chalk shadow-sm">
                      {msg.text}
                    </div>
                  </div>
                ) : (
                  <div key={msg.id} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-rule bg-paper text-ultramarine">
                      <Sparkles className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      {msg.pending ? (
                        <div className="inline-flex items-center gap-2 rounded-[14px] border border-rule bg-paper px-4 py-3 text-[12.5px] text-slate">
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-ultramarine" />
                          Thinking & checking workspace…
                        </div>
                      ) : msg.error ? (
                        <div className="rounded-[14px] border border-onair/30 bg-onair-soft/50 px-4 py-3 text-[12.5px] text-[#a61c3a]">
                          {msg.error}
                        </div>
                      ) : msg.plan ? (
                        <div className="overflow-hidden rounded-[14px] border border-rule bg-paper shadow-xs">
                          <PlanView
                            plan={msg.plan}
                            busyStep={busyStep}
                            onDecide={decideStep}
                          />
                        </div>
                      ) : (
                        <div className="rounded-[14px] border border-rule bg-paper px-4 py-3 text-[13px] text-ink">
                          {msg.text}
                        </div>
                      )}
                    </div>
                  </div>
                ),
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>
      </div>

      {/* Sticky ChatGPT / Claude / Gemini Style Bottom Composer */}
      <div className="shrink-0 border-t border-rule bg-chalk/95 px-4 pb-3.5 pt-2.5 backdrop-blur-sm sm:px-6">
        <div className="mx-auto max-w-[780px]">
          {speech.listening ? (
            <div className="mb-2 flex items-center justify-between rounded-[10px] border border-onair/30 bg-onair-soft/50 px-3 py-2 text-[11.5px] text-ink">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 animate-onair rounded-full bg-onair" />
                <span className="font-medium">
                  {speech.interim ? `“${speech.interim}…”` : "Listening… speak naturally, then pause."}
                </span>
              </span>
              <button
                type="button"
                onClick={() => speech.stop()}
                className="text-[10.5px] font-medium text-[#a61c3a] hover:underline"
              >
                Stop
              </button>
            </div>
          ) : null}

          {speech.error ? (
            <p className="mb-1.5 text-[11px] text-[#a61c3a]">{speech.error}</p>
          ) : null}

          <div className="flex items-end gap-2 rounded-[22px] border border-rule bg-white p-2 shadow-sm transition focus-within:border-ink/40 focus-within:shadow-md">
            <button
              type="button"
              onClick={() => (speech.listening ? speech.stop() : speech.start())}
              aria-label={speech.listening ? "Stop voice input" : "Speak to Vaani"}
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition",
                speech.listening
                  ? "animate-pulse bg-onair text-white"
                  : "bg-chalk text-ink hover:bg-ultramarine-soft hover:text-ultramarine",
              )}
            >
              {speech.listening ? (
                <Square className="h-3.5 w-3.5 fill-current" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </button>

            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage(input);
                }
              }}
              placeholder="Message Vaani… (e.g. “Schedule Sana tomorrow at 3 PM with Meet”)"
              className="max-h-32 min-h-[36px] flex-1 resize-none bg-transparent py-2 text-[13.5px] leading-snug text-ink outline-none placeholder:text-slate/65"
            />

            <button
              type="button"
              onClick={() => void sendMessage(input)}
              disabled={busy || !input.trim()}
              aria-label="Send message"
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition",
                input.trim() && !busy
                  ? "bg-ink text-chalk hover:bg-[#1b2942]"
                  : "bg-chalk text-slate/45",
              )}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4" strokeWidth={2.2} />
              )}
            </button>
          </div>

          <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-[10px] text-slate/75">
            <ShieldCheck className="h-3 w-3 text-verified" />
            Vaani previews every email, calendar invite, and stage move before running. AI never rejects a candidate.
          </p>
        </div>
      </div>

      {/* Optional Slide-Over Activity Drawer */}
      {historyOpen ? (
        <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[360px] flex-col border-l border-rule bg-paper shadow-2xl">
          <div className="flex h-12 items-center justify-between border-b border-rule px-4">
            <span className="text-[12.5px] font-semibold text-ink">Recent Vaani Activity</span>
            <Button variant="ghost" size="icon" onClick={() => setHistoryOpen(false)} aria-label="Close activity">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto scroll-thin">
            {recentActions.length > 0 ? (
              <ul className="divide-y divide-rule">
                {recentActions.map((action) => (
                  <li key={action.id} className="flex items-start gap-2.5 px-4 py-3">
                    <StatusDot
                      status={
                        action.status === "executed"
                          ? "connected"
                          : action.status === "failed"
                            ? "error"
                            : action.status === "proposed"
                              ? "waiting"
                              : "idle"
                      }
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-medium text-ink">{action.summary}</p>
                      <p className="mt-0.5 text-[10px] text-slate">
                        {formatRelative(action.updatedAt)} · <span className="font-mono">{action.tool}</span>
                      </p>
                    </div>
                    <Badge tone={action.status === "executed" ? "verified" : action.status === "proposed" ? "flag" : "neutral"}>
                      {action.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-10 text-center text-[12px] text-slate">
                No actions logged yet.
              </p>
            )}
          </div>
          <div className="border-t border-rule p-3">
            <Button variant="outline" size="sm" className="w-full" asChild>
              <Link href="/app/crew?tab=runs">Open full audit log</Link>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
