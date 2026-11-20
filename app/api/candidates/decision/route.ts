import { NextResponse } from "next/server";
import { apiContext, assertSameOrigin, jsonError, readJson } from "@/lib/api/http";
import { addDecision, writeAudit } from "@/lib/db/repo";
import { candidates } from "@/lib/demo/data";

export const dynamic = "force-dynamic";

type Body = {
  candidateId?: string;
  roleId?: string;
  action?: "shortlist" | "close" | "review" | "scheduled" | "skip";
  reason?: string;
  note?: string;
};

const VALID_ACTIONS = new Set(["shortlist", "close", "review", "scheduled", "skip"]);

/** Human-in-the-loop candidate stage update. Never sends email automatically and never deletes candidates. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const ctx = await apiContext();
    const body = await readJson<Body>(request);

    const candidateId = (body.candidateId ?? "").trim();
    const action = body.action;
    if (!candidateId || !action || !VALID_ACTIONS.has(action)) {
      return NextResponse.json({ error: "Valid candidateId and decision action are required." }, { status: 400 });
    }

    const candidate = candidates.find((entry) => entry.id === candidateId);
    const roleId = (body.roleId ?? candidate?.roleId ?? "role-support").trim();

    const record = await addDecision({
      candidateId,
      roleId,
      action,
      reason: body.reason?.trim() || null,
      note: body.note?.trim() || null,
      actor: ctx.actor,
    });

    await writeAudit({
      actor: ctx.actor,
      action: `stage_${action}`,
      target: candidate?.name ?? candidateId,
      detail: body.reason?.trim() || body.note?.trim() || `Moved to ${action} by recruiter`,
      surface: "review",
    });

    return NextResponse.json(
      { ok: true, decision: record },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return jsonError(error);
  }
}
