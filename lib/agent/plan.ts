import "server-only";
import type { AgentAction, AgentPlan, AgentActionSource } from "@/lib/types";
import { candidates, roles, workspace as demoWorkspace } from "@/lib/demo/data";
import { createAction, getAction, listPendingActions, updateAction } from "@/lib/db/repo";
import { aiConfigured } from "@/lib/ai/keys";
import { generateJson } from "@/lib/ai/gemini";
import { aiModels } from "@/lib/config";
import { googleConnection } from "@/lib/google/auth";
import { addDays, formatIstTime, istDateKey, istParts, startOfIstDay } from "@/lib/time";
import {
  executeTool,
  toolDefinitions,
  toolNames,
  toolSummary,
  ToolError,
  type ToolContext,
} from "@/lib/agent/tools";

const MAX_STEPS = 4;

type RawStep = { tool?: unknown; args?: unknown };
type RawPlan = { intent?: unknown; summary?: unknown; steps?: unknown };

async function buildContext(ctx: ToolContext) {
  const google = await googleConnection(ctx.owner);
  const pending = await listPendingActions();
  const today = istDateKey(new Date());

  const candidateLines = candidates
    .map(
      (candidate) =>
        `- ${candidate.name} · ${candidate.alias} · ${candidate.email} · ${candidate.stage.replace(/_/g, " ")} · ${candidate.score.overall.toFixed(1)}/5 · ${candidate.roleTitle}`,
    )
    .join("\n");

  return `Today is ${today}, timezone Asia/Kolkata (IST). Recruiter: ${ctx.actor} <${ctx.email || "unknown"}>.
Google Workspace: ${google.connected ? `connected as ${google.email}` : "not connected (read/write actions will be simulated)"}.
Pending approvals: ${pending.length}.
Roles:
${roles.map((role) => `- ${role.title} · ${role.status} · ${role.shortlisted} shortlisted`).join("\n")}

Candidates:
${candidateLines}

Tools:
${toolDefinitions
  .map(
    (tool) =>
      `- ${tool.name} (${tool.mutating ? "write, needs approval" : "read"}) — ${tool.description} args: ${JSON.stringify(tool.args)}`,
  )
  .join("\n")}`;
}

const SYSTEM = `You are Vaani, the voice-first recruiting operator inside Hirevoice.
Turn one spoken recruiter command into a small plan of tool calls.

Rules:
- Only use tools from the list. Never invent a tool or a candidate email.
- Prefer the fewest steps. 1 to 3 steps is normal.
- NEVER perform any deletion, removal, trashing, purging, or erasing of emails, files, sheets, forms, events, or candidates. If the user asks to delete anything, return zero steps and explain that deletion is disabled for safety.
- If the recruiter names a candidate, pass their exact name as "query"; the server resolves it.
- For "create a sheet named X" use create_sheet with title X (keep the spoken title exactly). For "create a folder named X" use create_folder. For notes use create_doc.
- For "create an application form for X" use create_application_form with roleTitle X. For "set up a hiring kit for X" use create_hiring_kit. For "export form responses to sheet" use export_form_to_sheet. For "generate offer letter for X" use generate_offer_letter.
- For cleaning messy data, fixing phone numbers/emails/cities/stages, or deduplicating rows in a Google Sheet, use clean_sheet (this is non-destructive: it creates a new Cleaned tab and never deletes the raw tab). For inspecting a sheet's data quality use read_sheet. For listing sheets use list_sheets.
- For "add", "book", "schedule", compute concrete ISO 8601 start and end in +05:30 from the current date. Default duration is 30 minutes.
- Never claim an external action already happened. Write tools are proposals that a human approves.
- Never send a rejection email. "Reject" means record a decision (close_candidate) and optionally draft feedback later.
- If the command is a question about the workspace, use a read tool. If it is navigation, use navigate.
- If nothing fits, return zero steps and a short honest summary.

Return JSON only:
{"intent":"3-6 words","summary":"one sentence, sentence case","steps":[{"tool":"tool_name","args":{}}]}`;

const DELETE_GUARD_PATTERN =
  /\b(delete|remove|trash|erase|wipe|purge|destroy|drop|clear all|permanently remove)\b/i;

function isDeletionRequest(transcript: string): boolean {
  const lower = transcript.toLowerCase();
  if (!DELETE_GUARD_PATTERN.test(lower)) return false;
  // Allow benign phrasing like "remove from inbox" (archive) only if explicitly saying archive
  if (/\barchive\b/i.test(lower) && !/\bdelete\b/i.test(lower)) return false;
  // Allow non-destructive spreadsheet hygiene ("remove duplicates", "remove blank rows", "remove extra spaces")
  // since clean_sheet writes to a brand-new Cleaned tab and preserves the raw tab untouched.
  if (
    /(sheet|spreadsheet|leads|tracker|data|table)/i.test(lower) &&
    /(duplicate|duplicates|blank rows|empty rows|extra spaces|whitespace)/i.test(lower) &&
    !/\b(delete|erase|wipe|purge|destroy|drop)\s+(the\s+|this\s+|my\s+)?(sheet|spreadsheet|file|tab|folder)/i.test(lower)
  ) {
    return false;
  }
  return true;
}

export async function planCommand(transcript: string, ctx: ToolContext): Promise<AgentPlan> {
  const clean = transcript.trim().slice(0, 800);
  if (!clean) throw new ToolError("Say a command, for example: shortlist Sana and schedule her interview tomorrow at 3.");

  // Hard safety guardrail: voice commands can execute everything EXCEPT any deletion.
  if (isDeletionRequest(clean)) {
    return {
      id: `plan_blocked_${Date.now()}`,
      transcript: clean,
      intent: "Deletion blocked",
      summary:
        "Deletion is disabled via voice commands to protect candidate records and Google Workspace files. You can archive emails, mark a candidate as 'not moving forward', or remove files manually in Google Drive.",
      source: "fallback",
      model: null,
      steps: [],
    };
  }

  let source: AgentActionSource = "fallback";
  let model: string | null = null;
  let intent = "Workspace command";
  let summary = "";
  let rawSteps: { tool: string; args: Record<string, unknown> }[] = [];

  if (aiConfigured()) {
    try {
      const response = await generateJson<RawPlan>({
        system: SYSTEM,
        prompt: `${await buildContext(ctx)}\n\nRecruiter said: "${clean}"`,
        temperature: 0.15,
        maxOutputTokens: 900,
        model: aiModels.command,
      });
      if (response) {
        const raw = response.data;
        source = response.result.model.toLowerCase().includes("gemma") ? "gemma" : "gemini";
        model = response.result.model;
        intent = typeof raw.intent === "string" && raw.intent.trim() ? raw.intent.trim() : intent;
        summary = typeof raw.summary === "string" ? raw.summary.trim() : "";
        rawSteps = sanitizeSteps(raw.steps);
      }
    } catch (error) {
      summary = `Model routing unavailable (${error instanceof Error ? error.message.slice(0, 120) : "unknown error"}). Used the local command parser.`;
    }
  }

  if (rawSteps.length === 0) {
    const fallback = fallbackPlan(clean);
    rawSteps = fallback.steps;
    intent = fallback.intent;
    summary = fallback.summary;
    source = "fallback";
  }

  if (summary.length === 0) {
    summary = rawSteps.length > 0 ? "Here is what I will do. Nothing external runs until you approve it." : "I did not catch a workspace action. Try “who needs review” or “schedule Sana tomorrow at 3”.";
  }

  const actions: AgentAction[] = [];
  for (const step of rawSteps.slice(0, MAX_STEPS)) {
    const definition = toolDefinitions.find((tool) => tool.name === step.tool);
    if (!definition) continue;
    const action = await createAction({
      transcript: clean,
      intent,
      tool: step.tool,
      args: step.args,
      mutating: definition.mutating,
      summary: toolSummary(step.tool, step.args),
      actor: ctx.actor,
      source,
      status: "proposed",
    });
    actions.push(action);
  }

  // Read-only steps run immediately. Write steps stay proposed for approval.
  const hydrated: AgentAction[] = [];
  for (const action of actions) {
    if (!action.mutating) {
      try {
        const result = await executeTool(action.tool, action.args, ctx);
        const updated = await updateAction(action.id, { status: "executed", result, error: null });
        hydrated.push(updated ?? action);
      } catch (error) {
        const updated = await updateAction(action.id, {
          status: "failed",
          error: error instanceof Error ? error.message : "Tool failed",
          result: { ok: false, title: "Could not complete", detail: error instanceof Error ? error.message : "Tool failed" },
        });
        hydrated.push(updated ?? action);
      }
    } else {
      hydrated.push(action);
    }
  }

  return {
    id: hydrated[0]?.id ?? `plan_${Date.now()}`,
    transcript: clean,
    intent,
    summary,
    source,
    model,
    steps: hydrated,
  };
}

function sanitizeSteps(input: unknown): { tool: string; args: Record<string, unknown> }[] {
  if (!Array.isArray(input)) return [];
  const steps: { tool: string; args: Record<string, unknown> }[] = [];
  for (const raw of input.slice(0, MAX_STEPS)) {
    if (!raw || typeof raw !== "object") continue;
    const step = raw as RawStep;
    const tool = typeof step.tool === "string" ? step.tool : "";
    if (!toolNames.has(tool)) continue;
    const args =
      step.args && typeof step.args === "object" && !Array.isArray(step.args)
        ? (step.args as Record<string, unknown>)
        : {};
    steps.push({ tool, args });
  }
  return steps;
}

function knownCandidate(transcript: string) {
  const padded = ` ${transcript.toLowerCase()} `;
  const found = candidates
    .map((candidate) => {
      const name = candidate.name.toLowerCase();
      const first = name.split(" ")[0];
      const full = padded.indexOf(name);
      const index = full >= 0 ? full : padded.indexOf(` ${first} `);
      return { candidate, index };
    })
    .filter((entry) => entry.index >= 0)
    .sort((a, b) => a.index - b.index);
  return found[0]?.candidate ?? null;
}

function dayFromText(text: string): Date {
  const lower = text.toLowerCase();
  const base = startOfIstDay(new Date());
  if (lower.includes("today")) return base;
  if (lower.includes("tomorrow")) return addDays(base, 1);
  if (lower.includes("day after")) return addDays(base, 2);

  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const parts = istParts(base);
  for (let index = 0; index < days.length; index += 1) {
    if (lower.includes(days[index])) {
      const delta = (index - parts.weekday + 7) % 7 || 7;
      return addDays(base, delta);
    }
  }
  return addDays(base, 1);
}

type When = { start: Date; end: Date };

function whenFromText(text: string): When | null {
  const lower = text.toLowerCase();
  const dayToken = /(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i.test(text);
  const atMatch = lower.match(/\b(?:at|@)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  const colonMatch = lower.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  const meridiemMatch = lower.match(/\b(\d{1,2})\s*(am|pm)\b/i);
  const match = atMatch ?? colonMatch ?? meridiemMatch;
  if (!match && !dayToken) return null;

  const day = dayFromText(text);
  const durationMatch = lower.match(/(\d{1,3})\s*(?:min|minute|minutes)/);
  const hourDuration = lower.match(/(\d+)\s*(?:hour|hr|hours)/);
  const duration = durationMatch
    ? Number(durationMatch[1])
    : hourDuration
      ? Number(hourDuration[1]) * 60
      : 30;

  let hour = match ? Number(match[1]) : 10;
  const minute = match ? Number(match[2] ?? 0) : 0;
  const meridiem = match?.[3]?.toLowerCase();
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  if (!meridiem && hour > 0 && hour < 8) hour += 12; // "at 3" usually means 3 PM
  if (!Number.isFinite(hour) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  const start = new Date(day.getTime() + (hour * 60 + minute) * 60_000);
  return { start, end: new Date(start.getTime() + duration * 60_000) };
}

function localIso(date: Date) {
  const parts = istParts(date);
  return `${parts.key}T${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}:00+05:30`;
}

/** Pulls the spoken name out of "create a sheet named X" and similar. */
function spokenName(transcript: string, kind: RegExp): string {
  const named =
    transcript.match(/(?:named|called|titled|with (?:the )?name|name)\s*:?\s*["“'”]([^"”']+)["“'”]/i) ||
    transcript.match(/(?:named|called|titled|with (?:the )?name|name)\s*:?\s+(.+)$/i);
  if (named?.[1]) {
    return cleanName(named[1]);
  }

  const withoutKind = transcript
    .replace(/\b(?:please|hey|vaani|can you|could you|i want to|i need to|go ahead and)\b/gi, " ")
    .replace(/\b(?:create|make|start|add|new|open)\b/gi, " ")
    .replace(kind, " ")
    .replace(/\b(?:a|an|the|google|drive|workspace)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleanName(withoutKind);
}

function cleanName(value: string) {
  return value
    .replace(/^(?:named|called|titled|name)\s*:?\s*/i, "")
    .replace(/\s+(?:in|on|inside)\s+(?:my\s+)?(?:google\s+)?(?:drive|workspace|folder).*$/i, "")
    .replace(/\s+(?:and|then)\s+.*$/i, "")
    .replace(/[.?!,;:]+$/g, "")
    .replace(/^["“'”\s]+|["“'”\s]+$/g, "")
    .trim()
    .slice(0, 120);
}

function sheetPlan(transcript: string) {
  if (!/(sheet|spreadsheet)/i.test(transcript)) return null;
  if (!/(create|make|start|add|new|set up|build)/i.test(transcript)) return null;
  const title = spokenName(transcript, /\b(?:google\s+)?(?:sheet|spreadsheet)s?\b/gi);
  return {
    intent: "Create Google Sheet",
    summary: `I can create the sheet “${title || "Hiring tracker"}” in your Google Drive. You approve before it is created.`,
    steps: [
      {
        tool: "create_sheet",
        args: { title: title || "Hiring tracker" },
      },
    ],
  };
}

function folderPlan(transcript: string) {
  if (!/(folder|directory)/i.test(transcript)) return null;
  if (!/(create|make|add|new|set up)/i.test(transcript)) return null;
  const name = spokenName(transcript, /\b(?:google\s+)?(?:drive\s+)?(?:folder|directory)\b/gi);
  return {
    intent: "Create Drive folder",
    summary: `I can create the Drive folder “${name || "Hiring"}”. You approve before it is created.`,
    steps: [{ tool: "create_folder", args: { name: name || "Hiring" } }],
  };
}

function fallbackPlan(transcript: string): {
  intent: string;
  summary: string;
  steps: { tool: string; args: Record<string, unknown> }[];
} {
  const lower = transcript.toLowerCase();
  const candidate = knownCandidate(transcript);
  const name = candidate?.name;
  const when = whenFromText(transcript);

  if (/(review queue|who needs review|waiting for review|needs review|what needs me|my queue)/.test(lower)) {
    return {
      intent: "Review queue",
      summary: "Pulling the candidates who are waiting for a human decision.",
      steps: [{ tool: "list_review_queue", args: {} }],
    };
  }

  if (/(pending approval|approvals|what.*approve|waiting for approval)/.test(lower)) {
    return {
      intent: "Approvals",
      summary: "Checking what is waiting for your approval.",
      steps: [{ tool: "list_approvals", args: {} }],
    };
  }

  if (/(dashboard|metrics|how many|stats|funnel|completion rate)/.test(lower)) {
    return {
      intent: "Workspace metrics",
      summary: "Reading this week's workspace numbers.",
      steps: [{ tool: "workspace_metrics", args: {} }],
    };
  }

  if (
    /(clean|fix|normalize|standardize|deduplicate|dedupe|tidy|polish|sanitize|format)/.test(lower) &&
    /(sheet|spreadsheet|data|leads|tracker|table|rows|phones|emails|duplicates)/.test(lower)
  ) {
    const sheetMatch = transcript.match(/(?:in|on|for)\s+(?:the\s+|my\s+)?["“']?([^"”']+?)["”']?(?:\s+sheet|\s+spreadsheet|\s+tracker|$)/i);
    const sheetRef = cleanName(sheetMatch?.[1] ?? "").replace(/\b(messy|data|sheet|spreadsheet|latest|this|my)\b/gi, "").trim();
    const target = /new\s+(?:google\s+)?sheet/i.test(lower) ? "new_sheet" : "new_tab";
    return {
      intent: "Clean messy sheet",
      summary: `I can clean messy data${sheetRef ? ` in “${sheetRef}”` : ""} (names, +91 phones, emails, cities, stages, blank rows & duplicates) and save the result safely into a new ${target === "new_sheet" ? "Google Sheet" : "Cleaned tab"} without touching your raw data. Approve to run.`,
      steps: [
        {
          tool: "clean_sheet",
          args: {
            ...(sheetRef ? { sheet: sheetRef } : {}),
            instruction: transcript,
            target,
          },
        },
      ],
    };
  }

  if (/(audit|inspect|check|read|scan).*(sheet|spreadsheet|tracker)/.test(lower)) {
    const sheetMatch = transcript.match(/(?:sheet|spreadsheet|tracker)\s+(?:named|called)?\s*["“']?([^"”']+)["”']?/i);
    const sheetRef = cleanName(sheetMatch?.[1] ?? "");
    return {
      intent: "Audit Google Sheet",
      summary: "Scanning your Google Sheet for row counts, messy cells, duplicates, and contact issues.",
      steps: [{ tool: "read_sheet", args: sheetRef ? { sheet: sheetRef } : {} }],
    };
  }

  if (/(list|show|my)\s+(google\s+)?sheets\b/.test(lower) && !/(open|go to|take me)/.test(lower)) {
    return {
      intent: "List Google Sheets",
      summary: "Listing your Google Sheets from Drive and HireVoice.",
      steps: [{ tool: "list_sheets", args: {} }],
    };
  }

  const sheet = sheetPlan(transcript);
  if (sheet) return sheet;

  const folder = folderPlan(transcript);
  if (folder) return folder;

  if (/(my calendar|calendar|schedule|what.*today|what.*tomorrow|meetings)/.test(lower) && !when) {
    const days = /tomorrow/.test(lower) ? 2 : /week/.test(lower) ? 7 : 1;
    return {
      intent: "Calendar",
      summary: "Checking your calendar.",
      steps: [{ tool: "calendar_range", args: { days } }],
    };
  }

  if (/(\bread\b|what does .* say|latest (mail|email|message))/.test(lower) && /(mail|email|message|inbox)/.test(lower)) {
    const query = /(?:from|about)\s+/i.test(transcript)
      ? transcript.replace(/.*(?:from|about)\s+/i, "").trim()
      : "";
    return {
      intent: "Read mail",
      summary: query ? `Opening the latest message matching “${query}”.` : "Opening the latest message.",
      steps: [{ tool: "mail_read", args: query ? { query } : {} }],
    };
  }

  if (/(search|find|check|show).*(mail|inbox|email)|any (mail|email)|unread/.test(lower)) {
    const query = transcript.replace(/.*(?:mail|inbox|email|for|about|from)\s*/i, "").trim();
    return {
      intent: "Search mail",
      summary: "Searching the inbox.",
      steps: [{ tool: "mail_search", args: { query: query || "" } }],
    };
  }

  if (/(feedback|rejection note|reply to)/.test(lower) && name) {
    return {
      intent: "Draft feedback",
      summary: `Preparing feedback for ${name} as a draft. You approve before it is saved or sent.`,
      steps: [{ tool: "draft_feedback", args: { query: name } }],
    };
  }

  if (/(invite|send.*(link|assessment))/.test(lower) && name) {
    return {
      intent: "Send invite",
      summary: `Preparing the interview invite for ${name}. You approve before it sends.`,
      steps: [{ tool: "send_invite", args: { query: name } }],
    };
  }

  if (/(schedule|book|set up|arrange)/.test(lower) && when) {
    return {
      intent: "Schedule interview",
      summary: `I can book ${name ?? "the interview"} for ${formatIstTime(when.start)}–${formatIstTime(when.end)} IST. Confirm to create it.`,
      steps: [
        {
          tool: "schedule_interview",
          args: {
            ...(name ? { query: name } : {}),
            start: localIso(when.start),
            end: localIso(when.end),
            meet: true,
          },
        },
      ],
    };
  }

  if (/(shortlist|move forward|move ahead|advance|put .* through)/.test(lower) && name) {
    return {
      intent: "Shortlist candidate",
      summary: `${name} will be shortlisted in this workspace. No email is sent.`,
      steps: [{ tool: "shortlist_candidate", args: { query: name } }],
    };
  }

  if (/(reject|not moving forward|decline|close|turn down)/.test(lower) && name) {
    return {
      intent: "Record decision",
      summary: `I can record that ${name} is not moving forward. No rejection email is sent.`,
      steps: [{ tool: "close_candidate", args: { query: name, reason: "Recruiter decision from voice command" } }],
    };
  }

  if (/(send|write|email|mail).*(to|about|asking|saying)/.test(lower) && candidate) {
    return {
      intent: "Draft email",
      summary: `I need a subject and body before sending to ${candidate.email}. Open Mail to compose with AI.`,
      steps: [{ tool: "navigate", args: { path: `/app/mail?to=${encodeURIComponent(candidate.email)}` } }],
    };
  }

  if (/(open|show|pull up|go to|find)/.test(lower) && name) {
    return {
      intent: "Open candidate",
      summary: `Opening ${name}'s evidence.`,
      steps: [
        { tool: "find_candidate", args: { query: name } },
        { tool: "navigate", args: { path: `/app/roles/${candidate?.roleId}/candidates/${candidate?.id}` } },
      ],
    };
  }

  if (/(hiring kit|full setup|set up hiring|setup hiring|complete kit)/.test(lower)) {
    const roleMatch = transcript.match(/(?:for|for the|named|called)\s+(.+?)(?:\s+role|\s+position|$)/i);
    const roleTitle = cleanName(roleMatch?.[1] ?? "") || "Tele Caller";
    return {
      intent: "Create hiring kit",
      summary: `I can create a complete hiring kit for “${roleTitle}” — a Drive folder, a tracking Google Sheet, and a live Google Application Form. Approve to run.`,
      steps: [{ tool: "create_hiring_kit", args: { roleTitle } }],
    };
  }

  if (/(export|sync|move|save).*(form|responses|applicants).*(sheet|spreadsheet)/.test(lower)) {
    return {
      intent: "Export form responses",
      summary: "I can export your latest application form submissions into a new Google Sheet. Approve to create the sheet.",
      steps: [{ tool: "export_form_to_sheet", args: {} }],
    };
  }

  if (/(add|append).*(question|field).*(form)/.test(lower)) {
    const qMatch = transcript.match(/(?:question|field)\s*:?\s*["“']?([^"”']+?)["”']?(?:\s+to\s+.*form.*)?$/i);
    const question = qMatch?.[1]?.trim() || "Notice period and earliest joining date";
    return {
      intent: "Update application form",
      summary: `I can add the question “${question}” to your latest Google Application Form. Approve to apply.`,
      steps: [{ tool: "update_application_form", args: { questions: question } }],
    };
  }

  if (/(form responses|who applied|applicants from.*form|check.*form|show.*responses|submissions)/.test(lower)) {
    return {
      intent: "Form responses",
      summary: "Fetching and parsing the latest submissions from your Google Application Form.",
      steps: [{ tool: "list_form_responses", args: {} }],
    };
  }

  if (/(application form|job form|hiring form|google form|intake form)/.test(lower) && /(create|make|set up|build|new|start)/.test(lower)) {
    const roleMatch = transcript.match(/(?:for|for the|named|called|titled)\s+(.+?)(?:\s+role|\s+position|\s+job|$)/i);
    const roleTitle = cleanName(roleMatch?.[1] ?? "") || "Tele Caller";
    return {
      intent: "Create application form",
      summary: `I can create a Google Application Form for “${roleTitle}” with structured hiring questions. Approve before it is created.`,
      steps: [{ tool: "create_application_form", args: { roleTitle } }],
    };
  }

  if (/(list|show|my)\s+(application\s+)?forms\b/.test(lower)) {
    return {
      intent: "Application forms",
      summary: "Listing the Google Application Forms in this workspace.",
      steps: [{ tool: "list_forms", args: {} }],
    };
  }

  if (/(offer letter|job offer|generate offer|create offer|draft offer)/.test(lower)) {
    const salaryMatch = transcript.match(/(?:salary|ctc|package|at|for)\s*(₹?\s*\d[\d,.]*(?:\s*(?:k|lpa|per month|\/month|monthly|lakhs?))?)/i);
    const dateMatch = transcript.match(/(?:joining|starting|start(?:ing)?\s+date|from)\s+([a-z0-9\s,]+?)(?:\s+with|\s+at|$)/i);
    const targetName = name ?? cleanName(transcript.replace(/.*(?:for)\s+/i, "").replace(/\s+(?:at|with|salary|ctc|starting|joining).*$/i, "")) ?? "Candidate";
    return {
      intent: "Generate offer letter",
      summary: `I can generate a formatted Offer Letter Google Doc for ${targetName}. Approve to create it in Drive.`,
      steps: [
        {
          tool: "generate_offer_letter",
          args: {
            query: targetName,
            ...(salaryMatch?.[1] ? { compensation: salaryMatch[1].trim() } : {}),
            ...(dateMatch?.[1] ? { startDate: dateMatch[1].trim() } : {}),
            draftEmail: /email|mail|draft/.test(lower),
          },
        },
      ],
    };
  }

  if (/(free slots|available slots|open slots|when am i free|find.*slot)/.test(lower)) {
    return {
      intent: "Find free slots",
      summary: "Checking your calendar for available 30-minute interview slots in IST.",
      steps: [{ tool: "calendar_free_slots", args: { days: 2 } }],
    };
  }

  if (/(pipeline|kanban|candidate stages|stage breakdown|how is the pipeline)/.test(lower) && !/(open|go to|take me)/.test(lower)) {
    return {
      intent: "Pipeline summary",
      summary: "Summarising candidate counts across every hiring pipeline stage.",
      steps: [{ tool: "pipeline_summary", args: {} }],
    };
  }

  if (/(move|put|set)\s+.+\s+to\s+(shortlisted|scheduled|in review|in_review|closed|review)/.test(lower) && name) {
    const stageMatch = lower.match(/to\s+(shortlisted|scheduled|in review|in_review|closed|review)/);
    const targetStage = (stageMatch?.[1] ?? "shortlisted").replace(" ", "_");
    return {
      intent: "Move candidate stage",
      summary: `I can move ${name} to ${targetStage.replace(/_/g, " ")}. Approve to update the pipeline.`,
      steps: [{ tool: "move_candidate_stage", args: { query: name, stage: targetStage } }],
    };
  }

  if (/(open|show|go to|take me)/.test(lower)) {
    const routes: { test: RegExp; path: string }[] = [
      { test: /sheet|spreadsheet|cleaner/, path: "/app/sheets" },
      { test: /pipeline|kanban|board/, path: "/app/pipeline" },
      { test: /form/, path: "/app/forms" },
      { test: /offer/, path: "/app/offer" },
      { test: /connection|google|integration/, path: "/app/connections" },
      { test: /voice|vaani/, path: "/app/voice" },
      { test: /review/, path: "/app/review" },
      { test: /mail|inbox/, path: "/app/mail" },
      { test: /calendar/, path: "/app/calendar" },
      { test: /role/, path: "/app/roles" },
      { test: /playbook/, path: "/app/playbooks" },
      { test: /crew|agent/, path: "/app/crew" },
      { test: /analytic/, path: "/app/analytics" },
      { test: /setting/, path: "/app/settings" },
    ];
    const found = routes.find((route) => route.test.test(lower));
    if (found) {
      return {
        intent: "Open screen",
        summary: "Opening that screen.",
        steps: [{ tool: "navigate", args: { path: found.path } }],
      };
    }
  }

  if (/(document|doc\b|notes)/.test(lower)) {
    const title = spokenName(transcript, /\b(?:google\s+)?(?:doc|document)s?\b/gi);
    return {
      intent: "Create doc",
      summary: "I can create a Google Doc with interview notes. Add the title and content, then approve.",
      steps: [
        {
          tool: "create_doc",
          args: {
            title: title || `${demoWorkspace.org.name} · interview notes`,
            body: "Draft created from the Hirevoice desk. Replace this text with the interview summary.",
          },
        },
      ],
    };
  }

  return {
    intent: "No match",
    summary:
      "I did not catch a workspace action. Try “who needs review”, “open Sana Khan”, “shortlist Rahul”, or “schedule Sana tomorrow at 3”.",
    steps: [],
  };
}

export async function approveAction(actionId: string, ctx: ToolContext): Promise<AgentAction> {
  const action = await getAction(actionId);
  if (!action) throw new ToolError("That action no longer exists.");
  if (!action.mutating) throw new ToolError("That step already ran.");
  if (action.status !== "proposed") throw new ToolError("That action is not waiting for approval.");

  await updateAction(action.id, { status: "approved" });

  try {
    const result = await executeTool(action.tool, action.args, ctx);
    return (await updateAction(action.id, { status: "executed", result, error: null }))!;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Action failed";
    return (await updateAction(action.id, {
      status: "failed",
      error: message,
      result: { ok: false, title: "Action failed", detail: message },
    }))!;
  }
}

export async function rejectAction(actionId: string) {
  const action = await getAction(actionId);
  if (!action) throw new ToolError("That action no longer exists.");
  return updateAction(action.id, { status: "rejected", error: "Rejected by recruiter" });
}
