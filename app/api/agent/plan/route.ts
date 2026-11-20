import { planCommand } from "@/lib/agent/plan";
import { apiContext, assertSameOrigin, jsonError, jsonOk, readJson } from "@/lib/api/http";
import { ToolError } from "@/lib/agent/tools";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const ctx = await apiContext();
    const body = await readJson<{ transcript?: string }>(request);
    const transcript = (body.transcript ?? "").trim();
    if (!transcript) throw new ToolError("Say or type a command first.");

    const plan = await planCommand(transcript, {
      owner: ctx.owner,
      actor: ctx.actor,
      email: ctx.email,
      source: "manual",
    });

    return jsonOk({ plan });
  } catch (error) {
    return jsonError(error);
  }
}
