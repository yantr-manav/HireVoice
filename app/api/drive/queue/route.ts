import { NextResponse } from "next/server";
import { getWorkspace } from "@/lib/data/workspace";

export const dynamic = "force-dynamic";

/**
 * Live polling endpoint for Walk-in Drive Mode (/app/drive).
 * Returns ranked candidates (real live submissions first, then seeded examples
 * clearly marked) plus honest real-only metrics.
 */
export async function GET() {
  const workspace = await getWorkspace();
  const real = workspace.candidates.filter((c) => c.isReal);
  const seeded = workspace.candidates.filter((c) => !c.isReal);

  const rankedReal = [...real].sort(
    (a, b) => b.score.overall * b.score.evidenceQuality - a.score.overall * a.score.evidenceQuality,
  );

  const toItem = (c: (typeof workspace.candidates)[number], idx: number) => {
    const allQuotes = c.score.items.flatMap((i) => i.evidence);
    const verified = allQuotes.filter((q) => q.verified).length;
    const altFit = c.roleFits?.find((f) => f.recommended);
    return {
      id: c.id,
      name: c.name,
      alias: c.alias,
      driveToken: c.driveToken ?? `#${String(idx + 1).padStart(2, "0")}`,
      roleId: c.roleId,
      roleTitle: c.roleTitle,
      language: c.language,
      stage: c.stage,
      overall: c.score.overall,
      evidenceQuality: c.score.evidenceQuality,
      verifiedQuotes: verified,
      totalQuotes: allQuotes.length,
      latencyMs: c.latencyMs ?? null,
      model: c.score.model,
      isReal: Boolean(c.isReal),
      interviewAt: c.interviewAt,
      reviewUrl: `/app/roles/${c.roleId}/candidates/${c.id}`,
      alternateFit: altFit ? { roleTitle: altFit.roleTitle, fitScore: altFit.fitScore } : null,
      injectionFlagged: Boolean(c.injectionFlags && c.injectionFlags.length > 0),
    };
  };

  return NextResponse.json(
    {
      ok: true,
      updatedAt: new Date().toISOString(),
      realMetrics: workspace.realMetrics,
      queue: rankedReal.map(toItem),
      seededSample: seeded.slice(0, 4).map(toItem),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
