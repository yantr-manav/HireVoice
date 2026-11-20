import { getMail, modifyMail, trashMail } from "@/lib/google/services";
import { demoMail } from "@/lib/google/demo";
import { apiContext, assertSameOrigin, jsonError, jsonOk, readJson } from "@/lib/api/http";
import { candidateIdForEmail } from "@/lib/data/match";
import { googleConnection } from "@/lib/google/auth";
import { writeAudit } from "@/lib/db/repo";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await apiContext();
    const connection = await googleConnection(ctx.owner);
    if (!connection.connected || id.startsWith("demo-mail-")) {
      const message = demoMail().find((entry) => entry.id === id);
      if (!message) return jsonOk({ error: "Message not found" }, { status: 404 });
      return jsonOk({ message: { ...message, candidateId: candidateIdForEmail(message.from.email) }, source: "demo" });
    }
    const message = await getMail(ctx.owner, id);
    return jsonOk({ message: { ...message, candidateId: candidateIdForEmail(message.from.email) }, source: "gmail" });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { id } = await params;
    const ctx = await apiContext();
    const body = await readJson<{ unread?: boolean; starred?: boolean; archive?: boolean }>(request);
    const connection = await googleConnection(ctx.owner);
    if (!connection.connected || id.startsWith("demo-mail-")) {
      return jsonOk({ ok: true, simulated: true, detail: "Connect Gmail to change real messages." });
    }

    const add: string[] = [];
    const remove: string[] = [];
    if (typeof body.unread === "boolean") (body.unread ? add : remove).push("UNREAD");
    if (typeof body.starred === "boolean") (body.starred ? add : remove).push("STARRED");
    if (body.archive) remove.push("INBOX");
    await modifyMail(ctx.owner, id, { add, remove });
    await writeAudit({ actor: ctx.actor, action: "mail_updated", target: id, surface: "mail" });
    return jsonOk({ ok: true, simulated: false });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { id } = await params;
    const ctx = await apiContext();
    const connection = await googleConnection(ctx.owner);
    if (!connection.connected || id.startsWith("demo-mail-")) {
      return jsonOk({ ok: true, simulated: true, detail: "Connect Gmail to trash real messages." });
    }
    await trashMail(ctx.owner, id);
    await writeAudit({ actor: ctx.actor, action: "mail_trashed", target: id, surface: "mail" });
    return jsonOk({ ok: true, simulated: false });
  } catch (error) {
    return jsonError(error);
  }
}
