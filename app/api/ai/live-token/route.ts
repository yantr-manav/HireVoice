import { NextResponse } from "next/server";
import { GoogleGenAI, Modality } from "@google/genai";
import { aiModels } from "@/lib/config";
import { orderKeys } from "@/lib/ai/keys";
import { apiContext, assertSameOrigin, jsonError, readJson } from "@/lib/api/http";

export const dynamic = "force-dynamic";

/**
 * Mints a one-use ephemeral token so the browser can open a Gemini Live
 * session without ever seeing the server API key.
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const ctx = await apiContext();
    const body = await readJson<{
      voice?: string;
      mode?: "operator" | "interviewer" | "roleplay";
      language?: string;
      scenario?: string;
    }>(request);
    const keys = orderKeys("gemini");
    if (keys.length === 0) {
      return NextResponse.json(
        {
          error: "No Gemini key is configured. Add GEMINI_API_KEYS to enable live voice.",
          code: "ai_unavailable",
        },
        { status: 503 },
      );
    }

    const entry = keys[0];
    const model = aiModels.live[0];
    const ai = new GoogleGenAI({ apiKey: entry.key, httpOptions: { apiVersion: "v1alpha" } });
    const now = Date.now();

    const mode = body.mode ?? "operator";
    const systemInstruction =
      mode === "roleplay"
        ? `You are playing an upset Indian customer in a 60-second BPO customer-support role-play (scenario: ${body.scenario ?? "missing ₹2,499 refund after 3 calls"}). Speak naturally in ${body.language === "hi" ? "Hindi" : body.language === "hinglish" ? "Hinglish" : "Indian English"}. Keep each turn to 1-2 short sentences. Soften if the candidate acknowledges your frustration and offers a clear next step. Never break character and never score the candidate during the call.`
        : mode === "interviewer"
          ? `You are Vaani, a calm, fair voice interviewer for Hirevoice. Speak in ${body.language === "hi" ? "Hindi" : body.language === "hinglish" ? "Hinglish" : "Indian English"}. Ask one structured question at a time, listen patiently, never judge accent, and never promise a hiring decision.`
          : `You are Vaani, the voice operator inside Hirevoice. The recruiter is ${ctx.actor}. Be brief, calm and concrete. Never invent candidate data. Never claim an email was sent or a meeting created; those actions need approval in the desk.`;

    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime: new Date(now + 30 * 60_000).toISOString(),
        newSessionExpireTime: new Date(now + 2 * 60_000).toISOString(),
        liveConnectConstraints: {
          model,
          config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction,
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: body.voice ?? "Aoede" },
              },
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
          },
        },
      },
    });

    return NextResponse.json(
      {
        token: token.name,
        model,
        expiresAt: new Date(now + 30 * 60_000).toISOString(),
        keyRef: entry.ref,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not mint a Live token";
    return NextResponse.json({ error: message, code: "live_unavailable" }, { status: 502 });
  }
}
