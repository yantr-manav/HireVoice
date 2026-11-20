import "server-only";
import { GoogleGenAI } from "@google/genai";
import type { KeyFamily } from "@/lib/ai/keys";
import { markCooldown, modelChain, noteAttempt, orderKeys, recordUsage } from "@/lib/ai/keys";

export type GenerateOptions = {
  prompt: string;
  system?: string;
  family?: KeyFamily;
  model?: string | string[];
  temperature?: number;
  json?: boolean;
  maxOutputTokens?: number;
  /** Hard cap on network attempts across models and keys (free-tier safety). */
  maxAttempts?: number;
};

export type GenerateResult = {
  text: string;
  model: string;
  keyRef: string;
  family: KeyFamily;
  latencyMs: number;
};

export class AiUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiUnavailableError";
  }
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown model error";
  }
}

type Classification = { kind: "quota" | "invalid" | "busy" | "model" | "other"; ms: number };

function classify(message: string): Classification {
  const lower = message.toLowerCase();
  if (lower.includes("429") || lower.includes("resource_exhausted") || lower.includes("quota")) {
    const retry = message.match(/retry(?: in)?\s+([\d.]+)\s*s/i);
    const seconds = retry ? Number(retry[1]) : 0;
    return { kind: "quota", ms: Math.max(20_000, (Number.isFinite(seconds) ? seconds : 0) * 1000) };
  }
  if (
    lower.includes("api key not valid") ||
    lower.includes("api_key_invalid") ||
    lower.includes("invalid api key") ||
    lower.includes("401") ||
    lower.includes("403") ||
    lower.includes("permission denied")
  ) {
    return { kind: "invalid", ms: 60 * 60_000 };
  }
  if (lower.includes("404") || lower.includes("not found") || lower.includes("not supported")) {
    return { kind: "model", ms: 0 };
  }
  if (lower.includes("503") || lower.includes("500") || lower.includes("unavailable") || lower.includes("overloaded")) {
    return { kind: "busy", ms: 15_000 };
  }
  return { kind: "other", ms: 10_000 };
}

/**
 * Generates text across every configured key and a small model chain.
 * A quota error cools only one key, so a second free-tier key keeps working.
 */
export async function generate(options: GenerateOptions): Promise<GenerateResult> {
  const family = options.family ?? "gemini";
  const models = modelChain(family, options.model);
  const errors: string[] = [];
  const budget = Math.max(1, options.maxAttempts ?? 10);
  let attempts = 0;

  for (const model of models) {
    const keys = orderKeys(family, model);
    if (keys.length === 0) break;

    for (const entry of keys) {
      if (attempts >= budget) break;
      attempts += 1;
      const started = Date.now();
      try {
        const ai = new GoogleGenAI({ apiKey: entry.key });
        const isThinking25 = model.startsWith("gemini-2.5-");
        const response = await ai.models.generateContent({
          model,
          contents: options.prompt,
          config: {
            systemInstruction: options.system,
            temperature: options.temperature ?? 0.4,
            maxOutputTokens: Math.max(options.maxOutputTokens ?? 1200, options.json ? 512 : 256),
            ...(options.json ? { responseMimeType: "application/json" } : {}),
            ...(isThinking25 && options.json ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
          },
        });

        const text = response.text ?? "";
        if (!text.trim()) throw new Error("Model returned an empty response");

        recordUsage({
          ref: entry.ref,
          provider: entry.provider,
          model,
          status: "ok",
          latencyMs: Date.now() - started,
          inputChars: options.prompt.length,
          outputChars: text.length,
        });
        noteAttempt();
        return { text, model, keyRef: entry.ref, family: entry.provider, latencyMs: Date.now() - started };
      } catch (error) {
        const message = messageOf(error);
        const verdict = classify(message);
        recordUsage({
          ref: entry.ref,
          provider: entry.provider,
          model,
          status: verdict.kind === "quota" ? "quota" : "error",
          latencyMs: Date.now() - started,
          inputChars: options.prompt.length,
          outputChars: 0,
        });
        errors.push(`${model} · ${entry.label}: ${message.slice(0, 220)}`);
        console.warn(`[ai] ${model} (${entry.label}) failed [${verdict.kind}]: ${message.slice(0, 180)}`);

        if (verdict.kind === "model") break; // the model is gone; keep every key
        // An invalid key is dead for the whole hour; quota is per model only.
        markCooldown(entry.ref, verdict.ms, verdict.kind, verdict.kind === "quota" ? model : undefined);
      }
    }
    if (attempts >= budget) break;
  }

  throw new AiUnavailableError(
    `All configured models and keys were unavailable. ${errors.slice(0, 3).join(" | ")}`,
  );
}

export function parseJsonLoose<T>(text: string): T | null {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const attempts = [trimmed];
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) attempts.push(trimmed.slice(firstBrace, lastBrace + 1));
  const firstBracket = trimmed.indexOf("[");
  const lastBracket = trimmed.lastIndexOf("]");
  if (firstBracket >= 0 && lastBracket > firstBracket) attempts.push(trimmed.slice(firstBracket, lastBracket + 1));

  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt) as T;
    } catch {
      /* try the next shape */
    }
  }
  return null;
}

export async function generateJson<T>(options: GenerateOptions): Promise<{ data: T; result: GenerateResult } | null> {
  const result = await generate({ ...options, json: true, temperature: options.temperature ?? 0.2 });
  const data = parseJsonLoose<T>(result.text);
  if (!data) return null;
  return { data, result };
}
