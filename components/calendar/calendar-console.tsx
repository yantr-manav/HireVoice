"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Trash2,
  Users,
  Video,
  X,
} from "lucide-react";
import type { CalendarEvent, GoogleConnection, Workspace } from "@/lib/types";
import { cn, formatRelative } from "@/lib/utils";
import {
  addDays,
  formatIstDay,
  formatIstRange,
  formatIstTime,
  istAt,
  istDateKey,
  istParts,
  monthGridStart,
  monthName,
  startOfIstDay,
  startOfIstWeek,
} from "@/lib/time";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/panel";

type View = "month" | "week" | "agenda";

type CalendarResponse = {
  connection: GoogleConnection;
  source: "google" | "demo";
  warning: string | null;
  events: CalendarEvent[];
  range: { from: string; to: string };
  today: string;
};

const kindTone: Record<CalendarEvent["kind"], string> = {
  interview: "border-l-ultramarine bg-ultramarine-soft/70 text-[#2536c9]",
  review: "border-l-flag bg-flag-soft/80 text-[#6c5200]",
  hold: "border-l-slate bg-chalk text-slate",
  personal: "border-l-verified bg-verified-soft/70 text-[#0a7f51]",
};

function sourceLabel(event: CalendarEvent) {
  if (event.demo) return "Demo";
  if (event.local || event.id.startsWith("evt_")) return "Hirevoice";
  return "Google";
}

function rangeFor(view: View, anchor: Date) {
  if (view === "month") {
    const from = monthGridStart(anchor);
    return { from, to: addDays(from, 42) };
  }
  if (view === "week") {
    const from = startOfIstWeek(anchor);
    return { from, to: addDays(from, 7) };
  }
  const from = startOfIstDay(anchor);
  return { from, to: addDays(from, 14) };
}

export function CalendarConsole({ workspace }: { workspace: Workspace }) {
  const router = useRouter();
  const [view, setView] = useState<View>("month");
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [connection, setConnection] = useState<GoogleConnection>(workspace.google);
  const [source, setSource] = useState<"google" | "demo">("demo");
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const range = useMemo(() => rangeFor(view, anchor), [view, anchor]);

  const todayKey = istDateKey(new Date());
  const selected = events.find((event) => event.id === selectedId) ?? null;

  const [form, setForm] = useState(() => ({
    candidateId: "",
    day: istDateKey(new Date()),
    time: "15:00",
    duration: 30,
    title: "",
    description: "",
    meet: true,
  }));

  const load = useCallback(async (from: Date, to: Date) => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/calendar?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
        { cache: "no-store" },
      );
      const data = (await response.json()) as CalendarResponse & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Calendar could not be loaded.");
      setEvents(data.events);
      setConnection(data.connection);
      setSource(data.source);
      setWarning(data.warning);
    } catch (error) {
      toast.error("Calendar unavailable", {
        description: error instanceof Error ? error.message : "Try again in a moment.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(range.from, range.to);
  }, [load, range.from, range.to]);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const key = istDateKey(event.start);
      map.set(key, [...(map.get(key) ?? []), event]);
    }
    for (const list of map.values()) list.sort((a, b) => a.start.localeCompare(b.start));
    return map;
  }, [events]);

  const monthCells = useMemo(() => {
    const start = monthGridStart(anchor);
    return Array.from({ length: 42 }, (_, index) => addDays(start, index));
  }, [anchor]);

  const weekDays = useMemo(() => {
    const start = startOfIstWeek(anchor);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }, [anchor]);

  const agendaDays = useMemo(() => {
    const start = startOfIstDay(anchor);
    return Array.from({ length: 14 }, (_, index) => addDays(start, index));
  }, [anchor]);

  const title =
    view === "month"
      ? `${monthName(istParts(anchor).month)} ${istParts(anchor).year}`
      : view === "week"
        ? `${formatIstDay(weekDays[0])} – ${formatIstDay(weekDays[6])}`
        : `Next 14 days · ${formatIstDay(anchor)}`;

  const step = (direction: -1 | 1) => {
    if (view === "month") {
      const parts = istParts(anchor);
      const monthDate = new Date(Date.UTC(parts.year, parts.month + direction, 1, 12) - 330 * 60_000);
      setAnchor(monthDate);
    } else if (view === "week") {
      setAnchor(addDays(anchor, direction * 7));
    } else {
      setAnchor(addDays(anchor, direction * 14));
    }
  };

  const startSchedule = (dayKey?: string) => {
    setForm((current) => ({ ...current, day: dayKey ?? current.day, title: "" }));
    setScheduling(true);
  };

  const onCandidate = (candidateId: string) => {
    const candidate = workspace.candidates.find((entry) => entry.id === candidateId);
    setForm((current) => ({
      ...current,
      candidateId,
      title: candidate ? `Interview · ${candidate.name}` : current.title,
    }));
  };

  const createEvent = async () => {
    setSubmitting(true);
    try {
      const [hour, minute] = form.time.split(":").map(Number);
      const start = istAt(form.day, hour || 0, minute || 0);
      const end = new Date(start.getTime() + form.duration * 60_000);
      const response = await fetch("/api/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          start: start.toISOString(),
          end: end.toISOString(),
          candidateId: form.candidateId || undefined,
          meet: form.meet,
        }),
      });
      const data = (await response.json()) as {
        event?: CalendarEvent;
        simulated?: boolean;
        detail?: string;
        error?: string;
      };
      if (!response.ok || !data.event) throw new Error(data.error ?? "The event was not created.");
      setScheduling(false);
      setSelectedId(data.event.id);
      toast(data.simulated ? "Saved to the Hirevoice calendar" : "Interview scheduled in Google Calendar", {
        description: data.detail ?? formatIstRange(data.event.start, data.event.end),
      });
      await load(range.from, range.to);
      router.refresh();
    } catch (error) {
      toast.error("Could not schedule", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const removeEvent = async (event: CalendarEvent) => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/calendar/events?id=${encodeURIComponent(event.id)}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { simulated?: boolean; detail?: string; error?: string };
      if (!response.ok) throw new Error(data.error ?? "That event could not be removed.");
      toast(data.simulated ? "Demo event" : "Event cancelled", {
        description: data.simulated ? data.detail ?? "Connect Google Calendar to cancel real events." : undefined,
      });
      setSelectedId(null);
      if (!data.simulated) await load(range.from, range.to);
    } catch (error) {
      toast.error("Could not cancel", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setDeleting(false);
    }
  };

  const eventChip = (event: CalendarEvent, dense = false) => (
    <button
      key={event.id}
      type="button"
      onClick={(click) => {
        click.stopPropagation();
        setSelectedId(event.id);
      }}
      className={cn(
        "w-full truncate rounded-[3px] border-l-2 px-1.5 text-left transition hover:brightness-[0.97]",
        kindTone[event.kind],
        dense ? "py-[1px] text-[8.5px]" : "py-1 text-[9.5px]",
        selectedId === event.id && "ring-1 ring-ink/25",
      )}
      title={`${formatIstTime(event.start)} · ${event.title}`}
    >
      <span className="font-mono tabular text-[8.5px] opacity-70">{formatIstTime(event.start)}</span>{" "}
      {event.title}
    </button>
  );

  return (
    <div className="mx-auto max-w-[1480px] px-4 py-5 sm:px-6 sm:py-7 xl:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate">
            <CalendarDays className="h-3 w-3" />
            {source === "google" ? "Google Calendar" : "Demo calendar"}
            {connection.email ? <span className="font-mono text-[9.5px] text-slate/70">· {connection.email}</span> : null}
          </p>
          <h1 className="mt-1 font-display text-[32px] font-medium leading-none tracking-[-0.04em] text-ink sm:text-[38px]">
            Calendar
          </h1>
          <p className="mt-1.5 max-w-[620px] text-[13px] leading-relaxed text-slate">
            Interviews, reviews and holds in IST. A Meet link is created only when you schedule one.
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
              Demo calendar · connect Google
            </Link>
          )}
          <Button variant="ink" size="sm" onClick={() => startSchedule()}>
            <CalendarPlus className="h-3.5 w-3.5" />
            Schedule interview
          </Button>
        </div>
      </div>

      {warning ? (
        <div className="mt-4 rounded-[8px] border border-flag/35 bg-flag-soft/60 px-3.5 py-2.5 text-[10.5px] leading-relaxed text-[#6c5200]">
          Google Calendar could not be read, so the demo calendar is shown. {warning}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-[6px] border border-rule bg-paper p-0.5">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => step(-1)} aria-label="Previous">
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={() => setAnchor(new Date())}>
            Today
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => step(1)} aria-label="Next">
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
        <h2 className="font-display text-[18px] font-medium tracking-[-0.02em] text-ink">{title}</h2>
        <div className="ml-auto flex items-center gap-1">
          {loading ? <Loader2 className="mr-1 h-3 w-3 animate-spin text-slate" /> : null}
          <div className="flex rounded-[6px] border border-rule bg-paper p-0.5">
            {(["month", "week", "agenda"] as View[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setView(item)}
                className={cn(
                  "rounded-[4px] px-2.5 py-1 text-[10.5px] capitalize transition",
                  view === item ? "bg-ink text-chalk" : "text-slate hover:text-ink",
                )}
              >
                {item}
              </button>
            ))}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label="Refresh calendar"
            onClick={() => void load(range.from, range.to)}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Panel className="overflow-hidden">
          {view === "month" ? (
            <div>
              <div className="grid grid-cols-7 border-b border-rule bg-chalk/50">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                  <div key={day} className="px-1.5 py-1 text-center text-[9px] font-medium uppercase tracking-[0.06em] text-slate">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {monthCells.map((cell) => {
                  const key = istDateKey(cell);
                  const parts = istParts(cell);
                  const inMonth = parts.month === istParts(anchor).month;
                  const isToday = key === todayKey;
                  const dayEvents = byDay.get(key) ?? [];
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => startSchedule(key)}
                      className={cn(
                        "group min-h-[92px] border-b border-r border-rule/80 p-1 text-left align-top transition last:border-r-0 hover:bg-ultramarine-soft/25",
                        !inMonth && "bg-chalk/40",
                      )}
                    >
                      <span
                        className={cn(
                          "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 font-mono text-[9px] tabular",
                          isToday ? "bg-ink text-chalk" : inMonth ? "text-ink" : "text-slate/45",
                        )}
                      >
                        {parts.day}
                      </span>
                      <span className="mt-1 flex flex-col gap-0.5">
                        {dayEvents.slice(0, 2).map((event) => eventChip(event, true))}
                        {dayEvents.length > 2 ? (
                          <span className="px-1 text-[8px] text-slate">+{dayEvents.length - 2} more</span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : view === "week" ? (
            <div className="grid grid-cols-1 divide-y divide-rule sm:grid-cols-7 sm:divide-x sm:divide-y-0">
              {weekDays.map((day) => {
                const key = istDateKey(day);
                const dayEvents = byDay.get(key) ?? [];
                return (
                  <div key={key} className="min-h-[240px] p-1.5">
                    <div className="flex items-baseline justify-between px-1 pb-1.5">
                      <span className="text-[9px] uppercase tracking-[0.06em] text-slate">{formatIstDay(day).split(",")[0]}</span>
                      <span
                        className={cn(
                          "font-mono text-[10px] tabular",
                          key === todayKey ? "rounded-full bg-ink px-1.5 text-chalk" : "text-ink",
                        )}
                      >
                        {istParts(day).day}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {dayEvents.length === 0 ? (
                        <button
                          type="button"
                          onClick={() => startSchedule(key)}
                          className="w-full rounded-[3px] border border-dashed border-rule py-2 text-[8.5px] text-slate/50 hover:border-slate/40 hover:text-slate"
                        >
                          + add
                        </button>
                      ) : (
                        dayEvents.map((event) => eventChip(event))
                      )}
                      {dayEvents.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => startSchedule(key)}
                          className="w-full rounded-[3px] px-1 py-0.5 text-left text-[8.5px] text-slate/50 hover:bg-ink/[0.04] hover:text-slate"
                        >
                          + add
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="divide-y divide-rule">
              {agendaDays.map((day) => {
                const key = istDateKey(day);
                const dayEvents = byDay.get(key) ?? [];
                return (
                  <div key={key} className="flex gap-3 px-3 py-2.5">
                    <div className="w-[86px] shrink-0">
                      <p className="text-[10.5px] font-medium text-ink">{formatIstDay(day)}</p>
                      <p className="text-[9px] text-slate">{dayEvents.length} event{dayEvents.length === 1 ? "" : "s"}</p>
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      {dayEvents.length === 0 ? (
                        <button
                          type="button"
                          onClick={() => startSchedule(key)}
                          className="rounded-[4px] border border-dashed border-rule px-2 py-1 text-[9px] text-slate/55 hover:border-slate/40 hover:text-slate"
                        >
                          Nothing planned · add interview
                        </button>
                      ) : (
                        dayEvents.map((event) => (
                          <button
                            key={event.id}
                            type="button"
                            onClick={() => setSelectedId(event.id)}
                            className={cn(
                              "flex w-full items-center gap-2 rounded-[5px] border-l-2 px-2 py-1.5 text-left",
                              kindTone[event.kind],
                            )}
                          >
                            <span className="w-[68px] shrink-0 font-mono text-[9.5px] tabular opacity-75">
                              {formatIstTime(event.start)}–{formatIstTime(event.end)}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-[10.5px] font-medium">{event.title}</span>
                            {event.meetLink ? <Video className="h-3 w-3 shrink-0 opacity-70" /> : null}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <div className="space-y-3">
          <Panel className="overflow-hidden">
            <PanelHeader
              title={selected ? "Event" : "Next up"}
              meta={selected ? sourceLabel(selected) : `${events.length} in view`}
              action={
                selected ? (
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedId(null)} aria-label="Close event">
                    <X className="h-3 w-3" />
                  </Button>
                ) : (
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startSchedule()} aria-label="Add event">
                    <Plus className="h-3 w-3" />
                  </Button>
                )
              }
            />
            {selected ? (
              <div className="p-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={selected.demo ? "flag" : selected.local || selected.id.startsWith("evt_") ? "ultra" : "verified"}>
                    {sourceLabel(selected)}
                  </Badge>
                  <Badge tone="neutral">{selected.kind}</Badge>
                  {selected.status === "tentative" ? <Badge tone="flag">Tentative</Badge> : null}
                </div>
                <h3 className="mt-2 font-display text-[18px] font-medium leading-tight tracking-[-0.025em] text-ink">
                  {selected.title}
                </h3>
                <p className="mt-1.5 flex items-center gap-1.5 text-[10.5px] text-slate">
                  <Clock className="h-3 w-3" />
                  {formatIstRange(selected.start, selected.end)}
                </p>
                {selected.location ? (
                  <p className="mt-1 flex items-center gap-1.5 text-[10.5px] text-slate">
                    <MapPin className="h-3 w-3" />
                    {selected.location}
                  </p>
                ) : null}
                {selected.description ? (
                  <p className="mt-2 text-[10.5px] leading-relaxed text-slate">{selected.description}</p>
                ) : null}

                <div className="mt-3">
                  <p className="flex items-center gap-1.5 text-[9.5px] font-medium uppercase tracking-[0.08em] text-slate">
                    <Users className="h-3 w-3" />
                    Attendees
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {selected.attendees.length === 0 ? (
                      <li className="text-[10px] text-slate/70">Only you</li>
                    ) : (
                      selected.attendees.map((attendee) => (
                        <li key={attendee.email} className="flex items-center justify-between gap-2 text-[10px]">
                          <span className="truncate text-ink">{attendee.name || attendee.email}</span>
                          <span className="truncate font-mono text-[8.5px] text-slate/70">{attendee.email}</span>
                        </li>
                      ))
                    )}
                  </ul>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {selected.meetLink ? (
                    <a
                      href={selected.meetLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-7 items-center gap-1.5 rounded-[5px] border border-ultra/30 bg-ultramarine-soft px-2 text-[10px] font-medium text-[#2536c9] hover:border-ultramarine"
                    >
                      <Video className="h-3 w-3" />
                      Join Meet
                    </a>
                  ) : null}
                  {selected.htmlLink ? (
                    <a
                      href={selected.htmlLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-7 items-center gap-1.5 rounded-[5px] border border-rule bg-white px-2 text-[10px] font-medium text-ink hover:border-ink"
                    >
                      Open in Google
                    </a>
                  ) : null}
                  {selected.candidateId ? (
                    <Link
                      href={`/app/roles/${workspace.candidates.find((c) => c.id === selected.candidateId)?.roleId ?? ""}/candidates/${selected.candidateId}`}
                      className="inline-flex h-7 items-center gap-1.5 rounded-[5px] border border-rule bg-white px-2 text-[10px] font-medium text-ink hover:border-ink"
                    >
                      Candidate evidence
                    </Link>
                  ) : null}
                </div>

                <Button
                  variant="danger"
                  size="sm"
                  className="mt-3"
                  onClick={() => void removeEvent(selected)}
                  disabled={deleting}
                >
                  {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  {selected.demo ? "Demo event" : "Cancel event"}
                </Button>
              </div>
            ) : (
              <ul className="divide-y divide-rule">
                {events.slice(0, 6).map((event) => (
                  <li key={event.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(event.id)}
                      className="flex w-full items-start gap-2.5 px-4 py-2.5 text-left hover:bg-ink/[0.035]"
                    >
                      <StatusDot status={event.kind === "interview" ? "working" : "idle"} className="mt-1.5" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11px] font-medium text-ink">{event.title}</span>
                        <span className="mt-0.5 block text-[9.5px] text-slate">
                          {formatIstDay(event.start)} · {formatIstTime(event.start)}
                          {event.meetLink ? " · Meet" : ""}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-[8.5px] text-slate/60">{sourceLabel(event)}</span>
                    </button>
                  </li>
                ))}
                {events.length === 0 && !loading ? (
                  <li className="px-4 py-8 text-center text-[11px] text-slate">Nothing in this range yet.</li>
                ) : null}
              </ul>
            )}
          </Panel>

          <Panel className="p-4">
            <div className="flex items-center gap-2">
              <Video className="h-3.5 w-3.5 text-slate" />
              <h2 className="text-[11.5px] font-semibold text-ink">Meet links</h2>
            </div>
            <p className="mt-1.5 text-[10px] leading-relaxed text-slate">
              {connection.connected
                ? "New interviews get a Google Meet link automatically. The candidate receives one calendar invite, not a sequence."
                : "Demo events show sample Meet links. Connect Google Calendar to create real ones."}
            </p>
            <p className="mt-2 font-mono text-[9px] text-slate/60">Asia/Kolkata · IST</p>
          </Panel>

          <Panel className="p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[11.5px] font-semibold text-ink">Connection</h2>
              <span className="text-[9px] text-slate">{connection.connectedAt ? formatRelative(connection.connectedAt) : "—"}</span>
            </div>
            <p className="mt-1.5 text-[10px] leading-relaxed text-slate">
              {warning ? warning : "Read-only calendar sync. Nothing is written until you schedule."}
            </p>
            <Link href="/app/connections" className="mt-2 inline-block text-[10px] font-medium text-slate hover:text-ink hover:underline">
              Manage Google connection
            </Link>
          </Panel>
        </div>
      </div>

      {scheduling ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
          <button type="button" className="absolute inset-0" aria-label="Close scheduling" onClick={() => setScheduling(false)} />
          <div className="relative max-h-[92dvh] w-full max-w-[520px] animate-rise overflow-y-auto scroll-thin rounded-t-[20px] border border-rule bg-paper shadow-2xl sm:rounded-[20px]">
            <div className="flex items-center gap-2 border-b border-rule px-4 py-3">
              <CalendarPlus className="h-4 w-4 text-slate" />
              <h2 className="text-[12.5px] font-semibold text-ink">Schedule interview</h2>
              <Button variant="ghost" size="icon" className="ml-auto h-7 w-7" onClick={() => setScheduling(false)} aria-label="Close">
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="space-y-2.5 px-4 py-3">
              <label className="block">
                <span className="text-[9.5px] font-medium uppercase tracking-[0.08em] text-slate">Candidate</span>
                <select
                  value={form.candidateId}
                  onChange={(event) => onCandidate(event.target.value)}
                  className="mt-1 h-8 w-full rounded-[5px] border border-rule bg-white px-2 text-[11.5px] text-ink outline-none focus:border-ink"
                >
                  <option value="">No specific candidate</option>
                  {workspace.candidates
                    .filter((candidate) => candidate.stage !== "closed")
                    .map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.name} · {candidate.stage.replace("_", " ")}
                      </option>
                    ))}
                </select>
              </label>

              <div className="grid grid-cols-3 gap-2">
                <label className="block">
                  <span className="text-[9.5px] font-medium uppercase tracking-[0.08em] text-slate">Day</span>
                  <input
                    type="date"
                    value={form.day}
                    onChange={(event) => setForm((current) => ({ ...current, day: event.target.value }))}
                    className="mt-1 h-8 w-full rounded-[5px] border border-rule bg-white px-1.5 text-[11px] text-ink outline-none focus:border-ink"
                  />
                </label>
                <label className="block">
                  <span className="text-[9.5px] font-medium uppercase tracking-[0.08em] text-slate">Start · IST</span>
                  <input
                    type="time"
                    value={form.time}
                    onChange={(event) => setForm((current) => ({ ...current, time: event.target.value }))}
                    className="mt-1 h-8 w-full rounded-[5px] border border-rule bg-white px-1.5 text-[11px] text-ink outline-none focus:border-ink"
                  />
                </label>
                <label className="block">
                  <span className="text-[9.5px] font-medium uppercase tracking-[0.08em] text-slate">Minutes</span>
                  <select
                    value={form.duration}
                    onChange={(event) => setForm((current) => ({ ...current, duration: Number(event.target.value) }))}
                    className="mt-1 h-8 w-full rounded-[5px] border border-rule bg-white px-1.5 text-[11px] text-ink outline-none focus:border-ink"
                  >
                    {[20, 30, 45, 60].map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {minutes}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="text-[9.5px] font-medium uppercase tracking-[0.08em] text-slate">Title</span>
                <input
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Interview · candidate name"
                  className="mt-1 h-8 w-full rounded-[5px] border border-rule bg-white px-2 text-[11.5px] text-ink outline-none focus:border-ink"
                />
              </label>

              <label className="block">
                <span className="text-[9.5px] font-medium uppercase tracking-[0.08em] text-slate">Note for attendees</span>
                <textarea
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  rows={3}
                  placeholder="What to prepare. No scores."
                  className="mt-1 w-full resize-y rounded-[5px] border border-rule bg-white px-2 py-1.5 text-[11.5px] text-ink outline-none focus:border-ink"
                />
              </label>

              <label className="flex items-start gap-2 rounded-[6px] border border-rule bg-white px-2.5 py-2">
                <input
                  type="checkbox"
                  checked={form.meet}
                  onChange={(event) => setForm((current) => ({ ...current, meet: event.target.checked }))}
                  className="mt-0.5 h-3.5 w-3.5 accent-[#3347f5]"
                />
                <span>
                  <span className="flex items-center gap-1.5 text-[11px] font-medium text-ink">
                    <Video className="h-3 w-3" />
                    Add a Google Meet link
                  </span>
                  <span className="mt-0.5 block text-[9.5px] text-slate">
                    {connection.connected
                      ? "Created in Google Calendar with the candidate as an attendee."
                      : "Saved locally for now. Connect Google to create the Meet link."}
                  </span>
                </span>
              </label>
            </div>

            <div className="flex items-center gap-2 border-t border-rule bg-chalk/40 px-4 py-3">
              <Button variant="ink" size="sm" onClick={() => void createEvent()} disabled={submitting}>
                {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <CalendarPlus className="h-3 w-3" />}
                {connection.connected ? "Create in Google Calendar" : "Save to Hirevoice"}
              </Button>
              <span className="ml-auto text-[9.5px] text-slate">One invite. No reminders loop.</span>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-3 text-[9.5px] text-slate">
        <span className="flex items-center gap-1.5">
          <StatusDot status={connection.connected ? "connected" : "idle"} />
          {connection.connected ? "Live Google Calendar" : "Sample calendar"}
        </span>
        <span>Times are shown in IST (Asia/Kolkata).</span>
        <Link href="/app/voice" className="ml-auto font-medium hover:text-ink hover:underline">
          Ask Vaani to schedule
        </Link>
      </div>
    </div>
  );
}
