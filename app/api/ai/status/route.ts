import { NextResponse } from "next/server";
import { aiStatus } from "@/lib/ai/keys";
import { apiContext, jsonError } from "@/lib/api/http";
import { aiModels, gemmaFallbackChain, aiFallbackChain } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await apiContext();
    const status = await aiStatus();
    return NextResponse.json(
      {
        ...status,
        liveModel: aiModels.live,
        fallback: { gemini: aiFallbackChain, gemma: gemmaFallbackChain },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return jsonError(error);
  }
}
