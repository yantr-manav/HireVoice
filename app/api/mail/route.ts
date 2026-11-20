import { googleConnection } from "@/lib/google/auth";
import { listMail } from "@/lib/google/services";
import { demoMail } from "@/lib/google/demo";
import { apiContext, jsonError, jsonOk } from "@/lib/api/http";
import { candidateIdForEmail } from "@/lib/data/match";
import type { MailMessage } from "@/lib/types";

export const dynamic = "force-dynamic";

function withCandidate(messages: MailMessage[]): MailMessage[] {
  return messages.map((message) => ({
    ...message,
    candidateId: message.candidateId ?? candidateIdForEmail(message.from.email),
  }));
}

export async function GET(request: Request) {
  try {
    const ctx = await apiContext();
    const url = new URL(request.url);
    const query = url.searchParams.get("q")?.trim() ?? "";
    const limit = Number(url.searchParams.get("limit") ?? 18);
    const connection = await googleConnection(ctx.owner);

    if (connection.connected) {
      try {
        const messages = await listMail(ctx.owner, { query, limit: Math.min(Math.max(limit, 1), 30) });
        return jsonOk({ connection, source: "gmail", messages: withCandidate(messages), warning: null });
      } catch (error) {
        const warning = error instanceof Error ? error.message : "Gmail could not be read.";
        const term = query.toLowerCase();
        const demo = demoMail().filter((message) =>
          !term || `${message.from.name} ${message.from.email} ${message.subject} ${message.body}`.toLowerCase().includes(term),
        );
        return jsonOk({ connection, source: "demo", messages: withCandidate(demo), warning });
      }
    }

    const term = query.toLowerCase();
    const demo = demoMail().filter((message) =>
      !term || `${message.from.name} ${message.from.email} ${message.subject} ${message.body}`.toLowerCase().includes(term),
    );
    return jsonOk({ connection, source: "demo", messages: withCandidate(demo.slice(0, limit)), warning: null });
  } catch (error) {
    return jsonError(error);
  }
}
