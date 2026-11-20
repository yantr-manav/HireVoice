import "server-only";
import crypto from "node:crypto";
import { dbAll, dbGet, dbRun, nowIso } from "@/lib/db";
import type { AiStatus, ModelKeyStatus } from "@/lib/types";
import { aiModelPrimary, aiModels, gemmaFallbackChain, aiFallbackChain } from "@/lib/config";

export type KeyFamily = "gemini" | "gemma";

export type KeyEntry = {
  ref: string;
  key: string;
  provider: KeyFamily;
  label: string;
  order: number;
};

type PoolState = {
  cooldowns: Map<string, { until: number; reason: string }>;
  lastUsed: Map<string, number>;
  calls: Map<string, number>;
  failures: Map<string, number>;
  stickyIndex: number;
};

const globalRef = globalThis as typeof globalThis & { __hvKeyPool?: PoolState };

function state(): PoolState {
  if (!globalRef.__hvKeyPool) {
    globalRef.__hvKeyPool = {
      cooldowns: new Map(),
      lastUsed: new Map(),
      calls: new Map(),
      failures: new Map(),
      stickyIndex: 0,
    };
    // Hydrate cooldowns written by a previous process.
    try {
      const rows = dbAll<{ key_ref: string; cooldown_until: number; reason: string | null }>(
        "SELECT key_ref, cooldown_until, reason FROM key_cooldowns WHERE cooldown_until > ?",
        Date.now(),
      );
      for (const row of rows) {
        globalRef.__hvKeyPool.cooldowns.set(row.key_ref, {
          until: row.cooldown_until,
          reason: row.reason ?? "cooling",
        });
      }
    } catch {
      /* database may not be ready yet */
    }
  }
  return globalRef.__hvKeyPool;
}

function hashKey(key: string) {
  return crypto.createHash("sha256").update(key).digest("hex").slice(0, 10);
}

function splitKeys(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[\s,;]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 12);
}

function numbered(prefix: string, max = 12): string[] {
  const found: string[] = [];
  for (let index = 1; index <= max; index += 1) {
    const value = process.env[`${prefix}_${index}`];
    if (value) found.push(value.trim());
  }
  return found;
}

/**
 * Accepts the shapes people actually use for multiple free-tier keys:
 *   GEMINI_API_KEYS="key1,key2"
 *   GEMINI_API_KEY=key1 / GEMINI_API_KEY_1=... / GEMINI_API_KEY_2=...
 *   GOOGLE_AI_API_KEYS / GOOGLE_GENAI_API_KEY / GEMMA_API_KEYS
 */
export function readKeyPool(): KeyEntry[] {
  const entries: KeyEntry[] = [];
  const seen = new Set<string>();

  const push = (key: string, provider: KeyFamily, label: string) => {
    const trimmed = key.trim();
    if (!trimmed || trimmed.length < 12) return;
    const ref = `${provider}:${hashKey(trimmed)}`;
    if (seen.has(ref)) return;
    seen.add(ref);
    entries.push({ ref, key: trimmed, provider, label, order: entries.length });
  };

  const geminiRaw = [
    ...splitKeys(process.env.GEMINI_API_KEYS),
    ...splitKeys(process.env.GOOGLE_AI_API_KEYS),
    ...splitKeys(process.env.GOOGLE_GENAI_API_KEYS),
    ...splitKeys(process.env.GEMINI_API_KEY),
    ...(process.env.GOOGLE_AI_API_KEY ? [process.env.GOOGLE_AI_API_KEY] : []),
    ...(process.env.GOOGLE_GENAI_API_KEY ? [process.env.GOOGLE_GENAI_API_KEY] : []),
    ...splitKeys(process.env.GEMINI_KEY),
    ...numbered("GEMINI_API_KEY"),
    ...numbered("GOOGLE_AI_API_KEY"),
  ];
  geminiRaw.forEach((key, index) => push(key, "gemini", `Gemini key ${index + 1}`));

  const gemmaRaw = [
    ...splitKeys(process.env.GEMMA_API_KEYS),
    ...splitKeys(process.env.GEMMA_KEYS),
    ...(process.env.GEMMA_API_KEY ? [process.env.GEMMA_API_KEY] : []),
    ...numbered("GEMMA_API_KEY"),
  ];
  gemmaRaw.forEach((key, index) => push(key, "gemma", `Gemma key ${index + 1}`));

  return entries;
}

function isCooling(ref: string, model?: string) {
  const scoped = scopedRef(ref, model);
  // A key can be cooled globally (invalid key) or for one model (quota).
  for (const candidate of model ? [scoped, ref] : [ref]) {
    const entry = state().cooldowns.get(candidate);
    if (!entry) continue;
    if (entry.until <= Date.now()) {
      state().cooldowns.delete(candidate);
      continue;
    }
    return true;
  }
  return false;
}

function scopedRef(ref: string, model?: string) {
  return model ? `${ref}::${model}` : ref;
}

export function markCooldown(ref: string, ms: number, reason: string, model?: string) {
  const until = Date.now() + ms;
  ref = scopedRef(ref, model);
  state().cooldowns.set(ref, { until, reason });
  try {
    dbRun(
      `INSERT INTO key_cooldowns (key_ref, cooldown_until, reason, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(key_ref) DO UPDATE SET cooldown_until = excluded.cooldown_until, reason = excluded.reason, updated_at = excluded.updated_at`,
      ref,
      until,
      reason,
      nowIso(),
    );
  } catch {
    /* non-fatal */
  }
}

export function recordUsage(input: {
  ref: string;
  provider: KeyFamily;
  model: string;
  status: "ok" | "error" | "quota";
  latencyMs: number;
  inputChars: number;
  outputChars: number;
}) {
  const pool = state();
  pool.lastUsed.set(input.ref, Date.now());
  if (input.status === "ok") pool.calls.set(input.ref, (pool.calls.get(input.ref) ?? 0) + 1);
  else pool.failures.set(input.ref, (pool.failures.get(input.ref) ?? 0) + 1);

  try {
    dbRun(
      `INSERT INTO model_usage (key_ref, provider, model, status, latency_ms, input_chars, output_chars, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      input.ref,
      input.provider,
      input.model,
      input.status,
      Math.round(input.latencyMs),
      input.inputChars,
      input.outputChars,
      nowIso(),
    );
  } catch {
    /* usage telemetry is best effort */
  }
}

/**
 * Rotates across every key in the family. Gemma requests can fall back to
 * Gemini keys because AI Studio serves both model families from one key.
 */
export function orderKeys(family: KeyFamily, model?: string): KeyEntry[] {
  const pool = readKeyPool();
  const primary = pool.filter((entry) => entry.provider === family);
  const secondary = family === "gemma" ? pool.filter((entry) => entry.provider === "gemini") : [];
  const ordered = [...primary, ...secondary];

  const healthy = ordered.filter((entry) => !isCooling(entry.ref, model));
  if (healthy.length > 0) {
    if (healthy.length <= 1) return healthy;
    const sticky = state().stickyIndex % healthy.length;
    return [...healthy.slice(sticky), ...healthy.slice(0, sticky)];
  }

  const cooling = ordered
    .filter((entry) => isCooling(entry.ref, model))
    .sort(
      (a, b) =>
        (state().cooldowns.get(scopedRef(a.ref, model))?.until ?? 0) -
        (state().cooldowns.get(scopedRef(b.ref, model))?.until ?? 0),
    );
  return cooling;
}

export function noteAttempt() {
  state().stickyIndex += 1;
}

/** Preferred model first, then the role's fallback list, then the safe chain. */
export function modelChain(family: KeyFamily, preferred?: string | string[]): string[] {
  const requested = Array.isArray(preferred) ? preferred : preferred ? [preferred] : [];
  const role = family === "gemma" ? aiModels.gemma : aiModels.fast;
  const chain =
    family === "gemma"
      ? [...requested, ...role, ...gemmaFallbackChain]
      : [...requested, ...role, ...aiFallbackChain];
  return Array.from(new Set(chain.filter((model): model is string => Boolean(model))));
}

export function aiConfigured() {
  return readKeyPool().length > 0;
}

export function cooldownLabel(ms: number) {
  if (ms <= 60_000) return "about a minute";
  if (ms <= 3_600_000) return `${Math.round(ms / 60_000)} minutes`;
  return `${Math.round(ms / 3_600_000)} hours`;
}

export async function aiStatus(): Promise<AiStatus> {
  const pool = readKeyPool();
  let lastCall: AiStatus["lastCall"] = null;
  try {
    const row = dbGet<{ model: string; created_at: string; status: string }>(
      "SELECT model, created_at, status FROM model_usage ORDER BY id DESC LIMIT 1",
    );
    if (row) lastCall = { model: row.model, at: row.created_at, status: row.status };
  } catch {
    /* ignore */
  }

  const keys: ModelKeyStatus[] = pool.map((entry) => {
    const cooling = isCooling(entry.ref);
    const cooldown = state().cooldowns.get(entry.ref);
    return {
      ref: entry.ref,
      provider: entry.provider,
      label: entry.label,
      cooling,
      cooldownUntil: cooling && cooldown ? new Date(cooldown.until).toISOString() : null,
      calls: state().calls.get(entry.ref) ?? 0,
      failures: state().failures.get(entry.ref) ?? 0,
    };
  });

  return {
    configured: pool.length > 0,
    liveReady: pool.some((entry) => entry.provider === "gemini"),
    provider: pool.length > 0 ? "google-ai-studio" : "none",
    models: [
      { id: aiModelPrimary.fast, label: "Fast reasoning", family: "gemini", role: "Voice commands, drafts" },
      { id: aiModelPrimary.deep, label: "Deep reasoning", family: "gemini", role: "Long rubric, migration" },
      { id: aiModelPrimary.small, label: "Cheap fallback", family: "gemini", role: "Parsing, summaries" },
      { id: aiModelPrimary.gemma, label: "Gemma 4", family: "gemma", role: "Offline-friendly drafts" },
      { id: aiModelPrimary.live, label: "Gemini Live", family: "gemini", role: "Realtime interviewer" },
    ],
    keys,
    lastCall,
  };
}
