import { NextResponse } from "next/server";
import { assertSameOrigin, jsonError, readJson } from "@/lib/api/http";
import { extractLogisticsWithGemini } from "@/lib/scoring/engine";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await readJson<{ transcript?: string }>(request);
    const transcript = (body.transcript ?? "").trim();
    if (!transcript) {
      return NextResponse.json({ error: "Please provide a spoken or typed logistics answer." }, { status: 400 });
    }
    const logistics = await extractLogisticsWithGemini(transcript);
    return NextResponse.json(
      { ok: true, logistics },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return jsonError(error);
  }
}
