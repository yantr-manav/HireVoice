import { NextResponse } from "next/server";
import { apiContext, assertSameOrigin, jsonError, readJson } from "@/lib/api/http";
import { getLiveCandidate, saveLiveCandidate, writeAudit } from "@/lib/db/repo";
import { candidates as seededCandidates } from "@/lib/demo/data";
import { buildWhatsappReminderUrl } from "@/lib/scoring/verify";
import type { CommitmentState } from "@/lib/types";

export const dynamic = "force-dynamic";

type Body = {
  candidateId?: string;
  status?: CommitmentState["status"];
  slotLabel?: string;
};

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const ctx = await apiContext();
    const body = await readJson<Body>(request);

    const candidateId = (body.candidateId ?? "").trim();
    const status = body.status ?? "confirmed";
    if (!candidateId) {
      return NextResponse.json({ error: "candidateId is required." }, { status: 400 });
    }

    const existing =
      (await getLiveCandidate(candidateId)) ??
      seededCandidates.find((c) => c.id === candidateId);

    if (!existing) {
      return NextResponse.json({ error: "Candidate not found." }, { status: 404 });
    }

    const whatsappUrl = buildWhatsappReminderUrl({
      phone: existing.phone,
      candidateName: existing.name,
      roleTitle: existing.roleTitle,
      slotLabel: body.slotLabel,
    });

    const commitment: CommitmentState = {
      status,
      slotLabel: body.slotLabel ?? existing.commitment?.slotLabel,
      updatedAt: new Date().toISOString(),
      whatsappUrl,
    };

    const updated = await saveLiveCandidate({
      ...existing,
      commitment,
      stage: status === "confirmed" && existing.stage === "shortlisted" ? "scheduled" : existing.stage,
    });

    await writeAudit({
      actor: ctx.actor,
      action: `commitment_${status}`,
      target: existing.name,
      detail: body.slotLabel ? `Slot: ${body.slotLabel}` : `Commitment status set to ${status}`,
      surface: "review",
    });

    return NextResponse.json(
      { ok: true, commitment: updated.commitment },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return jsonError(error);
  }
}
