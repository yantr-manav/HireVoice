import "server-only";
import type {
  ActionResult,
  CalendarEvent,
  AgentActionSource,
} from "@/lib/types";
import { candidates, roles, workspace as demoWorkspace } from "@/lib/demo/data";
import {
  addDecision,
  addLocalEvent,
  addWorkspaceFile,
  listLatestDecisions,
  listLocalEvents,
  listPendingActions,
  listWorkspaceFiles,
  writeAudit,
} from "@/lib/db/repo";
import { generate } from "@/lib/ai/gemini";
import { aiConfigured } from "@/lib/ai/keys";
import { feedbackEmail, inviteEmail, offerEmail, offerLetterDocument } from "@/lib/agent/templates";
import { googleConnection } from "@/lib/google/auth";
import {
  appendSheetRow,
  createCalendarEvent,
  createDoc,
  createDriveFolder,
  createMailDraft,
  createSheet,
  listCalendarEvents,
  listMail,
  modifyMail,
  sendMail,
  updateSheet,
} from "@/lib/google/services";
import {
  createApplicationForm,
  demoFormResponses,
  demoForms,
  extractFormId,
  getFormDetails,
  getFormResponses,
  updateApplicationForm,
} from "@/lib/google/forms";
import {
  createCleanedSheet,
  demoSheetData,
  demoSheets,
  extractSpreadsheetId,
  listGoogleSheets,
  readGoogleSheet,
  smartCleanWithInstruction,
  writeCleanedTab,
} from "@/lib/google/sheets";
import { demoCalendarEvents, demoMail } from "@/lib/google/demo";
import { addDays, formatIstRange, formatIstTime, istAt, istDateKey, startOfIstDay } from "@/lib/time";

export type ToolContext = {
  owner: string;
  actor: string;
  email: string;
  source: AgentActionSource;
};

export type ToolDefinition = {
  name: string;
  label: string;
  mutating: boolean;
  description: string;
  args: Record<string, string>;
  external?: "gmail" | "calendar" | "drive" | "docs" | "sheets" | "forms";
};

export class ToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolError";
  }
}

export const toolDefinitions: ToolDefinition[] = [
  {
    name: "navigate",
    label: "Open a screen",
    mutating: false,
    description: "Move the recruiter to a screen in the desk. Use for 'open', 'show me'.",
    args: { path: "Desk path, e.g. /app/review or a candidate link from find_candidate" },
  },
  {
    name: "list_review_queue",
    label: "Review queue",
    mutating: false,
    description: "List candidates waiting for a human decision, with score and the review reason.",
    args: {},
  },
  {
    name: "find_candidate",
    label: "Find candidate",
    mutating: false,
    description: "Find one or more candidates by name, alias or email. Always call this before a write that targets a candidate.",
    args: { query: "Name, alias or email fragment" },
  },
  {
    name: "candidate_evidence",
    label: "Candidate evidence",
    mutating: false,
    description: "Summarise a candidate's rubric scores and verified quotes.",
    args: { query: "Name, alias or email fragment" },
  },
  {
    name: "workspace_metrics",
    label: "Workspace metrics",
    mutating: false,
    description: "Invites, completion, review load and evidence quality for this workspace.",
    args: {},
  },
  {
    name: "list_approvals",
    label: "Pending approvals",
    mutating: false,
    description: "List external actions waiting for recruiter approval.",
    args: {},
  },
  {
    name: "list_roles",
    label: "Roles",
    mutating: false,
    description: "List open roles with pipeline counts.",
    args: {},
  },
  {
    name: "mail_search",
    label: "Search mail",
    mutating: false,
    description: "Search Gmail (or the demo inbox when Google is not connected).",
    args: { query: "Gmail search text, e.g. from:sana or refund" },
  },
  {
    name: "mail_read",
    label: "Read mail",
    mutating: false,
    description: "Read one message by id, or the latest message matching a query.",
    args: { id: "Message id from mail_search", query: "Optional sender or subject text" },
  },
  {
    name: "calendar_range",
    label: "Calendar",
    mutating: false,
    description: "List interviews and reviews for the next days (default: today and tomorrow).",
    args: { days: "Number of days from today, 1–14" },
  },
  {
    name: "schedule_interview",
    label: "Schedule interview",
    mutating: true,
    external: "calendar",
    description: "Create a calendar event, optionally with a Google Meet link. Requires approval.",
    args: {
      query: "Candidate name",
      start: "ISO 8601 start in IST, e.g. 2026-11-20T15:00:00+05:30",
      end: "ISO 8601 end in IST",
      title: "Optional event title",
      meet: "true to attach a Meet link",
    },
  },
  {
    name: "send_email",
    label: "Send email",
    mutating: true,
    external: "gmail",
    description: "Send an email from the connected Gmail account. Requires approval.",
    args: {
      to: "Recipient email (comma separated allowed)",
      subject: "Subject line",
      body: "Plain-text body",
      candidateId: "Optional candidate id",
    },
  },
  {
    name: "draft_feedback",
    label: "Draft feedback",
    mutating: true,
    external: "gmail",
    description: "Write kind, specific feedback and save it as a Gmail draft. Never includes a score. Requires approval.",
    args: { query: "Candidate name", tone: "Optional: warm | direct" },
  },
  {
    name: "send_invite",
    label: "Send interview invite",
    mutating: true,
    external: "gmail",
    description: "Send the one-use interview link to a candidate. Requires approval.",
    args: { query: "Candidate name" },
  },
  {
    name: "shortlist_candidate",
    label: "Shortlist candidate",
    mutating: true,
    description: "Record a recruiter shortlist decision. Does not email the candidate. Requires approval.",
    args: { query: "Candidate name", note: "Optional note" },
  },
  {
    name: "close_candidate",
    label: "Do not move forward",
    mutating: true,
    description: "Record a 'not moving forward' decision. Never sends email automatically. Requires approval.",
    args: { query: "Candidate name", reason: "Short reason" },
  },
  {
    name: "archive_mail",
    label: "Archive mail",
    mutating: true,
    external: "gmail",
    description: "Remove a message from the inbox (archive, not delete). Requires approval.",
    args: { id: "Message id from mail_search" },
  },
  {
    name: "create_doc",
    label: "Create Google Doc",
    mutating: true,
    external: "docs",
    description: "Create a Google Doc with redacted interview notes or a summary. Requires approval.",
    args: { title: "Document title", body: "Plain text body" },
  },
  {
    name: "create_sheet",
    label: "Create Google Sheet",
    mutating: true,
    external: "sheets",
    description:
      "Create a real Google Sheet in the connected Drive. Use for 'create a sheet named Hiring for Tele caller'. Requires approval.",
    args: {
      title: "Spreadsheet title, exactly as spoken",
      header: "Optional comma separated column headers",
      rows: "Optional rows separated by | for columns, and ; between rows",
      folderId: "Optional Drive folder id",
    },
  },
  {
    name: "update_sheet",
    label: "Update Google Sheet",
    mutating: true,
    external: "sheets",
    description: "Write or replace cells in an existing Google Sheet. Requires approval.",
    args: {
      spreadsheetId: "Sheet id or URL",
      range: "A1 range, e.g. A2",
      rows: "Rows separated by ; and columns by |",
    },
  },
  {
    name: "create_folder",
    label: "Create Drive folder",
    mutating: true,
    external: "drive",
    description: "Create a folder in Google Drive. Requires approval.",
    args: { name: "Folder name", parentId: "Optional parent folder id" },
  },
  {
    name: "append_tracker",
    label: "Append to tracker",
    mutating: true,
    external: "sheets",
    description: "Append one row to the hiring tracker spreadsheet. Requires approval.",
    args: { row: "Comma separated cells: alias, role, stage, decision" },
  },
  {
    name: "drive_files",
    label: "Search Drive",
    mutating: false,
    external: "drive",
    description: "List recent resumes and documents in Google Drive.",
    args: { query: "Optional filename text" },
  },
  {
    name: "create_application_form",
    label: "Create application form",
    mutating: true,
    external: "forms",
    description:
      "Create a live Google Form for collecting job applications for a role (e.g. Tele Caller, Customer Support). Requires approval.",
    args: {
      roleTitle: "Job role title, e.g. Tele Caller",
      questions: "Optional comma-separated extra question titles to include",
      description: "Optional custom form description",
    },
  },
  {
    name: "update_application_form",
    label: "Update application form",
    mutating: true,
    external: "forms",
    description:
      "Add new questions or update description on an existing Google Application Form. Never deletes questions. Requires approval.",
    args: {
      formId: "Google Form ID or URL (optional — defaults to latest created form)",
      questions: "Comma-separated question titles to append",
      description: "Optional new description",
    },
  },
  {
    name: "list_forms",
    label: "List application forms",
    mutating: false,
    external: "forms",
    description: "List Google Application Forms created in this workspace.",
    args: {},
  },
  {
    name: "list_form_responses",
    label: "Form responses",
    mutating: false,
    external: "forms",
    description: "Fetch and parse submissions for a Google Application Form with human-readable answers.",
    args: { formId: "Google Form ID or URL (optional — defaults to latest form)" },
  },
  {
    name: "export_form_to_sheet",
    label: "Export form responses to Sheet",
    mutating: true,
    external: "sheets",
    description: "Export parsed Google Form responses directly into a new Google Sheet in Drive. Requires approval.",
    args: {
      formId: "Google Form ID or URL (optional — defaults to latest form)",
      sheetTitle: "Optional title for the new Google Sheet",
    },
  },
  {
    name: "create_hiring_kit",
    label: "Create complete hiring kit",
    mutating: true,
    external: "drive",
    description:
      "Create a Drive folder, a hiring tracker Google Sheet inside it, and a Google Application Form for a role in one workflow. Requires approval.",
    args: { roleTitle: "Job role title, e.g. Tele Caller" },
  },
  {
    name: "generate_offer_letter",
    label: "Generate offer letter",
    mutating: true,
    external: "docs",
    description:
      "Create a formal Offer Letter Google Doc (and optional Gmail draft) for a candidate. Requires approval.",
    args: {
      query: "Candidate name (or custom full name)",
      roleTitle: "Optional role title (auto-filled from candidate if known)",
      compensation: "Salary/CTC, e.g. ₹28,000/month or ₹4.2 LPA",
      startDate: "Joining date, e.g. 1 December 2026",
      location: "Optional work location",
      draftEmail: "Optional true to also save an offer email draft in Gmail",
    },
  },
  {
    name: "pipeline_summary",
    label: "Pipeline summary",
    mutating: false,
    description: "Summarise candidate counts and top candidates across all hiring pipeline stages.",
    args: { stage: "Optional stage filter: invited | interviewed | in_review | shortlisted | scheduled | closed" },
  },
  {
    name: "move_candidate_stage",
    label: "Move candidate stage",
    mutating: true,
    description: "Move a candidate to a pipeline stage (shortlisted, scheduled, in_review, or closed). Never deletes or auto-emails. Requires approval.",
    args: {
      query: "Candidate name",
      stage: "Target stage: shortlisted | scheduled | in_review | closed",
      note: "Optional recruiter note",
    },
  },
  {
    name: "draft_email",
    label: "Save Gmail draft",
    mutating: true,
    external: "gmail",
    description: "Save a draft email in Gmail without sending it. Requires approval.",
    args: {
      to: "Recipient email or candidate name",
      subject: "Subject line",
      body: "Email body",
    },
  },
  {
    name: "calendar_free_slots",
    label: "Find free interview slots",
    mutating: false,
    external: "calendar",
    description: "Suggest available 30-minute interview slots in IST over the next two working days.",
    args: { days: "Optional number of days to scan (1–5)" },
  },
  {
    name: "list_sheets",
    label: "List Google Sheets",
    mutating: false,
    external: "sheets",
    description: "List Google Sheets in Drive and this workspace.",
    args: { query: "Optional spreadsheet name fragment" },
  },
  {
    name: "read_sheet",
    label: "Audit & read Google Sheet",
    mutating: false,
    external: "sheets",
    description:
      "Read a Google Sheet by name, URL, or ID and report row count plus messy data health (duplicates, broken phones/emails, blank rows).",
    args: {
      sheet: "Spreadsheet name, URL, or ID (optional — defaults to latest sheet)",
      tab: "Optional tab name",
    },
  },
  {
    name: "clean_sheet",
    label: "Clean messy Google Sheet",
    mutating: true,
    external: "sheets",
    description:
      "Clean messy hiring data in a Google Sheet (trim whitespace, title-case names, standardize +91 phones & emails, normalize Indian cities & pipeline stages, skip blank rows, deduplicate leads, and apply custom sort/transform rules). Non-destructive: writes into a brand-new Cleaned tab (or new Sheet) and NEVER deletes raw data. Requires approval.",
    args: {
      sheet: "Spreadsheet name, URL, or ID (optional — defaults to latest sheet)",
      instruction: "Optional custom cleaning or sorting instruction",
      target: "Optional: new_tab (default) | new_sheet",
    },
  },
];

export const toolNames = new Set(toolDefinitions.map((tool) => tool.name));

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9@.\s-]/g, " ").replace(/\s+/g, " ").trim();
}

function candidateLink(id: string, roleId: string) {
  return `/app/roles/${roleId}/candidates/${id}`;
}

function resolveCandidate(query: string | undefined) {
  if (!query) throw new ToolError("Tell me which candidate this is about.");
  const term = normalize(query);
  if (!term) throw new ToolError("Tell me which candidate this is about.");

  const exact = candidates.find(
    (candidate) =>
      normalize(candidate.alias) === term ||
      normalize(candidate.name) === term ||
      normalize(candidate.email) === term ||
      candidate.id === query,
  );
  if (exact) return exact;

  const matches = candidates.filter((candidate) => {
    const haystack = normalize(`${candidate.name} ${candidate.alias} ${candidate.email}`);
    return term.split(" ").every((part) => haystack.includes(part));
  });
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    const names = matches.slice(0, 4).map((candidate) => `${candidate.name} (${candidate.alias})`).join(", ");
    throw new ToolError(`That matches more than one candidate: ${names}. Say the full name.`);
  }

  const fuzzy = candidates.filter((candidate) => normalize(candidate.name).includes(term) || term.includes(normalize(candidate.name)));
  if (fuzzy.length === 1) return fuzzy[0];

  throw new ToolError(`I could not find “${query}” in this workspace. Try a full name or candidate code.`);
}

function emailAddresses(value: string): string[] {
  return value
    .split(/[,;\s]+/)
    .map((entry) => entry.trim())
    .filter((entry) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(entry));
}

function splitCells(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((cell) => String(cell));
  return String(value ?? "")
    .split(/[,|\t]/)
    .map((cell) => cell.trim())
    .filter(Boolean);
}

/** Accepts "a|b;c|d" (rows/columns) or an array of arrays. */
function splitTable(value: unknown): string[][] {
  if (Array.isArray(value)) {
    return value.map((row) => (Array.isArray(row) ? row.map(String) : splitCells(row)));
  }
  return String(value ?? "")
    .split(";")
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => row.split("|").map((cell) => cell.trim()));
}

function spreadsheetIdFrom(value: string): string {
  const match = value.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match?.[1] ?? value.trim();
}

function candidateRow(candidate: (typeof candidates)[number]) {
  return {
    label: candidate.name,
    value: `${candidate.alias} · ${candidate.stage.replace(/_/g, " ")} · ${candidate.score.overall.toFixed(1)}/5`,
  };
}

export function toolSummary(tool: string, args: Record<string, unknown>): string {
  const definition = toolDefinitions.find((entry) => entry.name === tool);
  const label = definition?.label ?? tool;
  const detail =
    (args.query as string | undefined) ??
    (args.subject as string | undefined) ??
    (args.title as string | undefined) ??
    (args.to as string | undefined) ??
    "";

  if (tool === "navigate" && args.path) return `Open ${String(args.path).replace("/app/", "").replace(/\//g, " · ")}`;
  if (tool === "schedule_interview") {
    const start = typeof args.start === "string" ? new Date(args.start) : null;
    const end = typeof args.end === "string" ? new Date(args.end) : null;
    if (start && end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      return `Schedule ${detail || "interview"} · ${formatIstRange(start, end)}`;
    }
  }
  if (tool === "send_email" && args.subject) return `Send email “${String(args.subject)}”`;
  if (tool === "draft_email" && args.subject) return `Save Gmail draft “${String(args.subject)}”`;
  if (tool === "create_sheet") return `Create sheet “${detail || "Untitled"}”`;
  if (tool === "update_sheet") return `Update sheet ${String(args.spreadsheetId ?? "")}`;
  if (tool === "list_sheets") return "List Google Sheets";
  if (tool === "read_sheet") return `Inspect sheet ${String(args.sheet ?? "latest")}`;
  if (tool === "clean_sheet") return `Clean messy data in ${String(args.sheet ?? "latest sheet")} (saves to new Cleaned tab)`;
  if (tool === "create_folder") return `Create Drive folder “${String(args.name ?? "")}”`;
  if (tool === "create_application_form") return `Create application form for “${String(args.roleTitle ?? detail ?? "Open Role")}”`;
  if (tool === "update_application_form") return `Add questions to application form`;
  if (tool === "export_form_to_sheet") return `Export form responses to Google Sheet`;
  if (tool === "create_hiring_kit") return `Create hiring kit (Folder + Sheet + Form) for “${String(args.roleTitle ?? detail ?? "Open Role")}”`;
  if (tool === "generate_offer_letter") return `Generate offer letter for ${String(args.query ?? "candidate")}`;
  if (tool === "move_candidate_stage") return `Move ${String(args.query ?? "candidate")} to ${String(args.stage ?? "stage").replace(/_/g, " ")}`;
  if (tool === "draft_feedback") return `Draft feedback for ${detail}`;
  if (tool === "shortlist_candidate") return `Shortlist ${detail}`;
  if (tool === "close_candidate") return `Record “not moving forward” for ${detail}`;
  return detail ? `${label}: ${detail}` : label;
}

export async function executeTool(
  tool: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ActionResult> {
  const google = await googleConnection(ctx.owner);

  switch (tool) {
    case "navigate": {
      const path = typeof args.path === "string" ? args.path : "/app";
      return { ok: true, title: "Opened", detail: path, links: [{ label: "Open", href: path }] };
    }

    case "list_review_queue": {
      const decisions = await listLatestDecisions();
      const queue = candidates.filter((candidate) => {
        if (candidate.stage !== "in_review") return false;
        const decision = decisions.get(candidate.id);
        return !decision || decision.action === "review" || decision.action === "skip";
      });
      return {
        ok: true,
        title: `${queue.length} candidate${queue.length === 1 ? "" : "s"} waiting for a human`,
        detail: "Ordered by score. A recruiter decides; nothing is automatic.",
        rows: queue.map((candidate) => ({
          label: candidate.name,
          value: `${candidate.score.overall.toFixed(1)}/5 · ${candidate.reviewReasons[0] ?? "Needs review"}`,
        })),
        links: [{ label: "Open review queue", href: "/app/review" }],
      };
    }

    case "find_candidate": {
      const term = normalize(String(args.query ?? ""));
      const matches = candidates
        .filter((candidate) => {
          const haystack = normalize(`${candidate.name} ${candidate.alias} ${candidate.email}`);
          return term.split(" ").filter(Boolean).every((part) => haystack.includes(part));
        })
        .slice(0, 5);
      const list = matches.length > 0 ? matches : candidates.slice(0, 3);
      return {
        ok: matches.length > 0,
        title: matches.length > 0 ? `${matches.length} match${matches.length === 1 ? "" : "es"}` : "No exact match",
        detail: matches.length > 0 ? "Open a candidate to see evidence." : "Showing three recent candidates instead.",
        rows: list.map(candidateRow),
        links: list.slice(0, 2).map((candidate) => ({
          label: `Open ${candidate.name}`,
          href: candidateLink(candidate.id, candidate.roleId),
        })),
      };
    }

    case "candidate_evidence": {
      const candidate = resolveCandidate(String(args.query ?? ""));
      const verified = candidate.score.items.flatMap((item) => item.evidence).filter((quote) => quote.verified).length;
      const total = candidate.score.items.flatMap((item) => item.evidence).length;
      return {
        ok: true,
        title: `${candidate.name} · ${candidate.score.overall.toFixed(1)}/5`,
        detail: candidate.score.summary,
        rows: [
          { label: "Evidence quality", value: `${candidate.score.evidenceQuality}%` },
          { label: "Quotes verified", value: `${verified}/${total}` },
          ...candidate.score.items.map((item) => ({
            label: item.label,
            value: item.insufficientEvidence ? "insufficient evidence" : `${item.value.toFixed(1)}/5`,
          })),
        ],
        links: [{ label: "Open evidence", href: candidateLink(candidate.id, candidate.roleId) }],
      };
    }

    case "workspace_metrics": {
      const metrics = demoWorkspace.metrics;
      return {
        ok: true,
        title: "This week",
        detail: "Seeded workspace metrics. Live Supabase queries replace these once connected.",
        rows: [
          { label: "Invites sent", value: String(metrics.invites) },
          { label: "Interviews completed", value: `${metrics.completed} · ${Math.round(metrics.completionRate * 100)}%` },
          { label: "Waiting for review", value: String(metrics.inReview) },
          { label: "Shortlisted", value: String(metrics.shortlisted) },
          { label: "Verified quotes", value: `${metrics.verifiedQuotes}/${metrics.totalQuotes}` },
          { label: "Median result", value: `${metrics.medianResultSeconds}s` },
        ],
        links: [{ label: "Open analytics", href: "/app/analytics" }],
      };
    }

    case "list_approvals": {
      const pending = await listPendingActions();
      const seeded = demoWorkspace.approvals.filter((approval) => approval.status === "pending");
      return {
        ok: true,
        title: `${pending.length + seeded.length} waiting for approval`,
        detail: "Nothing external runs without a human approval.",
        rows: [
          ...pending.map((action) => ({ label: action.summary, value: `Voice · ${action.tool}` })),
          ...seeded.map((approval) => ({ label: approval.title, value: approval.kind })),
        ],
        links: [{ label: "Open approvals", href: "/app/crew?tab=approvals" }],
      };
    }

    case "list_roles": {
      return {
        ok: true,
        title: `${roles.length} roles`,
        detail: "Open roles and their live pipelines.",
        rows: roles.map((role) => ({
          label: role.title,
          value: `${role.status} · ${role.shortlisted} shortlisted · ${role.scheduled} scheduled`,
        })),
        links: [{ label: "Open roles", href: "/app/roles" }],
      };
    }

    case "mail_search": {
      const query = String(args.query ?? "").trim();
      if (!google.connected) {
        const term = query.toLowerCase();
        const matches = demoMail()
          .filter((message) =>
            !term ||
            `${message.from.name} ${message.from.email} ${message.subject} ${message.body}`.toLowerCase().includes(term),
          )
          .slice(0, 8);
        return {
          ok: true,
          title: `${matches.length} demo message${matches.length === 1 ? "" : "s"}`,
          detail: "Demo inbox. Connect Gmail to search the real account.",
          rows: matches.map((message) => ({
            label: message.subject,
            value: `${message.from.name || message.from.email} · ${formatIstTime(message.date)}`,
          })),
          links: [{ label: "Open mail", href: "/app/mail" }],
        };
      }
      const messages = await listMail(ctx.owner, { query, limit: 8 });
      return {
        ok: true,
        title: `${messages.length} message${messages.length === 1 ? "" : "s"}`,
        detail: "From the connected Gmail account.",
        rows: messages.map((message) => ({
          label: message.subject,
          value: `${message.from.name || message.from.email} · ${formatIstTime(message.date)}`,
        })),
        links: [{ label: "Open mail", href: "/app/mail" }],
      };
    }

    case "mail_read": {
      const id = String(args.id ?? "").trim();
      const query = String(args.query ?? "").trim();
      if (!id && !query) throw new ToolError("Which message? Search mail first.");
      if (!google.connected) {
        const inbox = demoMail();
        const term = query.toLowerCase();
        const message = id
          ? inbox.find((entry) => entry.id === id)
          : inbox.find((entry) =>
              `${entry.from.name} ${entry.from.email} ${entry.subject} ${entry.body}`.toLowerCase().includes(term),
            );
        if (!message) throw new ToolError("That message is not in the demo inbox.");
        return {
          ok: true,
          title: message.subject,
          detail: message.body.slice(0, 900),
          rows: [
            { label: "From", value: `${message.from.name} <${message.from.email}>` },
            { label: "Received", value: formatIstTime(message.date) },
          ],
          links: [{ label: "Open mail", href: "/app/mail" }],
        };
      }
      const messages = await listMail(ctx.owner, { query: query || undefined, limit: 30 });
      const message = id ? messages.find((entry) => entry.id === id) : messages[0];
      if (!message) throw new ToolError("That message was not found in the recent inbox.");
      return {
        ok: true,
        title: message.subject,
        detail: message.body.slice(0, 900),
        rows: [{ label: "From", value: `${message.from.name} <${message.from.email}>` }],
        links: [{ label: "Open mail", href: "/app/mail" }],
      };
    }

    case "calendar_range": {
      const days = Math.min(Math.max(Number(args.days ?? 2) || 2, 1), 14);
      const from = startOfIstDay(new Date());
      const to = addDays(from, days);
      const local = await listLocalEvents(from.toISOString(), to.toISOString());
      let external: CalendarEvent[] = [];
      if (google.connected) {
        external = await listCalendarEvents(ctx.owner, from.toISOString(), to.toISOString()).catch(() => []);
      }
      if (!google.connected) external = demoCalendarEvents().filter((event) => new Date(event.start) >= from && new Date(event.start) <= to);
      const events = [...external, ...local].sort((a, b) => a.start.localeCompare(b.start)).slice(0, 10);

      return {
        ok: true,
        title: `${events.length} event${events.length === 1 ? "" : "s"} in the next ${days} day${days === 1 ? "" : "s"}`,
        detail: google.connected ? "From Google Calendar and Hirevoice." : "Demo calendar. Connect Google to read the real one.",
        rows: events.map((event) => ({
          label: event.title,
          value: `${formatIstRange(event.start, event.end)}${event.meetLink ? " · Meet" : ""}`,
        })),
        links: [{ label: "Open calendar", href: "/app/calendar" }],
      };
    }

    case "schedule_interview": {
      const candidate = args.query ? resolveCandidate(String(args.query)) : null;
      const startRaw = String(args.start ?? "");
      const endRaw = String(args.end ?? "");
      const start = new Date(startRaw);
      const end = new Date(endRaw);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        throw new ToolError("I need a valid start and end time, e.g. tomorrow at 3 PM for 30 minutes.");
      }
      if (end <= start) throw new ToolError("The end time needs to be after the start time.");

      const title =
        typeof args.title === "string" && args.title.trim()
          ? args.title.trim()
          : candidate
            ? `Interview · ${candidate.name}`
            : "Interview";

      const attendees = [
        ...(candidate ? [{ name: candidate.name, email: candidate.email }] : []),
        ...(ctx.email ? [{ name: ctx.actor, email: ctx.email }] : []),
      ];
      const meet = args.meet === false ? false : true;
      const description = candidate
        ? `${candidate.roleTitle} · evidence-linked screen. Review before the call: ${candidateLink(candidate.id, candidate.roleId)}`
        : "Created from the Hirevoice desk.";

      if (!google.connected) {
        const local = await addLocalEvent({
          title,
          description,
          start: start.toISOString(),
          end: end.toISOString(),
          attendees,
          kind: "interview",
          candidateId: candidate?.id ?? null,
          createdBy: ctx.actor,
        });
        await writeAudit({
          actor: ctx.actor,
          action: "scheduled_interview",
          target: candidate?.name ?? title,
          detail: "Saved to the local Hirevoice calendar",
          surface: "calendar",
        });
        return {
          ok: true,
          title: "Added to the Hirevoice calendar",
          detail: `${formatIstRange(start, end)}. ${meet ? "Connect Google Calendar to create the Meet link." : ""}`.trim(),
          rows: [
            { label: "When", value: formatIstRange(start, end) },
            { label: "Who", value: attendees.map((attendee) => attendee.name ?? attendee.email).join(", ") || "You" },
          ],
          links: [{ label: "Open calendar", href: "/app/calendar" }],
        };
      }

      const created = await createCalendarEvent(ctx.owner, {
        title,
        description,
        start: start.toISOString(),
        end: end.toISOString(),
        attendees,
        meet,
        kind: "interview",
        candidateId: candidate?.id,
        notify: Boolean(args.notify),
      });
      await writeAudit({
        actor: ctx.actor,
        action: "scheduled_interview",
        target: candidate?.name ?? title,
        detail: `Google Calendar · ${created.id}`,
        surface: "calendar",
      });
      return {
        ok: true,
        title: "Interview scheduled",
        detail: `${formatIstRange(start, end)}${created.meetLink ? " · Meet link attached" : ""}.`,
        rows: [
          { label: "When", value: formatIstRange(start, end) },
          { label: "Attendees", value: attendees.map((attendee) => attendee.email).join(", ") || "You" },
        ],
        links: [
          ...(created.meetLink ? [{ label: "Join Meet", href: created.meetLink, external: true }] : []),
          ...(created.htmlLink ? [{ label: "Open in Calendar", href: created.htmlLink, external: true }] : []),
        ],
      };
    }

    case "send_email": {
      const to = Array.isArray(args.to) ? (args.to as string[]).flatMap(emailAddresses) : emailAddresses(String(args.to ?? ""));
      const subject = String(args.subject ?? "").trim();
      const body = String(args.body ?? "").trim();
      if (to.length === 0) throw new ToolError("I need a valid recipient email address.");
      if (!subject) throw new ToolError("I need a subject line.");
      if (!body) throw new ToolError("I need a body for the email.");

      if (!google.connected) {
        await writeAudit({
          actor: ctx.actor,
          action: "email_prepared",
          target: to.join(", "),
          detail: subject,
          surface: "mail",
        });
        return {
          ok: true,
          simulated: true,
          title: "Email prepared, not sent",
          detail: "Connect Gmail to send. The draft stays in this workspace so nothing leaves the demo.",
          rows: [
            { label: "To", value: to.join(", ") },
            { label: "Subject", value: subject },
          ],
          links: [{ label: "Open mail", href: "/app/mail" }],
        };
      }

      const sent = await sendMail(ctx.owner, { to, subject, body });
      await writeAudit({
        actor: ctx.actor,
        action: "email_sent",
        target: to.join(", "),
        detail: subject,
        surface: "mail",
      });
      return {
        ok: true,
        title: "Email sent",
        detail: `Delivered to ${to.join(", ")}.`,
        rows: [
          { label: "Subject", value: subject },
          { label: "From", value: google.email ?? ctx.email },
        ],
        links: [{ label: "Open in Gmail", href: sent.link, external: true }],
      };
    }

    case "draft_feedback": {
      const candidate = resolveCandidate(String(args.query ?? ""));
      const missing = candidate.score.items.find((item) => item.insufficientEvidence);
      const strength = [...candidate.score.items].sort((a, b) => b.value - a.value)[0];
      const fallback = feedbackEmail(
        candidate.name,
        candidate.roleTitle,
        `${strength.label.toLowerCase()} came through clearly.`,
        missing ? `${missing.label.toLowerCase()} needs more evidence before a decision` : null,
      );

      let body = fallback;
      if (aiConfigured()) {
        try {
          const generated = await generate({
            system:
              "You write rejection feedback for a BPO recruiter. Be kind, specific and short. Never mention scores, models or rankings. Never promise another interview. Plain text, no markdown, max 130 words. Sign as Meera, Northstar BPO.",
            prompt: `Candidate: ${candidate.name}\nRole: ${candidate.roleTitle}\nScore summary: ${candidate.score.summary}\nStrength: ${strength.label}\nWeak area: ${missing?.label ?? "none flagged"}\nWrite the email body only.`,
            temperature: 0.5,
            maxOutputTokens: 500,
          });
          if (generated.text.trim().length > 40) body = generated.text.trim();
        } catch {
          /* fallback template is fine */
        }
      }

      const subject = `Your ${candidate.roleTitle} interview at Northstar BPO`;
      if (!google.connected) {
        await writeAudit({
          actor: ctx.actor,
          action: "feedback_drafted",
          target: candidate.name,
          detail: "Saved locally; Gmail not connected",
          surface: "mail",
        });
        return {
          ok: true,
          simulated: true,
          title: `Feedback drafted for ${candidate.name}`,
          detail: "Connect Gmail to save this as a real draft. Nothing was sent.",
          rows: [{ label: "Subject", value: subject }],
          links: [{ label: "Open mail", href: "/app/mail" }],
        };
      }

      const draft = await createMailDraft(ctx.owner, { to: [candidate.email], subject, body });
      await writeAudit({
        actor: ctx.actor,
        action: "feedback_drafted",
        target: candidate.name,
        detail: subject,
        surface: "mail",
      });
      return {
        ok: true,
        title: `Gmail draft saved for ${candidate.name}`,
        detail: "Nothing sent. Review the draft in Gmail.",
        rows: [{ label: "Subject", value: subject }],
        links: [{ label: "Open draft", href: draft.link, external: true }],
      };
    }

    case "send_invite": {
      const candidate = resolveCandidate(String(args.query ?? ""));
      const body = inviteEmail(candidate.name, candidate.roleTitle);
      const subject = `Next step: ${candidate.roleTitle} at Northstar BPO`;
      if (!google.connected) {
        await writeAudit({
          actor: ctx.actor,
          action: "invite_prepared",
          target: candidate.name,
          detail: "Gmail not connected",
          surface: "mail",
        });
        return {
          ok: true,
          simulated: true,
          title: `Invite prepared for ${candidate.name}`,
          detail: "Connect Gmail to send. No email left the workspace.",
          rows: [
            { label: "To", value: candidate.email },
            { label: "Subject", value: subject },
          ],
          links: [{ label: "Preview invite link", href: "/i/demo" }],
        };
      }
      const sent = await sendMail(ctx.owner, { to: [candidate.email], subject, body });
      await writeAudit({
        actor: ctx.actor,
        action: "invite_sent",
        target: candidate.name,
        detail: subject,
        surface: "mail",
      });
      return {
        ok: true,
        title: `Invite sent to ${candidate.name}`,
        detail: `One-use interview link sent to ${candidate.email}.`,
        links: [{ label: "Open in Gmail", href: sent.link, external: true }],
      };
    }

    case "shortlist_candidate": {
      const candidate = resolveCandidate(String(args.query ?? ""));
      await addDecision({
        candidateId: candidate.id,
        roleId: candidate.roleId,
        action: "shortlist",
        reason: null,
        note: args.note ? String(args.note) : null,
        actor: ctx.actor,
      });
      await writeAudit({
        actor: ctx.actor,
        action: "shortlisted",
        target: candidate.name,
        detail: "Recruiter decision via voice command",
        surface: "voice",
      });
      return {
        ok: true,
        title: `${candidate.name} shortlisted`,
        detail: "Recorded in the workspace. No email was sent.",
        rows: [{ label: "Role", value: candidate.roleTitle }],
        links: [{ label: "Open candidate", href: candidateLink(candidate.id, candidate.roleId) }],
      };
    }

    case "close_candidate": {
      const candidate = resolveCandidate(String(args.query ?? ""));
      await addDecision({
        candidateId: candidate.id,
        roleId: candidate.roleId,
        action: "close",
        reason: args.reason ? String(args.reason) : "Recruiter decision",
        note: null,
        actor: ctx.actor,
      });
      await writeAudit({
        actor: ctx.actor,
        action: "closed",
        target: candidate.name,
        detail: args.reason ? String(args.reason) : "Recruiter decision",
        surface: "voice",
      });
      return {
        ok: true,
        title: `${candidate.name} · not moving forward`,
        detail: "Recorded. No email was sent; draft feedback separately if you want to.",
        links: [{ label: "Open candidate", href: candidateLink(candidate.id, candidate.roleId) }],
      };
    }

    case "archive_mail": {
      const id = String(args.id ?? "");
      if (!id) throw new ToolError("Which message should I archive?");
      if (!google.connected) {
        return {
          ok: true,
          simulated: true,
          title: "Archive is a Gmail action",
          detail: "Connect Gmail to archive real messages. Nothing changed in the demo inbox.",
          links: [{ label: "Open mail", href: "/app/mail" }],
        };
      }
      await modifyMail(ctx.owner, id, { remove: ["INBOX"] });
      await writeAudit({ actor: ctx.actor, action: "mail_archived", target: id, surface: "mail" });
      return { ok: true, title: "Message archived", detail: "Removed from the inbox.", links: [{ label: "Open mail", href: "/app/mail" }] };
    }

    case "create_doc": {
      const title = String(args.title ?? "").trim() || "Hirevoice interview notes";
      const body = String(args.body ?? "").trim();
      if (!google.connected) {
        return {
          ok: true,
          simulated: true,
          title: "Google Docs is not connected",
          detail: "Connect Google to create a real doc. Nothing was created on an external account.",
        };
      }
      const file = await createDoc(ctx.owner, title, body);
      await addWorkspaceFile({ name: file.name, kind: "doc", url: file.url });
      await writeAudit({ actor: ctx.actor, action: "doc_created", target: title, detail: file.url, surface: "drive" });
      return {
        ok: true,
        title: "Google Doc created",
        detail: title,
        links: [{ label: "Open doc", href: file.url, external: true }],
      };
    }

    case "create_sheet": {
      const title = String(args.title ?? "").trim();
      if (!title) throw new ToolError("What should the sheet be called?");
      if (!google.connected) {
        return {
          ok: true,
          simulated: true,
          title: "Google Sheets is not connected",
          detail: "Connect Google in Connections, then approve this step to create the sheet in your Drive.",
          rows: [{ label: "Title", value: title }],
        };
      }
      const header =
        splitCells(args.header).length > 0
          ? splitCells(args.header)
          : ["Candidate", "Role", "Stage", "Decision", "Notes"];
      const rows = args.rows ? splitTable(args.rows) : [];
      const file = await createSheet(ctx.owner, title, header, {
        rows,
        folderId: args.folderId ? String(args.folderId) : undefined,
      });
      await addWorkspaceFile({ name: file.name, kind: "sheet", url: file.url });
      await writeAudit({
        actor: ctx.actor,
        action: "sheet_created",
        target: title,
        detail: file.url,
        surface: "drive",
      });
      return {
        ok: true,
        title: "Google Sheet created",
        detail: `${title} · ${header.length} columns${rows.length ? ` · ${rows.length} rows` : ""}`,
        rows: [{ label: "Title", value: title }],
        links: [{ label: "Open sheet", href: file.url, external: true }],
      };
    }

    case "update_sheet": {
      const spreadsheetId = spreadsheetIdFrom(String(args.spreadsheetId ?? ""));
      if (!spreadsheetId) throw new ToolError("Which spreadsheet should I update?");
      const rows = splitTable(args.rows);
      if (rows.length === 0) throw new ToolError("Give me the cells to write.");
      if (!google.connected) {
        return {
          ok: true,
          simulated: true,
          title: "Google Sheets is not connected",
          detail: "Connect Google to write cells. Nothing changed.",
        };
      }
      const result = await updateSheet(ctx.owner, spreadsheetId, String(args.range ?? "A1"), rows);
      await writeAudit({
        actor: ctx.actor,
        action: "sheet_updated",
        target: spreadsheetId,
        detail: result.updatedRange,
        surface: "drive",
      });
      return {
        ok: true,
        title: "Sheet updated",
        detail: result.updatedRange,
        links: [{ label: "Open sheet", href: result.url, external: true }],
      };
    }

    case "create_folder": {
      const name = String(args.name ?? "").trim();
      if (!name) throw new ToolError("What should the folder be called?");
      if (!google.connected) {
        return {
          ok: true,
          simulated: true,
          title: "Google Drive is not connected",
          detail: "Connect Google to create a real folder. Nothing was created.",
        };
      }
      const folder = await createDriveFolder(ctx.owner, name, args.parentId ? String(args.parentId) : undefined);
      await addWorkspaceFile({ name: folder.name, kind: "folder", url: folder.url });
      await writeAudit({
        actor: ctx.actor,
        action: "folder_created",
        target: name,
        detail: folder.url,
        surface: "drive",
      });
      return {
        ok: true,
        title: "Drive folder created",
        detail: name,
        links: [{ label: "Open folder", href: folder.url, external: true }],
      };
    }

    case "append_tracker": {
      const spreadsheetId = String(args.spreadsheetId ?? process.env.HIREVOICE_TRACKER_SHEET_ID ?? "");
      const cells = Array.isArray(args.row) ? (args.row as string[]) : String(args.row ?? "").split(",").map((cell) => cell.trim());
      if (cells.length === 0) throw new ToolError("Give me the row to append.");
      if (!google.connected || !spreadsheetId) {
        return {
          ok: true,
          simulated: true,
          title: "Tracker append is ready but not connected",
          detail: !google.connected
            ? "Connect Google to write to Sheets."
            : "Set HIREVOICE_TRACKER_SHEET_ID (or pass spreadsheetId) to choose the tracker.",
          rows: cells.map((cell, index) => ({ label: `Column ${index + 1}`, value: cell })),
        };
      }
      const result = await appendSheetRow(ctx.owner, spreadsheetId, cells);
      await writeAudit({ actor: ctx.actor, action: "tracker_appended", target: spreadsheetId, detail: result.updatedRange, surface: "api" });
      return {
        ok: true,
        title: "Row appended to tracker",
        detail: result.updatedRange,
        links: [{ label: "Open sheet", href: result.url, external: true }],
      };
    }

    case "drive_files": {
      if (!google.connected) {
        return {
          ok: true,
          simulated: true,
          title: "Drive is not connected",
          detail: "Connect Google to list resumes and documents. Nothing was read.",
        };
      }
      const { listDriveFiles } = await import("@/lib/google/services");
      const files = await listDriveFiles(ctx.owner, args.query ? String(args.query) : undefined);
      return {
        ok: true,
        title: `${files.length} Drive file${files.length === 1 ? "" : "s"}`,
        detail: "Read-only listing.",
        rows: files.slice(0, 8).map((file) => ({ label: file.name, value: file.mimeType.split(".").pop() ?? "file" })),
        links: files[0]?.webViewLink ? [{ label: "Open Drive", href: files[0].webViewLink, external: true }] : [],
      };
    }

    case "mark_mail_read": {
      const id = String(args.id ?? "");
      const unread = Boolean(args.unread);
      if (!google.connected) {
        return { ok: true, simulated: true, title: "Demo inbox", detail: "Connect Gmail to change read state." };
      }
      await modifyMail(ctx.owner, id, unread ? { add: ["UNREAD"] } : { remove: ["UNREAD"] });
      return { ok: true, title: unread ? "Marked unread" : "Marked read", detail: "Gmail updated." };
    }

    case "create_application_form": {
      const roleTitle = String(args.roleTitle ?? args.title ?? "").trim() || "Open Role";
      const extraQuestions = args.questions
        ? splitCells(args.questions).map((title) => ({ title, kind: "text" as const }))
        : [];
      if (!google.connected) {
        return {
          ok: true,
          simulated: true,
          title: "Google Forms is not connected",
          detail: "Connect Google Workspace in Connections, then approve this action to create the live application form in Drive.",
          rows: [
            { label: "Role", value: roleTitle },
            ...(extraQuestions.length ? [{ label: "Extra questions", value: String(extraQuestions.length) }] : []),
          ],
          links: [{ label: "Open Forms studio", href: "/app/forms" }],
        };
      }
      const { defaultQuestionsForRole } = await import("@/lib/google/forms");
      const baseQuestions = defaultQuestionsForRole(roleTitle);
      const form = await createApplicationForm(ctx.owner, roleTitle, {
        description: args.description ? String(args.description) : undefined,
        questions: [...baseQuestions, ...extraQuestions],
      });
      await addWorkspaceFile({ name: form.name, kind: "form", url: form.formUrl });
      await writeAudit({
        actor: ctx.actor,
        action: "form_created",
        target: form.name,
        detail: form.formUrl,
        surface: "forms",
      });
      return {
        ok: true,
        title: "Google Application Form created",
        detail: `${form.name} with ${form.questionCount} structured hiring questions. Share the form link to collect applicants.`,
        rows: [
          { label: "Form title", value: form.name },
          { label: "Questions", value: String(form.questionCount) },
        ],
        links: [
          { label: "Open live form", href: form.formUrl, external: true },
          { label: "Edit in Google Forms", href: form.editUrl, external: true },
          { label: "Forms Studio", href: "/app/forms" },
        ],
      };
    }

    case "update_application_form": {
      const extraTitles = splitCells(args.questions);
      const description = args.description ? String(args.description).trim() : undefined;
      if (extraTitles.length === 0 && !description) {
        throw new ToolError("Specify at least one question to add or a new description.");
      }
      const files = await listWorkspaceFiles(20);
      const latestForm = files.find((f) => f.kind === "form");
      const formId = args.formId ? extractFormId(String(args.formId)) : latestForm ? extractFormId(latestForm.url) : "";
      if (!formId) throw new ToolError("No application form found yet. Create one first or pass a Form ID.");
      if (!google.connected) {
        return {
          ok: true,
          simulated: true,
          title: "Google Forms is not connected",
          detail: "Connect Google Workspace first to update a live form.",
          links: [{ label: "Open Forms studio", href: "/app/forms" }],
        };
      }
      const updated = await updateApplicationForm(ctx.owner, formId, {
        description,
        addQuestions: extraTitles.map((title) => ({ title, kind: "text" as const })),
      });
      await writeAudit({
        actor: ctx.actor,
        action: "form_updated",
        target: updated.name,
        detail: extraTitles.length ? `Added ${extraTitles.length} question(s)` : "Updated description",
        surface: "forms",
      });
      return {
        ok: true,
        title: "Application form updated",
        detail: `${updated.name} now has ${updated.questionCount} questions.`,
        rows: extraTitles.map((q, idx) => ({ label: `Added #${idx + 1}`, value: q })),
        links: [
          { label: "Edit form", href: updated.editUrl, external: true },
          { label: "Open Forms studio", href: "/app/forms" },
        ],
      };
    }

    case "list_forms": {
      const files = await listWorkspaceFiles(30);
      const stored = files.filter((f) => f.kind === "form");
      const list = stored.length > 0 ? stored : google.connected ? [] : demoForms().map((f) => ({
        id: f.formId,
        name: f.name,
        kind: "form" as const,
        url: f.formUrl,
        createdAt: f.createdAt ?? new Date().toISOString(),
      }));
      return {
        ok: true,
        title: `${list.length} application form${list.length === 1 ? "" : "s"}`,
        detail: stored.length > 0 ? "Forms created in this workspace." : google.connected ? "No forms created yet. Say 'create application form for Tele Caller' to start." : "Showing sample forms. Connect Google to create live forms.",
        rows: list.slice(0, 8).map((f) => ({
          label: f.name,
          value: extractFormId(f.url),
        })),
        links: [
          { label: "Open Forms studio", href: "/app/forms" },
          ...(list[0] && !list[0].id.startsWith("demo-") ? [{ label: "Open latest form", href: list[0].url, external: true }] : []),
        ],
      };
    }

    case "list_form_responses": {
      const files = await listWorkspaceFiles(20);
      const latestForm = files.find((f) => f.kind === "form");
      const formId = args.formId ? extractFormId(String(args.formId)) : latestForm ? extractFormId(latestForm.url) : "demo-tele-caller-intake";
      if (!google.connected || formId.startsWith("demo-")) {
        const responses = demoFormResponses(formId);
        return {
          ok: true,
          simulated: !google.connected,
          title: `${responses.length} sample response${responses.length === 1 ? "" : "s"}`,
          detail: "Parsed applicant submissions (sample data). Connect Google Workspace to read live Google Form responses.",
          rows: responses.map((r) => ({
            label: `${r.applicantName} (${r.location || "India"})`,
            value: `${r.experience || "Applicant"} · ${r.applicantEmail}`,
          })),
          links: [{ label: "Open Forms studio", href: "/app/forms" }],
        };
      }
      const [detail, responses] = await Promise.all([
        getFormDetails(ctx.owner, formId),
        getFormResponses(ctx.owner, formId),
      ]);
      return {
        ok: true,
        title: `${responses.length} response${responses.length === 1 ? "" : "s"} · ${detail.name}`,
        detail: responses.length > 0 ? "Latest applicant submissions parsed from Google Forms." : "No submissions received yet. Share the form link to collect applicants.",
        rows: responses.slice(0, 8).map((r) => ({
          label: r.applicantName,
          value: [r.location, r.experience, r.applicantPhone || r.applicantEmail].filter(Boolean).join(" · "),
        })),
        links: [
          { label: "Open Forms studio", href: "/app/forms" },
          { label: "Google Forms analytics", href: detail.responsesUrl, external: true },
        ],
      };
    }

    case "export_form_to_sheet": {
      const files = await listWorkspaceFiles(20);
      const latestForm = files.find((f) => f.kind === "form");
      const formId = args.formId ? extractFormId(String(args.formId)) : latestForm ? extractFormId(latestForm.url) : "demo-tele-caller-intake";
      if (!google.connected) {
        return {
          ok: true,
          simulated: true,
          title: "Google Sheets is not connected",
          detail: "Connect Google Workspace to export parsed form responses into a real Google Sheet.",
          links: [{ label: "Open Forms studio", href: "/app/forms" }],
        };
      }
      const [detail, responses] = formId.startsWith("demo-")
        ? [{ name: "Application Form" }, demoFormResponses(formId)]
        : await Promise.all([getFormDetails(ctx.owner, formId), getFormResponses(ctx.owner, formId)]);

      const header = ["Submitted At", "Applicant", "Email", "Phone", "Location", "Experience", "Highlights"];
      const rows = responses.map((r) => [
        new Date(r.lastSubmittedTime).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
        r.applicantName,
        r.applicantEmail,
        r.applicantPhone,
        r.location,
        r.experience,
        r.items.slice(-2).map((item) => `${item.question}: ${item.answer}`).join(" | "),
      ]);
      const sheetTitle = String(args.sheetTitle ?? "").trim() || `${detail.name} — Applicants`;
      const sheet = await createSheet(ctx.owner, sheetTitle, header, { rows });
      await addWorkspaceFile({ name: sheet.name, kind: "sheet", url: sheet.url });
      await writeAudit({
        actor: ctx.actor,
        action: "form_exported_to_sheet",
        target: sheetTitle,
        detail: `${responses.length} responses · ${sheet.url}`,
        surface: "forms",
      });
      return {
        ok: true,
        title: "Responses exported to Google Sheets",
        detail: `${responses.length} applicant${responses.length === 1 ? "" : "s"} written to “${sheet.name}”.`,
        rows: [
          { label: "Spreadsheet", value: sheet.name },
          { label: "Applicants", value: String(responses.length) },
        ],
        links: [{ label: "Open sheet", href: sheet.url, external: true }],
      };
    }

    case "create_hiring_kit": {
      const roleTitle = String(args.roleTitle ?? args.title ?? "").trim() || "Tele Caller";
      if (!google.connected) {
        return {
          ok: true,
          simulated: true,
          title: `Hiring kit planned for ${roleTitle}`,
          detail: "Connect Google Workspace first, then approve to create the Drive Folder, Tracker Sheet, and Application Form automatically.",
          rows: [
            { label: "1. Drive Folder", value: `Hiring · ${roleTitle}` },
            { label: "2. Tracker Sheet", value: `Hiring Tracker — ${roleTitle}` },
            { label: "3. Google Form", value: `${roleTitle} — Application Form` },
          ],
          links: [{ label: "Open Connections", href: "/app/connections" }],
        };
      }
      const folder = await createDriveFolder(ctx.owner, `Hiring · ${roleTitle}`);
      await addWorkspaceFile({ name: folder.name, kind: "folder", url: folder.url });

      const sheet = await createSheet(
        ctx.owner,
        `Hiring Tracker — ${roleTitle}`,
        ["Candidate Name", "Phone", "Email", "City", "Languages", "Stage", "Score", "Decision", "Notes"],
        { folderId: folder.id },
      );
      await addWorkspaceFile({ name: sheet.name, kind: "sheet", url: sheet.url });

      const form = await createApplicationForm(ctx.owner, roleTitle);
      await addWorkspaceFile({ name: form.name, kind: "form", url: form.formUrl });

      await writeAudit({
        actor: ctx.actor,
        action: "hiring_kit_created",
        target: roleTitle,
        detail: `Folder + Sheet + Form created`,
        surface: "workspace",
      });

      return {
        ok: true,
        title: `Complete hiring kit created for ${roleTitle}`,
        detail: "Created your Drive folder, candidate tracking spreadsheet, and live Google Application Form.",
        rows: [
          { label: "Drive Folder", value: folder.name },
          { label: "Tracker Sheet", value: sheet.name },
          { label: "Application Form", value: `${form.name} (${form.questionCount} questions)` },
        ],
        links: [
          { label: "Open Folder", href: folder.url, external: true },
          { label: "Open Sheet", href: sheet.url, external: true },
          { label: "Open Form", href: form.formUrl, external: true },
        ],
      };
    }

    case "generate_offer_letter": {
      const rawName = String(args.query ?? args.candidateName ?? "").trim();
      let candidate: (typeof candidates)[number] | null = null;
      if (rawName) {
        try {
          candidate = resolveCandidate(rawName);
        } catch {
          candidate = null;
        }
      }
      const candidateName = candidate?.name ?? (rawName || "Candidate");
      const roleTitle = String(args.roleTitle ?? "").trim() || candidate?.roleTitle || "Customer Support Executive";
      const compensation = String(args.compensation ?? args.salary ?? "").trim() || "₹28,000 / month (₹3.36 LPA)";
      const startDate = String(args.startDate ?? "").trim() || "Next Monday";
      const location = String(args.location ?? "").trim() || candidate?.location || "Bengaluru / Hybrid";

      const docTitle = `Offer Letter — ${candidateName} (${roleTitle})`;
      const docBody = offerLetterDocument({
        candidateName,
        candidateEmail: candidate?.email,
        roleTitle,
        compensation,
        startDate,
        location,
        org: demoWorkspace.org.name,
        recruiterName: ctx.actor,
      });

      if (!google.connected) {
        return {
          ok: true,
          simulated: true,
          title: `Offer letter drafted for ${candidateName}`,
          detail: "Connect Google Workspace to create this as a Google Doc in Drive. Open Offer Studio to preview and customise.",
          rows: [
            { label: "Candidate", value: candidateName },
            { label: "Role", value: roleTitle },
            { label: "Compensation", value: compensation },
            { label: "Start Date", value: startDate },
          ],
          links: [{ label: "Open Offer Studio", href: "/app/offer" }],
        };
      }

      const doc = await createDoc(ctx.owner, docTitle, docBody);
      await addWorkspaceFile({ name: doc.name, kind: "doc", url: doc.url });

      const links: { label: string; href: string; external?: boolean }[] = [
        { label: "Open Offer Doc", href: doc.url, external: true },
      ];

      if (Boolean(args.draftEmail) && candidate?.email) {
        const draft = await createMailDraft(ctx.owner, {
          to: [candidate.email],
          subject: `Offer of Employment — ${roleTitle} at ${demoWorkspace.org.name}`,
          body: offerEmail({
            candidateName,
            candidateEmail: candidate.email,
            roleTitle,
            compensation,
            startDate,
            location,
            org: demoWorkspace.org.name,
            recruiterName: ctx.actor,
          }),
        });
        links.push({ label: "Open Gmail Draft", href: draft.link, external: true });
      }

      await writeAudit({
        actor: ctx.actor,
        action: "offer_letter_created",
        target: candidateName,
        detail: `${roleTitle} · ${compensation} · ${doc.url}`,
        surface: "drive",
      });

      return {
        ok: true,
        title: `Offer letter created for ${candidateName}`,
        detail: `Saved to Google Docs as “${docTitle}”. Review before sharing with the candidate.`,
        rows: [
          { label: "Role", value: roleTitle },
          { label: "Compensation", value: compensation },
          { label: "Joining Date", value: startDate },
          { label: "Location", value: location },
        ],
        links,
      };
    }

    case "pipeline_summary": {
      const decisions = await listLatestDecisions();
      const hydrated = candidates.map((c) => {
        const d = decisions.get(c.id);
        if (!d) return c;
        if (d.action === "shortlist") return { ...c, stage: "shortlisted" as const };
        if (d.action === "scheduled") return { ...c, stage: "scheduled" as const };
        if (d.action === "review") return { ...c, stage: "in_review" as const };
        if (d.action === "close") return { ...c, stage: "closed" as const };
        return c;
      });
      const filterStage = String(args.stage ?? "").trim().toLowerCase();
      const stages = ["invited", "interviewed", "in_review", "shortlisted", "scheduled", "closed"] as const;
      const rows = filterStage
        ? hydrated
            .filter((c) => c.stage === filterStage)
            .slice(0, 8)
            .map((c) => ({
              label: c.name,
              value: `${c.roleTitle} · ${c.score.overall.toFixed(1)}/5`,
            }))
        : stages.map((stage) => {
            const list = hydrated.filter((c) => c.stage === stage);
            const names = list.slice(0, 2).map((c) => c.name.split(" ")[0]).join(", ");
            return {
              label: stage.replace(/_/g, " ").replace(/^\w/, (ch) => ch.toUpperCase()),
              value: `${list.length}${names ? ` · ${names}${list.length > 2 ? "…" : ""}` : ""}`,
            };
          });
      return {
        ok: true,
        title: filterStage ? `Pipeline · ${filterStage.replace(/_/g, " ")}` : `Hiring pipeline · ${hydrated.length} candidates`,
        detail: "Live stage breakdown reflecting your latest recruiter decisions.",
        rows,
        links: [{ label: "Open Pipeline Board", href: "/app/pipeline" }],
      };
    }

    case "move_candidate_stage": {
      const candidate = resolveCandidate(String(args.query ?? ""));
      const rawStage = String(args.stage ?? "").toLowerCase().trim();
      const actionMap: Record<string, "shortlist" | "scheduled" | "review" | "close"> = {
        shortlist: "shortlist",
        shortlisted: "shortlist",
        schedule: "scheduled",
        scheduled: "scheduled",
        review: "review",
        in_review: "review",
        "in review": "review",
        close: "close",
        closed: "close",
      };
      const action = actionMap[rawStage];
      if (!action) {
        throw new ToolError("Choose a stage: shortlisted, scheduled, in_review, or closed.");
      }
      await addDecision({
        candidateId: candidate.id,
        roleId: candidate.roleId,
        action,
        reason: action === "close" ? String(args.note ?? "Recruiter decision") : null,
        note: args.note ? String(args.note) : null,
        actor: ctx.actor,
      });
      await writeAudit({
        actor: ctx.actor,
        action: `stage_${action}`,
        target: candidate.name,
        detail: `Moved to ${rawStage} via voice command`,
        surface: "voice",
      });
      return {
        ok: true,
        title: `${candidate.name} moved to ${rawStage.replace(/_/g, " ")}`,
        detail: "Updated in the hiring pipeline. No external email was sent.",
        rows: [
          { label: "Candidate", value: candidate.name },
          { label: "New stage", value: rawStage.replace(/_/g, " ") },
        ],
        links: [
          { label: "Open Pipeline", href: "/app/pipeline" },
          { label: "Open Candidate", href: candidateLink(candidate.id, candidate.roleId) },
        ],
      };
    }

    case "draft_email": {
      let toList = Array.isArray(args.to) ? (args.to as string[]).flatMap(emailAddresses) : emailAddresses(String(args.to ?? ""));
      if (toList.length === 0 && args.to) {
        try {
          const candidate = resolveCandidate(String(args.to));
          toList = [candidate.email];
        } catch {
          /* handled below */
        }
      }
      if (toList.length === 0) throw new ToolError("Provide a valid recipient email or candidate name.");
      const subject = String(args.subject ?? "").trim() || "Follow-up from HireVoice";
      const body = String(args.body ?? "").trim() || "Hi,\n\nFollowing up regarding your application.\n\nWarmly,\nRecruiting Team";

      if (!google.connected) {
        return {
          ok: true,
          simulated: true,
          title: "Gmail draft prepared locally",
          detail: "Connect Gmail in Connections to save drafts directly in your mailbox.",
          rows: [
            { label: "To", value: toList.join(", ") },
            { label: "Subject", value: subject },
          ],
          links: [{ label: "Open Mail", href: "/app/mail" }],
        };
      }

      const draft = await createMailDraft(ctx.owner, { to: toList, subject, body });
      await writeAudit({
        actor: ctx.actor,
        action: "email_drafted",
        target: toList.join(", "),
        detail: subject,
        surface: "mail",
      });
      return {
        ok: true,
        title: "Gmail draft saved",
        detail: `Saved to Drafts for ${toList.join(", ")}. Nothing was sent.`,
        rows: [
          { label: "To", value: toList.join(", ") },
          { label: "Subject", value: subject },
        ],
        links: [{ label: "Open draft in Gmail", href: draft.link, external: true }],
      };
    }

    case "calendar_free_slots": {
      const days = Math.min(Math.max(Number(args.days ?? 2) || 2, 1), 5);
      const startDay = startOfIstDay(new Date());
      const endDay = addDays(startDay, days);
      const local = await listLocalEvents(startDay.toISOString(), endDay.toISOString());
      let external: CalendarEvent[] = [];
      if (google.connected) {
        external = await listCalendarEvents(ctx.owner, startDay.toISOString(), endDay.toISOString()).catch(() => []);
      } else {
        external = demoCalendarEvents();
      }
      const busy = [...external, ...local].map((event) => ({
        start: new Date(event.start).getTime(),
        end: new Date(event.end).getTime(),
      }));

      const slots: { label: string; value: string }[] = [];
      const nowMs = Date.now() + 30 * 60_000;
      for (let d = 0; d < days && slots.length < 6; d += 1) {
        const dayKey = istDateKey(addDays(startDay, d));
        for (const hour of [10, 11, 14, 15, 16, 17]) {
          if (slots.length >= 6) break;
          const slotStart = istAt(dayKey, hour, 0);
          const slotEnd = new Date(slotStart.getTime() + 30 * 60_000);
          if (slotStart.getTime() < nowMs) continue;
          const overlaps = busy.some((b) => slotStart.getTime() < b.end && slotEnd.getTime() > b.start);
          if (!overlaps) {
            slots.push({
              label: d === 0 ? "Today" : d === 1 ? "Tomorrow" : dayKey,
              value: formatIstRange(slotStart, slotEnd),
            });
          }
        }
      }

      return {
        ok: true,
        title: `${slots.length} open 30-min slot${slots.length === 1 ? "" : "s"} in IST`,
        detail: "Checked against your calendar. Say 'schedule [candidate] tomorrow at [time]' to book one.",
        rows: slots,
        links: [{ label: "Open Calendar", href: "/app/calendar" }],
      };
    }

    case "list_sheets": {
      const query = String(args.query ?? "").trim() || undefined;
      const files = await listWorkspaceFiles(30);
      const local = files
        .filter((f) => f.kind === "sheet")
        .map((f) => ({ id: extractSpreadsheetId(f.url), name: f.name, url: f.url, modifiedTime: f.createdAt }));
      const list = google.connected
        ? await listGoogleSheets(ctx.owner, query).catch(() => local)
        : local.length > 0
          ? local
          : demoSheets();
      return {
        ok: true,
        title: `${list.length} Google Sheet${list.length === 1 ? "" : "s"}`,
        detail: google.connected ? "Spreadsheets in your Google Drive & workspace." : "Showing sample hiring sheets. Connect Google for live Drive sheets.",
        rows: list.slice(0, 8).map((s) => ({ label: s.name, value: s.id.slice(0, 18) })),
        links: [
          { label: "Open Sheets Studio", href: "/app/sheets" },
          ...(list[0] && !list[0].id.startsWith("demo-") ? [{ label: "Open latest sheet", href: list[0].url, external: true }] : []),
        ],
      };
    }

    case "read_sheet": {
      const ref = String(args.sheet ?? args.spreadsheetId ?? "").trim();
      let resolvedId = "";
      if (ref && (ref.includes("/spreadsheets/d/") || /^[a-zA-Z0-9-_]{25,}$/.test(ref))) {
        resolvedId = extractSpreadsheetId(ref);
      } else if (google.connected) {
        const driveSheets = await listGoogleSheets(ctx.owner, ref || undefined).catch(() => []);
        const files = await listWorkspaceFiles(20);
        const local = files.filter((f) => f.kind === "sheet");
        const match =
          driveSheets.find((s) => !ref || s.name.toLowerCase().includes(ref.toLowerCase())) ??
          driveSheets[0];
        if (match) resolvedId = match.id;
        else if (local[0]) resolvedId = extractSpreadsheetId(local[0].url);
      } else {
        const demos = demoSheets();
        resolvedId =
          demos.find((s) => ref && s.name.toLowerCase().includes(ref.toLowerCase()))?.id ?? demos[0].id;
      }

      if (!resolvedId) {
        throw new ToolError("No Google Sheet found. Create one first or paste its URL in Sheets Studio.");
      }

      const data =
        !google.connected || resolvedId.startsWith("demo-")
          ? demoSheetData(resolvedId)
          : await readGoogleSheet(ctx.owner, resolvedId, args.tab ? String(args.tab) : undefined);

      const h = data.health;
      const messy =
        h.trimmedCells +
        h.normalizedNames +
        h.normalizedEmails +
        h.normalizedPhones +
        h.normalizedCities +
        h.normalizedStages;

      return {
        ok: true,
        title: `${data.name} · ${h.totalRawRows} rows`,
        detail: `Tab “${data.activeTab}” scanned. Found ${messy} messy cell fix${messy === 1 ? "" : "es"}, ${h.duplicatesDetected} duplicate${h.duplicatesDetected === 1 ? "" : "s"}, ${h.blankRowsSkipped} blank row${h.blankRowsSkipped === 1 ? "" : "s"}, and ${h.issueCount} flagged issue${h.issueCount === 1 ? "" : "s"}. Say “clean this sheet” to fix non-destructively.`,
        rows: [
          { label: "Total rows", value: String(h.totalRawRows) },
          { label: "Messy cells fixable", value: String(messy) },
          { label: "Duplicate leads", value: String(h.duplicatesDetected) },
          { label: "Blank rows", value: String(h.blankRowsSkipped) },
          { label: "Invalid contacts / flags", value: String(h.issueCount) },
        ],
        links: [
          { label: "Open Sheets Studio", href: "/app/sheets" },
          ...(!data.demo ? [{ label: "Open in Google Sheets", href: data.url, external: true }] : []),
        ],
      };
    }

    case "clean_sheet": {
      const ref = String(args.sheet ?? args.spreadsheetId ?? "").trim();
      const instruction = args.instruction ? String(args.instruction).trim() : undefined;
      const target = String(args.target ?? "new_tab") === "new_sheet" ? "new_sheet" : "new_tab";

      let resolvedId = "";
      if (ref && (ref.includes("/spreadsheets/d/") || /^[a-zA-Z0-9-_]{25,}$/.test(ref))) {
        resolvedId = extractSpreadsheetId(ref);
      } else if (google.connected) {
        const driveSheets = await listGoogleSheets(ctx.owner, ref || undefined).catch(() => []);
        const files = await listWorkspaceFiles(20);
        const local = files.filter((f) => f.kind === "sheet");
        const match =
          driveSheets.find((s) => !ref || s.name.toLowerCase().includes(ref.toLowerCase())) ??
          driveSheets[0];
        if (match) resolvedId = match.id;
        else if (local[0]) resolvedId = extractSpreadsheetId(local[0].url);
      } else {
        const demos = demoSheets();
        resolvedId =
          demos.find((s) => ref && s.name.toLowerCase().includes(ref.toLowerCase()))?.id ?? demos[0].id;
      }

      if (!resolvedId) {
        throw new ToolError("No spreadsheet found to clean. Create a sheet first or open one in Sheets Studio.");
      }

      const isDemo = !google.connected || resolvedId.startsWith("demo-");
      const data = isDemo ? demoSheetData(resolvedId) : await readGoogleSheet(ctx.owner, resolvedId);
      const cleaned = await smartCleanWithInstruction(data.rows, { instruction });
      const r = cleaned.report;
      const messy =
        r.trimmedCells +
        r.normalizedNames +
        r.normalizedEmails +
        r.normalizedPhones +
        r.normalizedCities +
        r.normalizedStages;

      if (isDemo) {
        return {
          ok: true,
          simulated: true,
          title: `Cleaned preview ready for “${data.name}”`,
          detail: `${r.totalRawRows} raw rows → ${r.cleanedRowCount} clean rows (${messy} cell fixes, ${r.duplicatesDetected} duplicates resolved, ${r.blankRowsSkipped} blank rows skipped). Connect Google Workspace to write the Cleaned tab directly into Drive.`,
          rows: [
            { label: "Clean rows", value: `${r.cleanedRowCount} (from ${r.totalRawRows})` },
            { label: "Names & casing fixed", value: String(r.normalizedNames) },
            { label: "Phones standardized", value: String(r.normalizedPhones) },
            { label: "Emails cleaned", value: String(r.normalizedEmails) },
            { label: "Cities & stages normalized", value: String(r.normalizedCities + r.normalizedStages) },
            { label: "Duplicates resolved", value: String(r.duplicatesDetected) },
          ],
          links: [{ label: "Open Sheets Studio", href: "/app/sheets" }],
        };
      }

      if (target === "new_sheet") {
        const created = await createCleanedSheet(ctx.owner, data.name, cleaned.cleanedRows);
        await addWorkspaceFile({ name: created.name, kind: "sheet", url: created.url });
        await writeAudit({
          actor: ctx.actor,
          action: "sheet_cleaned_new_file",
          target: created.name,
          detail: `${r.cleanedRowCount} clean rows · ${r.duplicatesDetected} duplicates resolved`,
          surface: "voice",
        });
        return {
          ok: true,
          title: `Saved cleaned sheet “${created.name}”`,
          detail: `${r.totalRawRows} raw rows → ${r.cleanedRowCount} clean rows. Original sheet was left untouched.${cleaned.aiNote ? ` ${cleaned.aiNote}` : ""}`,
          rows: [
            { label: "Clean rows", value: String(r.cleanedRowCount) },
            { label: "Cell formatting fixes", value: String(messy) },
            { label: "Duplicates resolved", value: String(r.duplicatesDetected) },
            { label: "Flagged issues remaining", value: String(r.issueCount) },
          ],
          links: [
            { label: "Open Cleaned Sheet", href: created.url, external: true },
            { label: "Open Sheets Studio", href: "/app/sheets" },
          ],
        };
      }

      const tabResult = await writeCleanedTab(ctx.owner, resolvedId, data.activeTab, cleaned.cleanedRows);
      await writeAudit({
        actor: ctx.actor,
        action: "sheet_cleaned_new_tab",
        target: data.name,
        detail: `Tab “${tabResult.tabTitle}” · ${r.cleanedRowCount} clean rows`,
        surface: "voice",
      });
      return {
        ok: true,
        title: `Cleaned data saved to tab “${tabResult.tabTitle}”`,
        detail: `${r.totalRawRows} raw rows → ${r.cleanedRowCount} clean rows (${messy} cell fixes, ${r.duplicatesDetected} duplicates resolved, ${r.blankRowsSkipped} blank rows skipped). Original tab “${data.activeTab}” was preserved untouched.${cleaned.aiNote ? ` ${cleaned.aiNote}` : ""}`,
        rows: [
          { label: "New tab", value: tabResult.tabTitle },
          { label: "Clean rows", value: String(r.cleanedRowCount) },
          { label: "Phones & emails fixed", value: String(r.normalizedPhones + r.normalizedEmails) },
          { label: "Cities & stages normalized", value: String(r.normalizedCities + r.normalizedStages) },
          { label: "Duplicates resolved", value: String(r.duplicatesDetected) },
        ],
        links: [
          { label: "Open in Google Sheets", href: tabResult.url, external: true },
          { label: "Open Sheets Studio", href: "/app/sheets" },
        ],
      };
    }

    default:
      throw new ToolError(`Unknown tool: ${tool}`);
  }
}
