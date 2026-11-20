import { approveAction, rejectAction } from "@/lib/agent/plan";
import { apiContext, assertSameOrigin, jsonError, jsonOk, readJson } from "@/lib/api/http";
import { ToolError } from "@/lib/agent/tools";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const ctx = await apiContext();
    const body = await readJson<{ actionId?: string; decision?: "approve" | "reject" }>(request);
    if (!body.actionId) throw new ToolError("Missing action id.");

    if (body.decision === "reject") {
      const action = await rejectAction(body.actionId);
      return jsonOk({ action });
    }

    const action = await approveAction(body.actionId, {
      owner: ctx.owner,
      actor: ctx.actor,
      email: ctx.email,
      source: "manual",
    });
    return jsonOk({ action });
  } catch (error) {
    return jsonError(error);
  }
}
