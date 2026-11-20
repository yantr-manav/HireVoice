import { sendMail } from "@/lib/google/services";
import { GoogleNotConnectedError } from "@/lib/google/auth";
import { apiContext, assertSameOrigin, jsonError, jsonOk, readJson } from "@/lib/api/http";
import { googleConnection } from "@/lib/google/auth";
import { writeAudit } from "@/lib/db/repo";
import { ToolError } from "@/lib/agent/tools";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const ctx = await apiContext();
    const body = await readJson<{
      to?: string | string[];
      cc?: string[];
      subject?: string;
      body?: string;
      threadId?: string;
      candidateId?: string;
    }>(request);

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

    const sent = await sendMail(ctx.owner, {
      to: recipients,
      cc: body.cc,
      subject,
      body: text,
      threadId: body.threadId,
    });

    await writeAudit({
      actor: ctx.actor,
      action: "email_sent",
      target: recipients.join(", "),
      detail: subject,
      surface: "mail",
    });

    return jsonOk({ ok: true, id: sent.id, threadId: sent.threadId, link: sent.link });
  } catch (error) {
    return jsonError(error);
  }
}
