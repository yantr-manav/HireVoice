import { createMailDraft } from "@/lib/google/services";
import { GoogleNotConnectedError, googleConnection } from "@/lib/google/auth";
import { apiContext, assertSameOrigin, jsonError, jsonOk, readJson } from "@/lib/api/http";
import { writeAudit } from "@/lib/db/repo";
import { ToolError } from "@/lib/agent/tools";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const ctx = await apiContext();
    const body = await readJson<{ to?: string | string[]; subject?: string; body?: string; threadId?: string }>(request);
    const connection = await googleConnection(ctx.owner);
    if (!connection.connected) throw new GoogleNotConnectedError();

    const recipients = (Array.isArray(body.to) ? body.to : [body.to ?? ""])
      .flatMap((entry) => entry.split(/[,;]/))
      .map((entry) => entry.trim())
      .filter((entry) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(entry));
    const subject = (body.subject ?? "").trim();
    const text = (body.body ?? "").trim();
    if (recipients.length === 0) throw new ToolError("Add at least one valid recipient email.");
    if (!subject) throw new ToolError("Add a subject line.");
    if (!text) throw new ToolError("The email body is empty.");

    const draft = await createMailDraft(ctx.owner, { to: recipients, subject, body: text, threadId: body.threadId });
    await writeAudit({ actor: ctx.actor, action: "email_draft_saved", target: recipients.join(", "), detail: subject, surface: "mail" });
    return jsonOk({ ok: true, id: draft.id, link: draft.link });
  } catch (error) {
    return jsonError(error);
  }
}
