"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Archive,
  ChevronRight,
  Inbox,
  Loader2,
  Mail,
  MailOpen,
  PenLine,
  Plug,
  Reply,
  Search,
  Send,
  Sparkles,
  Star,
  Trash2,
  X,
} from "lucide-react";
import type { GoogleConnection, MailMessage, Workspace } from "@/lib/types";
import { cn, formatRelative } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { RichText } from "@/components/ui/rich-text";

type MailResponse = {
  connection: GoogleConnection;
  source: "gmail" | "demo";
  messages: MailMessage[];
  warning: string | null;
};

type Filter = "all" | "unread" | "starred";

type ComposeState = {
  open: boolean;
  to: string;
  subject: string;
  body: string;
  threadId?: string;
  candidateId?: string;
  purpose: "general" | "invite" | "schedule" | "feedback" | "followup";
};

const emptyCompose: ComposeState = {
  open: false,
  to: "",
  subject: "",
  body: "",
  purpose: "general",
};

const purposes: { id: ComposeState["purpose"]; label: string }[] = [
  { id: "general", label: "General" },
  { id: "invite", label: "Interview invite" },
  { id: "schedule", label: "Offer times" },
  { id: "feedback", label: "Feedback" },
  { id: "followup", label: "Follow-up" },
];

export function MailConsole({
  workspace,
  initialTo,
  initialCandidateId,
  initialCompose = false,
}: {
  workspace: Workspace;
  initialTo?: string;
  initialCandidateId?: string;
  initialCompose?: boolean;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [connection, setConnection] = useState<GoogleConnection>(workspace.google);
  const [source, setSource] = useState<"gmail" | "demo">("demo");
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compose, setCompose] = useState<ComposeState>(() => {
    const candidate = workspace.candidates.find((entry) => entry.id === initialCandidateId);
    if (initialCompose || initialTo) {
      return {
        open: true,
        to: initialTo ?? candidate?.email ?? "",
        subject: "",
        body: "",
        candidateId: initialCandidateId,
        purpose: "general",
      };
    }
    return emptyCompose;
  });
  const [composing, setComposing] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [draftSource, setDraftSource] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (search: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/mail?q=${encodeURIComponent(search)}&limit=24`, { cache: "no-store" });
      const data = (await response.json()) as MailResponse & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Mail could not be loaded.");
      setMessages(data.messages);
      setConnection(data.connection);
      setSource(data.source);
      setWarning(data.warning);
      setSelectedId((current) => (current && data.messages.some((m) => m.id === current) ? current : data.messages[0]?.id ?? null));
    } catch (error) {
      toast.error("Inbox unavailable", {
        description: error instanceof Error ? error.message : "Try again in a moment.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load("");
  }, [load]);

  const filtered = useMemo(() => {
    if (filter === "unread") return messages.filter((message) => message.unread);
    if (filter === "starred") return messages.filter((message) => message.starred);
    return messages;
  }, [filter, messages]);

  const selected = messages.find((message) => message.id === selectedId) ?? null;
  const selectedCandidate = selected?.candidateId
    ? workspace.candidates.find((candidate) => candidate.id === selected.candidateId)
    : null;

  const openMessage = (message: MailMessage) => {
    setSelectedId(message.id);
    if (!message.unread) return;
    setMessages((current) => current.map((item) => (item.id === message.id ? { ...item, unread: false } : item)));
    void fetch(`/api/mail/${encodeURIComponent(message.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unread: false }),
    });
  };

  const patch = async (message: MailMessage, change: Record<string, unknown>, label: string) => {
    setBusy(message.id);
    try {
      const response = await fetch(`/api/mail/${encodeURIComponent(message.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(change),
      });
      const data = (await response.json()) as { simulated?: boolean; detail?: string; error?: string };
      if (!response.ok) throw new Error(data.error ?? "That change did not save.");
      if (change.starred !== undefined) {
        setMessages((current) =>
          current.map((item) => (item.id === message.id ? { ...item, starred: Boolean(change.starred) } : item)),
        );
      }
      if (change.archive) {
        setMessages((current) => current.filter((item) => item.id !== message.id));
        setSelectedId(null);
      }
      if (change.unread !== undefined) {
        setMessages((current) =>
          current.map((item) => (item.id === message.id ? { ...item, unread: Boolean(change.unread) } : item)),
        );
      }
      toast(data.simulated ? "Demo inbox" : label, {
        description: data.simulated ? data.detail ?? "Connect Gmail to change real messages." : undefined,
      });
    } catch (error) {
      toast.error("Could not update", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setBusy(null);
    }
  };

  const trash = async (message: MailMessage) => {
    setBusy(message.id);
    try {
      const response = await fetch(`/api/mail/${encodeURIComponent(message.id)}`, { method: "DELETE" });
      const data = (await response.json()) as { simulated?: boolean; detail?: string; error?: string };
      if (!response.ok) throw new Error(data.error ?? "That message could not be removed.");
      setMessages((current) => current.filter((item) => item.id !== message.id));
      setSelectedId(null);
      toast(data.simulated ? "Demo inbox" : "Moved to trash", {
        description: data.simulated ? data.detail ?? "Connect Gmail to trash real messages." : undefined,
      });
    } catch (error) {
      toast.error("Could not remove", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setBusy(null);
    }
  };

  const startCompose = (preset?: Partial<ComposeState>) => {
    setDraftSource(null);
    setCompose({ ...emptyCompose, open: true, ...preset });
  };

  const aiDraft = async () => {
    setDrafting(true);
    try {
      const response = await fetch("/api/ai/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose: compose.purpose,
          candidateId: compose.candidateId,
          instructions: compose.body.trim() || undefined,
        }),
      });
      const data = (await response.json()) as {
        subject?: string;
        body?: string;
        source?: string;
        error?: string;
      };
      if (!response.ok || !data.body) throw new Error(data.error ?? "No draft came back.");
      setCompose((current) => ({
        ...current,
        subject: current.subject.trim() || data.subject || current.subject,
        body: data.body ?? current.body,
      }));
      setDraftSource(data.source ?? "template");
      toast("Draft written", {
        description:
          data.source === "template"
            ? "Template used. Add a model key in Settings for Gemini-written copy."
            : `Written by ${data.source}. Review before sending.`,
      });
    } catch (error) {
      toast.error("Draft not written", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setDrafting(false);
    }
  };

  const send = async (mode: "send" | "draft") => {
    setComposing(true);
    try {
      const response = await fetch(mode === "send" ? "/api/mail/send" : "/api/mail/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: compose.to,
          subject: compose.subject,
          body: compose.body,
          threadId: compose.threadId,
        }),
      });
      const data = (await response.json()) as { ok?: boolean; link?: string; error?: string; code?: string };
      if (!response.ok) throw new Error(data.error ?? "The message did not leave.");
      toast(mode === "send" ? "Email sent" : "Draft saved in Gmail", {
        description: data.link ? "Open Gmail to review the thread." : "The audit log records this action.",
        action: data.link
          ? { label: "Open", onClick: () => window.open(data.link, "_blank", "noopener") }
          : undefined,
      });
      setCompose(emptyCompose);
      router.refresh();
      if (mode === "send") void load(query);
    } catch (error) {
      toast.error(mode === "send" ? "Email not sent" : "Draft not saved", {
        description: error instanceof Error ? error.message : "Check the connection and try again.",
      });
    } finally {
      setComposing(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1480px] px-4 py-5 sm:px-6 sm:py-7 xl:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate">
            <Mail className="h-3 w-3" />
            {source === "gmail" ? "Gmail" : "Demo inbox"}
            {connection.email ? <span className="font-mono text-[9.5px] text-slate/70">· {connection.email}</span> : null}
          </p>
          <h1 className="mt-1 font-display text-[32px] font-medium leading-none tracking-[-0.04em] text-ink sm:text-[38px]">
            Mail
          </h1>
          <p className="mt-1.5 max-w-[620px] text-[13px] leading-relaxed text-slate">
            Read, reply and schedule without leaving the desk. Every send is explicit and written to the
            audit log.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {connection.connected ? (
            <Badge tone="verified" dot>
              Google connected
            </Badge>
          ) : (
            <Link
              href="/app/connections"
              className="inline-flex items-center gap-1.5 rounded-[6px] border border-flag/35 bg-flag-soft px-2.5 py-1.5 text-[10.5px] font-medium text-[#6c5200] hover:border-flag"
            >
              <Plug className="h-3 w-3" />
              Connect Gmail to send
            </Link>
          )}
          <Button variant="ink" size="sm" onClick={() => startCompose()}>
            <PenLine className="h-3.5 w-3.5" />
            Compose
          </Button>
        </div>
      </div>

      {warning ? (
        <div className="mt-4 rounded-[8px] border border-flag/35 bg-flag-soft/60 px-3.5 py-2.5 text-[10.5px] leading-relaxed text-[#6c5200]">
          Gmail could not be read, so the demo inbox is shown. {warning}
        </div>
      ) : null}
      {!connection.connected ? (
        <div className="mt-4 rounded-[8px] border border-rule bg-paper px-3.5 py-2.5 text-[10.5px] leading-relaxed text-slate">
          This inbox is sample data. Sending is disabled until Google is connected, so nothing can leave
          the workspace by accident.
        </div>
      ) : null}

      <Panel className="mt-4 overflow-hidden">
        <div className="grid min-h-[560px] lg:grid-cols-[340px_minmax(0,1fr)]">
          <div className="border-b border-rule lg:border-b-0 lg:border-r">
            <div className="flex items-center gap-2 border-b border-rule px-3 py-2.5">
              <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-[6px] border border-rule bg-white px-2">
                <Search className="h-3.5 w-3.5 shrink-0 text-slate/70" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void load(query);
                  }}
                  placeholder="Search mail"
                  className="h-8 min-w-0 flex-1 bg-transparent text-[11.5px] text-ink outline-none placeholder:text-slate/60"
                />
                {query ? (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => {
                      setQuery("");
                      void load("");
                    }}
                    className="text-slate/60 hover:text-ink"
                  >
                    <X className="h-3 w-3" />
                  </button>
                ) : null}
              </div>
              <Button variant="ghost" size="sm" onClick={() => void load(query)} disabled={loading}>
                {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Go"}
              </Button>
            </div>

            <div className="flex items-center gap-1 border-b border-rule px-3 py-1.5">
              {(["all", "unread", "starred"] as Filter[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFilter(item)}
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] capitalize transition",
                    filter === item ? "bg-ink text-chalk" : "text-slate hover:bg-ink/[0.05] hover:text-ink",
                  )}
                >
                  {item}
                </button>
              ))}
              <span className="ml-auto text-[9.5px] text-slate/70">{filtered.length} shown</span>
            </div>

            <ul className="max-h-[520px] divide-y divide-rule overflow-y-auto scroll-thin">
              {loading && messages.length === 0 ? (
                <li className="flex items-center justify-center gap-2 px-4 py-10 text-[11px] text-slate">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading mail
                </li>
              ) : filtered.length === 0 ? (
                <li className="px-4 py-10 text-center text-[11px] text-slate">
                  No messages match. Try a different search.
                </li>
              ) : (
                filtered.map((message) => (
                  <li key={message.id}>
                    <button
                      type="button"
                      onClick={() => openMessage(message)}
                      className={cn(
                        "group flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition",
                        selectedId === message.id ? "bg-ultramarine-soft/60" : "hover:bg-ink/[0.035]",
                      )}
                    >
                      <span className="mt-1 flex w-2 shrink-0 justify-center">
                        {message.unread ? <span className="h-1.5 w-1.5 rounded-full bg-ultramarine" /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className={cn("truncate text-[11.5px]", message.unread ? "font-semibold text-ink" : "font-medium text-ink/85")}>
                            {message.from.name || message.from.email}
                          </span>
                          <span className="shrink-0 text-[9px] text-slate/70">{formatRelative(message.date)}</span>
                        </span>
                        <span className={cn("mt-0.5 block truncate text-[11px]", message.unread ? "text-ink" : "text-slate")}>
                          {message.subject}
                        </span>
                        <span className="mt-0.5 block truncate text-[10px] text-slate/75">{message.snippet}</span>
                      </span>
                      {message.starred ? <Star className="mt-1 h-3 w-3 shrink-0 fill-flag text-flag" /> : null}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="flex min-w-0 flex-col">
            {selected ? (
              <>
                <div className="flex flex-wrap items-center gap-2 border-b border-rule px-4 py-2.5">
                  <Badge tone={selected.demo ? "flag" : "verified"}>{selected.demo ? "Demo message" : "Gmail"}</Badge>
                  {selected.candidateId ? (
                    <Link
                      href={`/app/roles/${workspace.candidates.find((c) => c.id === selected.candidateId)?.roleId ?? ""}/candidates/${selected.candidateId}`}
                      className="inline-flex items-center gap-1 text-[10px] font-medium text-slate hover:text-ink hover:underline"
                    >
                      {selectedCandidate?.name ?? "Candidate"}
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  ) : null}
                  <div className="ml-auto flex items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label={selected.starred ? "Unstar" : "Star"}
                      disabled={busy === selected.id}
                      onClick={() => void patch(selected, { starred: !selected.starred }, selected.starred ? "Unstarred" : "Starred")}
                    >
                      <Star className={cn("h-3.5 w-3.5", selected.starred && "fill-flag text-flag")} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label={selected.unread ? "Mark read" : "Mark unread"}
                      disabled={busy === selected.id}
                      onClick={() => void patch(selected, { unread: !selected.unread }, selected.unread ? "Marked read" : "Marked unread")}
                    >
                      {selected.unread ? <MailOpen className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label="Archive"
                      disabled={busy === selected.id}
                      onClick={() => void patch(selected, { archive: true }, "Archived")}
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-slate hover:text-onair"
                      aria-label="Move to trash"
                      disabled={busy === selected.id}
                      onClick={() => void trash(selected)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto scroll-thin px-4 py-4 sm:px-6">
                  <h2 className="font-display text-[21px] font-medium leading-snug tracking-[-0.025em] text-ink">
                    {selected.subject}
                  </h2>
                  <div className="mt-3 flex items-center gap-2.5">
                    <Avatar
                      initials={(selected.from.name || selected.from.email)
                        .split(" ")
                        .map((part) => part[0])
                        .join("")
                        .slice(0, 2)}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-[11.5px] font-medium text-ink">
                        {selected.from.name || selected.from.email}
                        <span className="ml-1.5 font-normal text-slate">&lt;{selected.from.email}&gt;</span>
                      </p>
                      <p className="text-[9.5px] text-slate">
                        to {selected.to.map((entry) => entry.email).join(", ") || "you"} · {formatRelative(selected.date)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 rounded-[10px] border border-rule/80 bg-white/80 p-4 sm:p-5">
                    <RichText text={selected.body} />
                  </div>

                  <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-rule pt-4">
                    <Button
                      variant="ink"
                      size="sm"
                      onClick={() =>
                        startCompose({
                          to: selected.from.email,
                          subject: selected.subject.startsWith("Re:") ? selected.subject : `Re: ${selected.subject}`,
                          threadId: selected.threadId,
                          candidateId: selected.candidateId,
                        })
                      }
                    >
                      <Reply className="h-3.5 w-3.5" />
                      Reply
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        startCompose({
                          to: selected.from.email,
                          subject: `Interview times · ${selectedCandidate?.roleTitle ?? "next step"}`,
                          candidateId: selected.candidateId,
                          purpose: "schedule",
                        })
                      }
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Offer interview times
                    </Button>
                    <span className="ml-auto text-[9.5px] text-slate">
                      {selected.hasAttachment ? "Has an attachment" : "Plain text"}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-rule bg-paper">
                  <Inbox className="h-4 w-4 text-slate" strokeWidth={1.7} />
                </span>
                <p className="mt-3 text-[12px] text-slate">Choose a message to read it here.</p>
                <p className="mt-1 max-w-[280px] text-[10px] leading-relaxed text-slate/70">
                  Replying keeps the original thread. AI drafts are optional and never send on their own.
                </p>
              </div>
            )}
          </div>
        </div>
      </Panel>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-[9.5px] text-slate">
        <span className="flex items-center gap-1.5">
          <StatusDot status={connection.connected ? "connected" : "idle"} />
          {connection.connected ? "Live Gmail" : "Sample inbox"}
        </span>
        <span>Writes are logged in the audit trail.</span>
        <Link href="/app/voice" className="ml-auto font-medium hover:text-ink hover:underline">
          Ask Vaani to search mail
        </Link>
      </div>

      {compose.open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
          <button type="button" className="absolute inset-0" aria-label="Close compose" onClick={() => setCompose(emptyCompose)} />
          <div className="relative flex max-h-[92dvh] w-full max-w-[660px] animate-rise flex-col overflow-hidden rounded-t-[20px] border border-rule bg-paper shadow-2xl sm:rounded-[20px]">
            <div className="flex items-center gap-2 border-b border-rule px-4 py-3">
              <PenLine className="h-4 w-4 text-slate" />
              <h2 className="text-[12.5px] font-semibold text-ink">New message</h2>
              {draftSource ? (
                <Badge tone={draftSource === "template" ? "neutral" : "verified"}>
                  {draftSource === "template" ? "template" : draftSource}
                </Badge>
              ) : null}
              <Button variant="ghost" size="icon" className="ml-auto h-7 w-7" onClick={() => setCompose(emptyCompose)} aria-label="Close">
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto scroll-thin px-4 py-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[9.5px] font-medium uppercase tracking-[0.08em] text-slate">Candidate</span>
                  <select
                    value={compose.candidateId ?? ""}
                    onChange={(event) => {
                      const candidate = workspace.candidates.find((entry) => entry.id === event.target.value);
                      setCompose((current) => ({
                        ...current,
                        candidateId: candidate?.id,
                        to: candidate?.email ?? current.to,
                      }));
                    }}
                    className="mt-1 h-8 w-full rounded-[5px] border border-rule bg-white px-2 text-[11.5px] text-ink outline-none focus:border-ink"
                  >
                    <option value="">No specific candidate</option>
                    {workspace.candidates.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.name} · {candidate.alias}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[9.5px] font-medium uppercase tracking-[0.08em] text-slate">Purpose</span>
                  <select
                    value={compose.purpose}
                    onChange={(event) => {
                      const purpose = event.target.value as ComposeState["purpose"];
                      setCompose((current) => ({ ...current, purpose }));
                    }}
                    className="mt-1 h-8 w-full rounded-[5px] border border-rule bg-white px-2 text-[11.5px] text-ink outline-none focus:border-ink"
                  >
                    {purposes.map((purpose) => (
                      <option key={purpose.id} value={purpose.id}>
                        {purpose.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="mt-2 block">
                <span className="text-[9.5px] font-medium uppercase tracking-[0.08em] text-slate">To</span>
                <input
                  value={compose.to}
                  onChange={(event) => setCompose((current) => ({ ...current, to: event.target.value }))}
                  placeholder="name@example.com"
                  className="mt-1 h-9 w-full rounded-[5px] border border-rule bg-white px-2.5 text-[12px] text-ink outline-none focus:border-ink"
                />
              </label>

              <label className="mt-2 block">
                <span className="text-[9.5px] font-medium uppercase tracking-[0.08em] text-slate">Subject</span>
                <input
                  value={compose.subject}
                  onChange={(event) => setCompose((current) => ({ ...current, subject: event.target.value }))}
                  placeholder="One clear subject"
                  className="mt-1 h-9 w-full rounded-[5px] border border-rule bg-white px-2.5 text-[12px] text-ink outline-none focus:border-ink"
                />
              </label>

              <label className="mt-2 block">
                <span className="text-[9.5px] font-medium uppercase tracking-[0.08em] text-slate">Body</span>
                <textarea
                  value={compose.body}
                  onChange={(event) => setCompose((current) => ({ ...current, body: event.target.value }))}
                  rows={10}
                  placeholder="Write plain text. Keep it short and specific."
                  className="mt-1 w-full resize-y rounded-[5px] border border-rule bg-white px-2.5 py-2 text-[12px] leading-relaxed text-ink outline-none focus:border-ink"
                />
              </label>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => void aiDraft()} disabled={drafting}>
                  {drafting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  Draft with AI
                </Button>
                <span className="text-[9.5px] leading-relaxed text-slate">
                  Uses the role and evidence, never a score. Review every word.
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-rule bg-chalk/40 px-4 py-3">
              {connection.connected ? (
                <>
                  <Button variant="ink" size="sm" onClick={() => void send("send")} disabled={composing}>
                    {composing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                    Send
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void send("draft")} disabled={composing}>
                    Save draft
                  </Button>
                </>
              ) : (
                <Link
                  href="/app/connections"
                  className="inline-flex h-8 items-center gap-1.5 rounded-[7px] border border-flag/35 bg-flag-soft px-3 text-[11.5px] font-medium text-[#6c5200] hover:border-flag"
                >
                  <Plug className="h-3 w-3" />
                  Connect Gmail to send
                </Link>
              )}
              <span className="ml-auto text-[9.5px] text-slate">
                {connection.connected ? "Sends from your connected Gmail account." : "Nothing leaves this workspace."}
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
