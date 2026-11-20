import type {
  CandidateLogistics,
  CandidateScore,
  DecisionKind,
  EvidencedQuote,
  EvidenceQualityParts,
  Language,
  LivenessCheck,
  RoleFitMatch,
  SkillId,
  SkillScore,
  TranscriptSegment,
} from "@/lib/types";

/**
 * Deterministic verification, PII redaction, prompt-injection shield,
 * liveness phrase check, and multi-role re-routing.
 *
 * Zero LLM calls live in this module: every check here is reproducible,
 * auditable, and covered by unit tests.
 */

const ZERO_WIDTH = /[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g;
const PUNCT = /[.,!?;:'"“”‘’()[\]{}—–\-।|/\\]+/g;

/** Unicode NFC + case + punctuation + whitespace normalisation safe for English & Devanagari. */
export function normaliseText(input: string): string {
  return input
    .normalize("NFC")
    .replace(ZERO_WIDTH, "")
    .toLowerCase()
    .replace(PUNCT, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenOverlapRatio(quoteNorm: string, segmentNorm: string): number {
  const qTokens = quoteNorm.split(" ").filter((t) => t.length > 1);
  if (qTokens.length === 0) return 0;
  const segSet = new Set(segmentNorm.split(" ").filter((t) => t.length > 1));
  let hits = 0;
  for (const token of qTokens) {
    if (segSet.has(token)) hits += 1;
  }
  return hits / qTokens.length;
}

export type QuoteVerificationResult = {
  verified: boolean;
  matchKind: "exact" | "near" | "unverified";
  reason?: string;
};

/**
 * Verifies that a model-cited quote actually appears in the cited CANDIDATE
 * transcript segment. Interviewer turns are never accepted as candidate evidence.
 */
export function verifySingleQuote(
  quote: string,
  segmentSeq: number,
  segments: TranscriptSegment[],
): QuoteVerificationResult {
  const trimmed = quote.trim();
  if (trimmed.length < 4) {
    return { verified: false, matchKind: "unverified", reason: "Quote too short" };
  }

  const segment = segments.find((s) => s.seq === segmentSeq);
  if (!segment) {
    return { verified: false, matchKind: "unverified", reason: `Segment #${segmentSeq} not found` };
  }
  if (segment.speaker !== "candidate") {
    return { verified: false, matchKind: "unverified", reason: "Interviewer turn cannot be cited as candidate evidence" };
  }

  const qNorm = normaliseText(trimmed);
  const sNorm = normaliseText(segment.text);
  if (!qNorm || !sNorm) {
    return { verified: false, matchKind: "unverified", reason: "Empty normalised text" };
  }

  if (sNorm.includes(qNorm)) {
    return { verified: true, matchKind: "exact" };
  }

  // Allow near-match when >= 90% of meaningful tokens appear in the same segment
  // (handles minor ASR punctuation/contraction drift without passing hallucinations).
  const overlap = tokenOverlapRatio(qNorm, sNorm);
  if (qNorm.split(" ").length >= 4 && overlap >= 0.9) {
    return { verified: true, matchKind: "near", reason: "High token overlap (>=90%)" };
  }

  return { verified: false, matchKind: "unverified", reason: "Quote not found in cited segment" };
}

/**
 * Runs deterministic verification across all skill items, attaching real timestamps
 * from the transcript and flagging skills with insufficient verified evidence.
 */
export function verifySkillScores(
  items: SkillScore[],
  segments: TranscriptSegment[],
): { items: SkillScore[]; verifiedCount: number; totalQuotes: number } {
  let verifiedCount = 0;
  let totalQuotes = 0;

  const checked = items.map((item) => {
    const verifiedEvidence: EvidencedQuote[] = item.evidence.map((ev, idx) => {
      totalQuotes += 1;
      const check = verifySingleQuote(ev.quote, ev.segmentSeq, segments);
      if (check.verified) verifiedCount += 1;
      const seg = segments.find((s) => s.seq === ev.segmentSeq);
      return {
        ...ev,
        id: ev.id || `${item.id}-${ev.segmentSeq}-${idx}`,
        tStartMs: seg?.tStartMs ?? ev.tStartMs ?? 0,
        tEndMs: seg?.tEndMs ?? ev.tEndMs ?? 0,
        verified: check.verified,
        matchKind: check.matchKind,
      };
    });

    const hasVerified = verifiedEvidence.some((e) => e.verified);
    return {
      ...item,
      evidence: verifiedEvidence,
      insufficientEvidence: item.insufficientEvidence || !hasVerified,
    };
  });

  return { items: checked, verifiedCount, totalQuotes };
}

/**
 * Computes deterministic evidence quality (0..1) and routing decision.
 * Never returns an automatic rejection — low scores route to human review or
 * feedback suggestion only.
 */
export function computeEvidenceAndDecision(input: {
  items: SkillScore[];
  segments: TranscriptSegment[];
  verifiedCount: number;
  totalQuotes: number;
  shortlistThreshold?: number;
  minEvidenceQuality?: number;
  injectionFlags?: string[];
}): {
  overall: number;
  evidenceQuality: number;
  confidenceParts: EvidenceQualityParts;
  decision: DecisionKind;
  reviewReasons: string[];
} {
  const shortlistThreshold = input.shortlistThreshold ?? 3.8;
  const minEvidenceQuality = input.minEvidenceQuality ?? 0.65;

  const candidateTurns = input.segments.filter((s) => s.speaker === "candidate");
  const totalWords = candidateTurns.reduce(
    (sum, seg) => sum + seg.text.trim().split(/\s+/).filter(Boolean).length,
    0,
  );

  const verifiedRatio = input.totalQuotes > 0 ? input.verifiedCount / input.totalQuotes : 0;
  const coveredSkills = input.items.filter((i) => !i.insufficientEvidence).length;
  const rubricCoverage = input.items.length > 0 ? coveredSkills / input.items.length : 0;
  const transcriptQuality = Math.min(1, Math.max(0.25, totalWords / 85));

  // Consistency: penalise extreme spread across skills when evidence is thin.
  const values = input.items.map((i) => i.value);
  const spread = values.length > 1 ? Math.max(...values) - Math.min(...values) : 0;
  const consistency = Math.max(0.45, Math.min(0.98, 0.96 - spread * 0.08));

  const evidenceQuality =
    Math.round(
      (verifiedRatio * 0.4 + rubricCoverage * 0.25 + transcriptQuality * 0.2 + consistency * 0.15) * 100,
    ) / 100;

  const active = input.items.filter((i) => !i.insufficientEvidence);
  const weightSum = active.reduce((acc, i) => acc + i.weight, 0) || 1;
  const overall =
    active.length > 0
      ? Math.round((active.reduce((acc, i) => acc + i.value * i.weight, 0) / weightSum) * 10) / 10
      : Math.round(
          (input.items.reduce((acc, i) => acc + i.value * i.weight, 0) /
            (input.items.reduce((acc, i) => acc + i.weight, 0) || 1)) *
            10,
        ) / 10;

  const reviewReasons: string[] = [];
  if (verifiedRatio < 1 && input.totalQuotes > 0) {
    reviewReasons.push(`${input.totalQuotes - input.verifiedCount} unverified quote(s) excluded`);
  }
  if (rubricCoverage < 1) {
    reviewReasons.push("Insufficient verified evidence on one or more skills");
  }
  if (totalWords < 35) {
    reviewReasons.push("Short transcript — human review recommended");
  }
  if (input.injectionFlags && input.injectionFlags.length > 0) {
    reviewReasons.push("Prompt-injection attempt flagged by Shield");
  }

  let decision: DecisionKind = "needs_review";
  if (
    evidenceQuality >= minEvidenceQuality &&
    overall >= shortlistThreshold &&
    (!input.injectionFlags || input.injectionFlags.length === 0)
  ) {
    decision = "shortlist_suggested";
  } else if (evidenceQuality >= minEvidenceQuality && overall < 2.6) {
    decision = "feedback_suggested";
  } else {
    decision = "needs_review";
  }

  return {
    overall,
    evidenceQuality,
    confidenceParts: {
      verifiedRatio: Math.round(verifiedRatio * 100) / 100,
      consistency: Math.round(consistency * 100) / 100,
      rubricCoverage: Math.round(rubricCoverage * 100) / 100,
      transcriptQuality: Math.round(transcriptQuality * 100) / 100,
    },
    decision,
    reviewReasons,
  };
}

/* ---------------------------------------------------------------------------
 * Prompt-Injection Shield (deterministic baseline)
 * ------------------------------------------------------------------------- */

const INJECTION_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /ignore\s+(all\s+)?(previous|prior|your|the)\s+(instructions|rubric|rules|prompts?)/i, label: "Instruction override attempt" },
  { pattern: /give\s+me\s+(a\s+)?(5|five|100|full\s+marks|top\s+score|perfect\s+score)/i, label: "Score manipulation attempt" },
  { pattern: /(system\s+prompt|developer\s+message|reveal\s+your\s+prompt|jailbreak)/i, label: "System prompt probe" },
  { pattern: /(shortlist\s+me\s+automatically|override\s+score|bypass\s+rubric)/i, label: "Routing override attempt" },
  { pattern: /(रूब्रिक\s*भूल\s*जाओ|मुझे\s*पूरे\s*नंबर\s*दो|5\s*में\s*से\s*5\s*दो)/i, label: "Hindi rubric override attempt" },
];

export function detectInjection(segments: TranscriptSegment[]): string[] {
  const flags = new Set<string>();
  for (const seg of segments) {
    if (seg.speaker !== "candidate") continue;
    for (const rule of INJECTION_PATTERNS) {
      if (rule.pattern.test(seg.text)) {
        flags.add(`${rule.label} (turn #${seg.seq})`);
      }
    }
  }
  return Array.from(flags);
}

/* ---------------------------------------------------------------------------
 * PII Redaction before scoring (never leaks phone/email/IDs to the scorer)
 * ------------------------------------------------------------------------- */

export function redactPii(text: string, candidateName?: string): { redacted: string; count: number } {
  let count = 0;
  let out = text;

  const replace = (re: RegExp, token: string) => {
    out = out.replace(re, () => {
      count += 1;
      return token;
    });
  };

  replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[EMAIL]");
  replace(/(?:\+91[\s-]?)?[6-9]\d{9}\b/g, "[PHONE]");
  replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, "[ID_NUMBER]");
  replace(/\b[A-Z]{5}\d{4}[A-Z]\b/g, "[PAN]");

  if (candidateName && candidateName.trim().length >= 3) {
    const escaped = candidateName.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    replace(new RegExp(`\\b${escaped}\\b`, "gi"), "[CANDIDATE]");
  }

  return { redacted: out, count };
}

/* ---------------------------------------------------------------------------
 * Anti-proxy liveness phrase check (technical signal only, never a score)
 * ------------------------------------------------------------------------- */

const LIVENESS_PHRASES = [
  "blue train forty two Tuesday",
  "green mango nineteen Friday",
  "silver river sixty one Monday",
  "yellow kite thirty five Sunday",
];

export function pickLivenessPhrase(seed?: string): string {
  if (!seed) return LIVENESS_PHRASES[0];
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return LIVENESS_PHRASES[hash % LIVENESS_PHRASES.length];
}

export function verifyLivenessPhrase(phrase: string, spoken?: string): LivenessCheck {
  if (!spoken || !spoken.trim()) {
    return {
      phrase,
      spoken: "",
      matched: false,
      note: "Technical flag: liveness phrase not captured (check mic or review manually).",
    };
  }
  const overlap = tokenOverlapRatio(normaliseText(phrase), normaliseText(spoken));
  const matched = overlap >= 0.6;
  return {
    phrase,
    spoken: spoken.trim(),
    matched,
    note: matched
      ? "Liveness phrase verified."
      : "Technical flag: liveness phrase did not match cleanly — human reviewer should verify audio.",
  };
}

/* ---------------------------------------------------------------------------
 * "Don't Reject, Re-Route" — Multi-Role BPO Mandate Matcher
 * ------------------------------------------------------------------------- */

type RoleProfile = {
  id: string;
  title: string;
  weights: Record<SkillId, number>;
  minOverall: number;
  requiresEnglish?: boolean;
  requiresNightShift?: boolean;
};

const BPO_MANDATES: RoleProfile[] = [
  {
    id: "role-support",
    title: "Customer Support Executive (Domestic Voice)",
    weights: { clarity: 0.3, empathy: 0.3, listening: 0.2, problem_solving: 0.2 },
    minOverall: 3.6,
  },
  {
    id: "role-intl-voice",
    title: "International Voice Support (US/UK)",
    weights: { clarity: 0.4, empathy: 0.2, listening: 0.2, problem_solving: 0.2 },
    minOverall: 4.1,
    requiresEnglish: true,
    requiresNightShift: true,
  },
  {
    id: "role-sales",
    title: "Inside Sales & Retention Associate",
    weights: { clarity: 0.3, empathy: 0.15, listening: 0.2, problem_solving: 0.35 },
    minOverall: 3.5,
  },
  {
    id: "role-backoffice",
    title: "Non-Voice Chat & Back-Office Support",
    weights: { clarity: 0.25, empathy: 0.2, listening: 0.25, problem_solving: 0.3 },
    minOverall: 3.2,
  },
];

export function evaluateRoleFits(input: {
  primaryRoleId: string;
  score: CandidateScore;
  language: Language;
  logistics?: CandidateLogistics;
}): RoleFitMatch[] {
  const bySkill = new Map<SkillId, number>();
  for (const item of input.score.items) {
    bySkill.set(item.id, item.value);
  }

  const matches: RoleFitMatch[] = BPO_MANDATES.map((mandate) => {
    const weighted =
      (bySkill.get("clarity") ?? 3) * mandate.weights.clarity +
      (bySkill.get("empathy") ?? 3) * mandate.weights.empathy +
      (bySkill.get("listening") ?? 3) * mandate.weights.listening +
      (bySkill.get("problem_solving") ?? 3) * mandate.weights.problem_solving;

    let penalty = 0;
    const notes: string[] = [];

    if (mandate.requiresNightShift && input.logistics?.nightShiftOk === false) {
      penalty += 0.6;
      notes.push("Prefers day shift");
    }
    if (mandate.requiresEnglish && input.language === "hi") {
      penalty += 0.5;
      notes.push("Interviewed in Hindi");
    }

    const fitScore = Math.max(1, Math.min(5, Math.round((weighted - penalty) * 10) / 10));
    const fitLabel: RoleFitMatch["fitLabel"] =
      fitScore >= mandate.minOverall
        ? "strong_fit"
        : fitScore >= mandate.minOverall - 0.5
          ? "good_fit"
          : "needs_review";

    const topSkill = [...input.score.items].sort((a, b) => b.value - a.value)[0];
    const reason =
      notes.length > 0
        ? `${notes.join(" · ")}. Strongest in ${topSkill?.label ?? "communication"} (${topSkill?.value.toFixed(1) ?? "3.0"}/5).`
        : fitLabel === "strong_fit"
          ? `Clears ${mandate.minOverall.toFixed(1)} bar — strongest in ${topSkill?.label ?? "empathy"} (${topSkill?.value.toFixed(1) ?? "4.0"}/5).`
          : `Slightly below ${mandate.minOverall.toFixed(1)} bar; recruiter review recommended.`;

    return {
      roleId: mandate.id,
      roleTitle: mandate.title,
      fitScore,
      fitLabel,
      reason,
      recommended: mandate.id !== input.primaryRoleId && fitLabel === "strong_fit",
    };
  });

  return matches.sort((a, b) => b.fitScore - a.fitScore);
}

/** Builds a no-API-required WhatsApp deep link (`wa.me`) for No-Show Killer reminders. */
export function buildWhatsappReminderUrl(input: {
  phone: string;
  candidateName: string;
  roleTitle: string;
  slotLabel?: string;
}): string {
  const digits = input.phone.replace(/\D/g, "");
  const normalized = digits.length === 10 ? `91${digits}` : digits || "919820000000";
  const text = input.slotLabel
    ? `Hi ${input.candidateName}, this is the hiring team for ${input.roleTitle}. Your next round is scheduled for ${input.slotLabel}. Please reply YES to confirm or let us know if you need another slot.`
    : `Hi ${input.candidateName}, thanks for completing your voice screen for ${input.roleTitle}! You have been shortlisted for the next round. Reply with your preferred time tomorrow to confirm your slot.`;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`;
}
