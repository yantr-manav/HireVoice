import { candidates, roles } from "@/lib/demo/data";
import { aiConfigured } from "@/lib/ai/keys";
import { generateJson } from "@/lib/ai/gemini";
import { apiContext, assertSameOrigin, jsonError, jsonOk, readJson } from "@/lib/api/http";
import { feedbackEmail, followUpEmail, generalEmail, inviteEmail, schedulingEmail } from "@/lib/agent/templates";
import { addDays, formatIstRange, istAt, istDateKey, startOfIstDay } from "@/lib/time";

export const dynamic = "force-dynamic";

type Purpose = "invite" | "feedback" | "schedule" | "followup" | "general";

type DraftResponse = { subject: string; body: string; source: "gemini" | "gemma" | "template"; model: string | null };

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const ctx = await apiContext();
    const input = await readJson<{
      purpose?: Purpose;
      candidateId?: string;
      instructions?: string;
      tone?: "warm" | "direct";
    }>(request);

    const purpose: Purpose = input.purpose ?? "general";
    const candidate = candidates.find((entry) => entry.id === input.candidateId) ?? null;
    const role = candidate ? roles.find((entry) => entry.id === candidate.roleId) : null;
    const roleTitle = role?.title ?? candidate?.roleTitle ?? "Customer Support Executive";

    const base = startOfIstDay(new Date());
    const slots = [
      formatIstRange(istAt(istDateKey(addDays(base, 1)), 15, 0), istAt(istDateKey(addDays(base, 1)), 15, 30)),
      formatIstRange(istAt(istDateKey(addDays(base, 4)), 11, 0), istAt(istDateKey(addDays(base, 4)), 11, 30)),
    ];

    let subject = `Next step: ${roleTitle} at Northstar BPO`;
    let body = "";
    if (purpose === "invite") body = inviteEmail(candidate?.name ?? "there", roleTitle);
    else if (purpose === "feedback")
      body = feedbackEmail(
        candidate?.name ?? "there",
        roleTitle,
        "you stayed calm and asked a clarifying question before answering.",
        candidate?.score.items.find((item) => item.insufficientEvidence)?.label.toLowerCase() ?? null,
      );
    else if (purpose === "schedule") {
      subject = `Interview times · ${roleTitle}`;
      body = schedulingEmail(candidate?.name ?? "there", roleTitle, slots);
    } else if (purpose === "followup") {
      subject = `Update on your ${roleTitle} application`;
      body = followUpEmail(candidate?.name ?? "there", roleTitle);
    } else {
      subject = `About your ${roleTitle} application`;
      body = generalEmail(candidate?.name ?? "there", roleTitle);
    }

    if (aiConfigured()) {
      const system =
        "You draft short, plain-text recruiting email for a BPO team in India. Sentence case, no marketing language, no emoji, no scores or rankings. Never claim a decision was made. Sign as Meera, Northstar BPO. Return JSON only: {\"subject\":\"...\",\"body\":\"...\"}. Keep the body under 170 words.";
      const prompt = `Purpose: ${purpose}
Candidate: ${candidate?.name ?? "no specific candidate"} <${candidate?.email ?? "n/a"}>
Role: ${roleTitle}
Tone: ${input.tone ?? "warm"}
Recruiter notes: ${input.instructions || "none"}
Available interview slots: ${slots.join(" or ")}
Write the email.`;
      try {
        const generated = await generateJson<{ subject?: string; body?: string }>({
          system,
          prompt,
          temperature: 0.5,
          maxOutputTokens: 800,
        });
        if (generated?.data?.body && generated.data.body.trim().length > 30) {
          return jsonOk({
            subject: generated.data.subject?.trim() || subject,
            body: generated.data.body.trim(),
            source: generated.result.model.toLowerCase().includes("gemma") ? "gemma" : "gemini",
            model: generated.result.model,
          } satisfies DraftResponse);
        }
      } catch {
        /* template fallback */
      }
    }

    return jsonOk({ subject, body, source: "template", model: null } satisfies DraftResponse);
  } catch (error) {
    return jsonError(error);
  }
}
