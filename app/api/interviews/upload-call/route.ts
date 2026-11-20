import { NextResponse } from "next/server";
import { apiContext, assertSameOrigin, jsonError } from "@/lib/api/http";
import { newId, nowIso } from "@/lib/db";
import { saveLiveCandidate, writeAudit } from "@/lib/db/repo";
import { roles } from "@/lib/demo/data";
import { scoreInterviewWithGemini, transcribeAudioWithGemini } from "@/lib/scoring/engine";
import { buildWhatsappReminderUrl } from "@/lib/scoring/verify";
import type { Candidate, Language, TranscriptSegment } from "@/lib/types";

export const dynamic = "force-dynamic";

const MAX_BYTES = 18 * 1024 * 1024;

/**
 * P1: Uploaded Call Intelligence.
 * Processes an existing mobile screening call recording ONLY when the recruiter
 * explicitly confirms recording consent. Uses Gemini audio understanding with
 * speaker diarization and runs the exact same rubric + deterministic quote verifier.
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const ctx = await apiContext();
    const form = await request.formData();

    const consentConfirmed = String(form.get("consentConfirmed") ?? "") === "true";
    if (!consentConfirmed) {
      return NextResponse.json(
        { error: "Explicit consent confirmation from the recorded parties is required before processing." },
        { status: 400 },
      );
    }

    const candidateName = String(form.get("candidateName") ?? "").trim() || "Uploaded Call Candidate";
    const phone = String(form.get("phone") ?? "").trim() || "+91 98200 00000";
    const roleId = String(form.get("roleId") ?? "role-support").trim();
    const role = roles.find((r) => r.id === roleId) ?? roles[0];
    const langField = String(form.get("language") ?? "hinglish");
    const language: Language =
      langField === "en" || langField === "hi" || langField === "hinglish" || langField === "mr"
        ? langField
        : "hinglish";
    const swapSpeakers = String(form.get("swapSpeakers") ?? "") === "true";

    const file = form.get("audio");
    const manualTranscript = String(form.get("transcript") ?? "").trim();

    let segments: TranscriptSegment[] = [];
    let transcribeModel = "manual-transcript";
    let audioQuality: "clear" | "noisy" | "low" = "clear";

    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_BYTES) {
        return NextResponse.json({ error: "Recording exceeds 18 MB limit." }, { status: 413 });
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const res = await transcribeAudioWithGemini({
        audioBase64: buffer.toString("base64"),
        mimeType: file.type || "audio/mpeg",
        language,
        diarize: true,
      });
      transcribeModel = res.model;
      audioQuality = res.audioQuality;
      segments = res.segments;
    }

    if (segments.length === 0 && manualTranscript) {
      const lines = manualTranscript.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      segments = lines.map((line, idx) => {
        const isRecruiter = /^(recruiter|interviewer|hr|caller|r)\s*:/i.test(line);
        const cleaned = line.replace(/^(recruiter|interviewer|hr|caller|candidate|applicant|r|c)\s*:\s*/i, "").trim();
        return {
          seq: idx + 1,
          speaker: isRecruiter ? "interviewer" : "candidate",
          text: cleaned || line,
          tStartMs: idx * 9000,
          tEndMs: idx * 9000 + 8000,
          lang: language,
        };
      });
    }

    if (segments.length === 0) {
      return NextResponse.json(
        {
          error:
            "Could not transcribe audio (check GEMINI_API_KEYS) and no fallback transcript was provided.",
        },
        { status: 422 },
      );
    }

    if (swapSpeakers) {
      segments = segments.map((s) => ({
        ...s,
        speaker: s.speaker === "candidate" ? "interviewer" : "candidate",
      }));
    }

    const scored = await scoreInterviewWithGemini({
      candidateName,
      roleId: role?.id ?? roleId,
      roleTitle: role?.title ?? "Customer Support Executive",
      language,
      segments,
    });

    const id = newId("call");
    const alias = `Call #${id.slice(-4).toUpperCase()}`;
    const now = nowIso();
    const durationMs = Math.max(
      30_000,
      segments[segments.length - 1]?.tEndMs ?? segments.length * 10_000,
    );

    const candidate: Candidate = {
      id,
      alias,
      name: candidateName,
      email: `${id}@call-upload.hirevoice.in`,
      phone,
      location: role?.location ?? "Mumbai",
      roleId: role?.id ?? roleId,
      roleTitle: role?.title ?? "Customer Support Executive",
      language,
      stage: scored.score.decision === "shortlist_suggested" ? "interviewed" : "in_review",
      source: "manual",
      appliedAt: now,
      interviewAt: now,
      durationMs,
      hasAudio: file instanceof File && file.size > 0,
      audioConsent: true,
      transcript: segments,
      score: scored.score,
      reviewReasons: scored.reviewReasons,
      flags: [
        "Uploaded mobile screening call",
        ...(audioQuality !== "clear" ? [`Audio quality: ${audioQuality}`] : []),
        ...(scored.injectionFlags.length > 0 ? ["Injection Shield triggered"] : []),
      ],
      isReal: true,
      latencyMs: scored.latencyMs,
      roleFits: scored.roleFits,
      injectionFlags: scored.injectionFlags,
      commitment: {
        status: "pending",
        whatsappUrl: buildWhatsappReminderUrl({
          phone,
          candidateName,
          roleTitle: role?.title ?? "Customer Support Executive",
        }),
      },
    };

    await saveLiveCandidate(candidate);
    await writeAudit({
      actor: ctx.actor,
      action: "uploaded_call_scored",
      target: candidate.name,
      detail: `Transcribed (${transcribeModel}) & scored (${scored.score.model}) · ${scored.verifiedCount}/${scored.totalQuotes} verified`,
      surface: "api",
    });

    return NextResponse.json(
      {
        ok: true,
        candidate,
        transcribeModel,
        audioQuality,
        verifiedCount: scored.verifiedCount,
        totalQuotes: scored.totalQuotes,
        latencyMs: scored.latencyMs,
        reviewUrl: `/app/roles/${candidate.roleId}/candidates/${candidate.id}`,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return jsonError(error);
  }
}
