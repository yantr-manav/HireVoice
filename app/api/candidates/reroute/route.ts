import { NextResponse } from "next/server";
import { apiContext, assertSameOrigin, jsonError, readJson } from "@/lib/api/http";
import { getLiveCandidate, saveLiveCandidate, writeAudit } from "@/lib/db/repo";
import { candidates as seededCandidates, roles } from "@/lib/demo/data";

export const dynamic = "force-dynamic";

type Body = {
  candidateId?: string;
  targetRoleId?: string;
  targetRoleTitle?: string;
  reason?: string;
};

/**
 * "Don't reject, re-route" — moves a candidate to a better-fitting BPO mandate
 * while preserving the full transcript, verified quotes, and audit log.
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const ctx = await apiContext();
    const body = await readJson<Body>(request);

    const candidateId = (body.candidateId ?? "").trim();
    const targetRoleId = (body.targetRoleId ?? "").trim();
    if (!candidateId || !targetRoleId) {
      return NextResponse.json({ error: "candidateId and targetRoleId are required." }, { status: 400 });
    }

    const existing =
      (await getLiveCandidate(candidateId)) ??
      seededCandidates.find((c) => c.id === candidateId);

    if (!existing) {
      return NextResponse.json({ error: "Candidate not found." }, { status: 404 });
    }

    const role = roles.find((r) => r.id === targetRoleId);
    const targetRoleTitle = body.targetRoleTitle?.trim() || role?.title || targetRoleId;

    const updated = await saveLiveCandidate({
      ...existing,
      roleId: role?.id ?? existing.roleId,
      roleTitle: targetRoleTitle,
      stage: "shortlisted",
      flags: Array.from(new Set([...existing.flags, `Re-routed to ${targetRoleTitle}`])),
    });

    await writeAudit({
      actor: ctx.actor,
      action: "candidate_rerouted",
      target: existing.name,
      detail: `Re-routed from ${existing.roleTitle} → ${targetRoleTitle}${body.reason ? ` (${body.reason})` : ""}`,
      surface: "review",
    });

    return NextResponse.json(
      {
        ok: true,
        candidate: updated,
        reviewUrl: `/app/roles/${updated.roleId}/candidates/${updated.id}`,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return jsonError(error);
  }
}
