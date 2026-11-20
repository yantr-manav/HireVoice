import { NextResponse } from "next/server";
import { assertSameOrigin, jsonError, readJson } from "@/lib/api/http";
import { newId, nowIso } from "@/lib/db";
import { nextDriveToken, saveLiveCandidate, writeAudit } from "@/lib/db/repo";
import { roles } from "@/lib/demo/data";
import { scoreInterviewWithGemini } from "@/lib/scoring/engine";
import { buildWhatsappReminderUrl, verifyLivenessPhrase } from "@/lib/scoring/verify";
import type {
  Candidate,
  CandidateLogistics,
  Language,
  TranscriptSegment,
} from "@/lib/types";

export const dynamic = "force-dynamic";

type SubmitBody = {
  candidateName?: string;
  email?: string;
  phone?: string;
  location?: string;
  roleId?: string;
  roleTitle?: string;
  language?: Language;
  audioConsent?: boolean;
  source?: Candidate["source"];
  token?: string;
  durationMs?: number;
  livenessPhrase?: string;
  livenessSpoken?: string;
  logistics?: CandidateLogistics;
  segments?: TranscriptSegment[];
};

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await readJson<SubmitBody>(request);

    const segments = Array.isArray(body.segments)
      ? body.segments.filter((s) => s && typeof s.text === "string" && s.text.trim().length > 0)
      : [];

    if (segments.length === 0) {
      return NextResponse.json(
        { error: "At least one spoken or typed answer is required to score the interview." },
        { status: 400 },
      );
    }

    const role = roles.find((r) => r.id === body.roleId) ?? roles[0];
    const roleId = role?.id ?? "role-support";
    const roleTitle = body.roleTitle?.trim() || role?.title || "Customer Support Executive";
    const language: Language = body.language ?? "en";
    const name = body.candidateName?.trim() || "Walk-in Candidate";
    const id = newId("cand");
    const alias = `Candidate #${id.slice(-4).toUpperCase()}`;
    const source: Candidate["source"] =
      body.source ?? (body.token?.startsWith("drive") ? "drive" : "invite");

    const liveness = body.livenessPhrase
      ? verifyLivenessPhrase(body.livenessPhrase, body.livenessSpoken)
      : undefined;

    const logistics: CandidateLogistics | undefined = body.logistics
      ? {
          ...body.logistics,
          mismatchFlags: [
            ...(body.logistics.nightShiftOk === false && roleId === "role-intl-voice"
              ? ["Shift mismatch: prefers day shift (role requires night shift)"]
              : []),
          ],
        }
      : undefined;

    const scored = await scoreInterviewWithGemini({
      candidateName: name,
      roleId,
      roleTitle,
      language,
      segments,
      logistics,
    });

    const driveToken = source === "drive" ? await nextDriveToken() : undefined;
    const phone = body.phone?.trim() || "+91 98200 00000";
    const email = body.email?.trim() || `${id}@candidate.hirevoice.in`;
    const now = nowIso();

    const flags: string[] = [];
    if (scored.injectionFlags.length > 0) flags.push("Injection Shield triggered");
    if (liveness && !liveness.matched) flags.push("Liveness phrase technical flag");
    if (logistics?.mismatchFlags && logistics.mismatchFlags.length > 0) {
      flags.push(...logistics.mismatchFlags);
    }

    const candidate: Candidate = {
      id,
      alias,
      name,
      email,
      phone,
      location: logistics?.preferredLocation || body.location?.trim() || role?.location || "Mumbai",
      roleId,
      roleTitle,
      language,
      stage: scored.score.decision === "shortlist_suggested" ? "interviewed" : "in_review",
      source,
      appliedAt: now,
      interviewAt: now,
      durationMs: Math.max(15_000, body.durationMs ?? 120_000),
      hasAudio: Boolean(body.audioConsent),
      audioConsent: Boolean(body.audioConsent),
      transcript: segments,
      score: scored.score,
      reviewReasons: scored.reviewReasons,
      flags,
      isReal: true,
      latencyMs: scored.latencyMs,
      driveToken,
      roleFits: scored.roleFits,
      logistics,
      liveness,
      injectionFlags: scored.injectionFlags,
      commitment: {
        status: "pending",
        whatsappUrl: buildWhatsappReminderUrl({
          phone,
          candidateName: name,
          roleTitle,
        }),
      },
    };

    await saveLiveCandidate(candidate);
    await writeAudit({
      actor: "Scoring Engine",
      action: scored.injectionFlags.length > 0 ? "interview_scored_injection_flagged" : "interview_scored_verified",
      target: `${candidate.name} (${candidate.alias})`,
      detail: `${scored.score.model} · ${scored.verifiedCount}/${scored.totalQuotes} quotes verified · ${(scored.latencyMs / 1000).toFixed(1)}s`,
      surface: "api",
    });

    return NextResponse.json(
      {
        ok: true,
        candidate,
        latencyMs: scored.latencyMs,
        verifiedCount: scored.verifiedCount,
        totalQuotes: scored.totalQuotes,
        piiRedactedCount: scored.piiRedactedCount,
        usedFallback: scored.usedFallback,
        reviewUrl: `/app/roles/${roleId}/candidates/${id}`,
        reportUrl: `/r/${id}`,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return jsonError(error);
  }
}
