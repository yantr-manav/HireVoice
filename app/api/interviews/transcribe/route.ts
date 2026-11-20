import { NextResponse } from "next/server";
import { assertSameOrigin, jsonError } from "@/lib/api/http";
import { transcribeAudioWithGemini } from "@/lib/scoring/engine";
import type { Language } from "@/lib/types";

export const dynamic = "force-dynamic";

const MAX_BYTES = 18 * 1024 * 1024; // 18 MB inline Gemini audio safety cap

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const contentType = request.headers.get("content-type") || "";
    let audioBase64 = "";
    let mimeType = "audio/webm";
    let language: Language = "en";
    let diarize = false;
    let startSeq = 1;
    let baseOffsetMs = 0;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("audio");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "Missing audio file." }, { status: 400 });
      }
      if (file.size > MAX_BYTES) {
        return NextResponse.json({ error: "Audio exceeds 18 MB limit." }, { status: 413 });
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      audioBase64 = buffer.toString("base64");
      mimeType = file.type || "audio/webm";
      const langField = String(form.get("language") ?? "en");
      if (langField === "hi" || langField === "hinglish" || langField === "mr") language = langField;
      diarize = String(form.get("diarize") ?? "") === "true";
      startSeq = Number(form.get("startSeq") ?? 1) || 1;
      baseOffsetMs = Number(form.get("baseOffsetMs") ?? 0) || 0;
    } else {
      const body = (await request.json().catch(() => ({}))) as {
        audioBase64?: string;
        mimeType?: string;
        language?: Language;
        diarize?: boolean;
        startSeq?: number;
        baseOffsetMs?: number;
      };
      if (!body.audioBase64) {
        return NextResponse.json({ error: "Missing audioBase64 payload." }, { status: 400 });
      }
      audioBase64 = body.audioBase64;
      mimeType = body.mimeType || "audio/webm";
      language = body.language ?? "en";
      diarize = Boolean(body.diarize);
      startSeq = body.startSeq ?? 1;
      baseOffsetMs = body.baseOffsetMs ?? 0;
    }

    const result = await transcribeAudioWithGemini({
      audioBase64,
      mimeType,
      language,
      diarize,
      startSeq,
      baseOffsetMs,
    });

    return NextResponse.json(
      { ok: true, ...result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return jsonError(error);
  }
}
