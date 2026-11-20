import { listCalendarEvents } from "@/lib/google/services";
import { googleConnection } from "@/lib/google/auth";
import { demoCalendarEvents } from "@/lib/google/demo";
import { listLocalEvents } from "@/lib/db/repo";
import { apiContext, jsonError, jsonOk } from "@/lib/api/http";
import { candidateIdForEmail } from "@/lib/data/match";
import { addDays, monthGridStart, startOfIstDay } from "@/lib/time";
import type { CalendarEvent } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const ctx = await apiContext();
    const url = new URL(request.url);
    const now = new Date();
    const defaultFrom = monthGridStart(now);
    const from = url.searchParams.get("from") ?? defaultFrom.toISOString();
    const to = url.searchParams.get("to") ?? addDays(defaultFrom, 42).toISOString();

    const connection = await googleConnection(ctx.owner);
    const local = await listLocalEvents(from, to);
    let events: CalendarEvent[] = [];
    let source: "google" | "demo" = "demo";
    let warning: string | null = null;

    if (connection.connected) {
      try {
        events = await listCalendarEvents(ctx.owner, from, to);
        source = "google";
      } catch (error) {
        warning = error instanceof Error ? error.message : "Google Calendar could not be read.";
        events = demoCalendarEvents().filter((event) => event.start >= from && event.start <= to);
      }
    } else {
      events = demoCalendarEvents().filter((event) => event.start >= from && event.start <= to);
    }

    const merged = [...events, ...local]
      .map((event) => ({
        ...event,
        candidateId:
          event.candidateId ??
          event.attendees.map((attendee) => candidateIdForEmail(attendee.email)).find(Boolean),
      }))
      .sort((a, b) => a.start.localeCompare(b.start));

    return jsonOk({
      connection,
      source,
      warning,
      events: merged,
      range: { from, to },
      today: startOfIstDay(now).toISOString(),
    });
  } catch (error) {
    return jsonError(error);
  }
}
