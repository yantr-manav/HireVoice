import { NextResponse } from "next/server";
import { apiContext, assertSameOrigin, jsonError, readJson } from "@/lib/api/http";
import { getLiveCandidate, writeAudit } from "@/lib/db/repo";
import { candidates as seededCandidates } from "@/lib/demo/data";
import { formatTime, languageLabel } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Staffing Agency Feature: generates a one-page Client Submission Pack with
 * top verified evidence quotes and exact timestamp highlights so the client
 * hears/reads the candidate's real handling before scheduling.
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const ctx = await apiContext();
    const body = await readJson<{ candidateId?: string; clientName?: string }>(request);

    const candidateId = (body.candidateId ?? "").trim();
    if (!candidateId) {
      return NextResponse.json({ error: "candidateId is required." }, { status: 400 });
    }

    const candidate =
      (await getLiveCandidate(candidateId)) ??
      seededCandidates.find((c) => c.id === candidateId);

    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found." }, { status: 404 });
    }

    const verifiedQuotes = candidate.score.items
      .flatMap((item) =>
        item.evidence
          .filter((ev) => ev.verified)
          .map((ev) => ({
            skill: item.label,
            score: item.value,
            quote: ev.quote,
            timestamp: formatTime(ev.tStartMs),
            segmentSeq: ev.segmentSeq,
          })),
      )
      .slice(0, 4);

    const clientName = body.clientName?.trim() || "Client Hiring Manager";
    const lines = [
      `# Hirevoice Client Submission Pack — ${candidate.name} (${candidate.alias})`,
      `Prepared for: ${clientName} · Role: ${candidate.roleTitle}`,
      `Language: ${languageLabel(candidate.language)} · Location: ${candidate.location}`,
      `Overall Rubric Score: ${candidate.score.overall.toFixed(1)}/5 · Evidence Quality: ${Math.round(candidate.score.evidenceQuality * 100)}%`,
      candidate.logistics
        ? `Logistics (Candidate-Confirmed): Shift=${candidate.logistics.nightShiftOk === false ? "Day shift" : candidate.logistics.nightShiftOk === true ? "Night/Rotational OK" : "Not specified"} · Notice=${candidate.logistics.noticePeriod ?? "N/A"} · Expected CTC=${candidate.logistics.expectedCtc ?? "N/A"}`
        : "",
      "",
      "## Summary",
      candidate.score.summary,
      "",
      "## Verified Evidence Highlights",
      ...verifiedQuotes.map(
        (q, i) =>
          `${i + 1}. **${q.skill} (${q.score.toFixed(1)}/5)** at \`${q.timestamp}\` (Turn #${q.segmentSeq}): "${q.quote}"`,
      ),
      "",
      `Audio recording consent: ${candidate.audioConsent ? "Granted (14-day retention)" : "Transcript-only (no audio recorded)"}`,
      "Note: AI-assisted assessment with deterministic quote verification. Final hiring decision belongs to human reviewers.",
    ].filter(Boolean);

    const markdown = lines.join("\n");

    await writeAudit({
      actor: ctx.actor,
      action: "client_pack_generated",
      target: candidate.name,
      detail: `Generated Client Submission Pack (${verifiedQuotes.length} verified highlights) for ${clientName}`,
      surface: "review",
    });

    return NextResponse.json(
      {
        ok: true,
        candidateName: candidate.name,
        verifiedHighlights: verifiedQuotes,
        markdown,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return jsonError(error);
  }
}
