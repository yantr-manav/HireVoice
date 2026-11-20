import { NextResponse } from "next/server";
import { assertSameOrigin, jsonError, readJson } from "@/lib/api/http";
import { nextRoleplayTurn, ROLEPLAY_SCENARIOS, type RoleplayScenarioId } from "@/lib/scoring/engine";
import type { Language } from "@/lib/types";

export const dynamic = "force-dynamic";

type Body = {
  scenario?: RoleplayScenarioId;
  language?: Language;
  history?: { role: "customer" | "candidate"; text: string }[];
  turnNumber?: number;
};

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await readJson<Body>(request);
    const scenario: RoleplayScenarioId =
      body.scenario && body.scenario in ROLEPLAY_SCENARIOS ? body.scenario : "refund";
    const language: Language = body.language ?? "en";
    const history = Array.isArray(body.history) ? body.history.slice(-10) : [];
    const turnNumber = typeof body.turnNumber === "number" ? body.turnNumber : 1;

    const result = await nextRoleplayTurn({ scenario, language, history, turnNumber });
    return NextResponse.json(
      { ok: true, ...result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return jsonError(error);
  }
}
