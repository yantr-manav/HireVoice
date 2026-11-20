import { createCalendarEvent, deleteCalendarEvent } from "@/lib/google/services";
import { googleConnection } from "@/lib/google/auth";
import { addLocalEvent, deleteLocalEvent, writeAudit } from "@/lib/db/repo";
import { apiContext, assertSameOrigin, jsonError, jsonOk, readJson } from "@/lib/api/http";
import { candidates } from "@/lib/demo/data";
import { ToolError } from "@/lib/agent/tools";
import { formatIstRange } from "@/lib/time";

export const dynamic = "force-dynamic";

type EventInput = {
  title?: string;
  description?: string;
  start?: string;
  end?: string;
  attendees?: string[];
  candidateId?: string;
  meet?: boolean;
  notify?: boolean;
};

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const ctx = await apiContext();
    const body = await readJson<EventInput>(request);

    const start = new Date(body.start ?? "");
    const end = new Date(body.end ?? "");
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new ToolError("Choose a valid start and end time.");
    if (end <= start) throw new ToolError("The end time needs to be after the start time.");
    if (end.getTime() - start.getTime() > 8 * 3_600_000) throw new ToolError("Keep a single event under eight hours.");

    const candidate = body.candidateId ? candidates.find((entry) => entry.id === body.candidateId) ?? null : null;
    const title = (body.title ?? "").trim() || (candidate ? `Interview · ${candidate.name}` : "Interview");
    const emails = (body.attendees ?? [candidate?.email ?? ""])
      .flatMap((entry) => entry.split(/[,;]/))
      .map((entry) => entry.trim())
      .filter((entry) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(entry));

    if (ctx.email && !emails.includes(ctx.email)) emails.push(ctx.email);

    const attendees = [
      ...(candidate ? [{ name: candidate.name, email: candidate.email }] : []),
      ...emails.filter((email) => email !== candidate?.email).map((email) => ({ email })),
    ];

    const connection = await googleConnection(ctx.owner);
    if (!connection.connected) {
      const event = await addLocalEvent({
        title,
        description: body.description ?? "",
        start: start.toISOString(),
        end: end.toISOString(),
        attendees,
        kind: "interview",
        candidateId: candidate?.id ?? null,
        createdBy: ctx.actor,
      });
      await writeAudit({
        actor: ctx.actor,
        action: "interview_scheduled",
        target: candidate?.name ?? title,
        detail: "Local Hirevoice calendar",
        surface: "calendar",
      });
      return jsonOk({ event, simulated: true, detail: "Saved locally. Connect Google Calendar for a Meet link." });
    }

    const event = await createCalendarEvent(ctx.owner, {
      title,
      description: body.description ?? "",
      start: start.toISOString(),
      end: end.toISOString(),
      attendees,
      meet: body.meet !== false,
      notify: Boolean(body.notify),
      kind: "interview",
      candidateId: candidate?.id,
    });
    await writeAudit({
      actor: ctx.actor,
      action: "interview_scheduled",
      target: candidate?.name ?? title,
      detail: formatIstRange(start, end),
      surface: "calendar",
    });
    return jsonOk({ event, simulated: false, detail: "Created in Google Calendar." });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const ctx = await apiContext();
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) throw new ToolError("Missing event id.");

    if (id.startsWith("evt_")) {
      await deleteLocalEvent(id);
      return jsonOk({ ok: true, simulated: false });
    }

    if (id.startsWith("demo-evt-")) {
      return jsonOk({ ok: true, simulated: true, detail: "Demo events cannot be deleted. Connect Google Calendar." });
    }

    if ((await googleConnection(ctx.owner)).connected) {
      await deleteCalendarEvent(ctx.owner, id);
      await writeAudit({ actor: ctx.actor, action: "interview_cancelled", target: id, surface: "calendar" });
      return jsonOk({ ok: true, simulated: false });
    }

    return jsonOk({ ok: true, simulated: true });
  } catch (error) {
    return jsonError(error);
  }
}
