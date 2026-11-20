import "server-only";
import { google } from "googleapis";
import { getAuthorizedClient } from "@/lib/google/auth";
import { createSheet, GoogleScopeError } from "@/lib/google/services";
import { aiConfigured } from "@/lib/ai/keys";
import { generateJson } from "@/lib/ai/gemini";
import { aiModels } from "@/lib/config";
import type {
  SheetCellChange,
  SheetCellIssue,
  SheetCleanReport,
  SheetData,
  SheetSummary,
} from "@/lib/types";

export type CleanOptions = {
  trimWhitespace?: boolean;
  fixCasing?: boolean;
  standardizePhones?: boolean;
  standardizeEmails?: boolean;
  standardizeCities?: boolean;
  standardizeStages?: boolean;
  deduplicate?: boolean;
  skipBlankRows?: boolean;
  instruction?: string;
};

export const DEFAULT_CLEAN_OPTIONS: Required<Omit<CleanOptions, "instruction">> = {
  trimWhitespace: true,
  fixCasing: true,
  standardizePhones: true,
  standardizeEmails: true,
  standardizeCities: true,
  standardizeStages: true,
  deduplicate: true,
  skipBlankRows: true,
};

export function extractSpreadsheetId(value: string): string {
  const match = value.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match?.[1] ?? value.trim();
}

function isScopeError(error: unknown) {
  const message = error instanceof Error ? error.message : JSON.stringify(error);
  return message.includes("insufficient") || message.includes("insufficientPermissions") || message.includes("403");
}

async function withSheets<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (isScopeError(error)) {
      throw new GoogleScopeError("Google Sheets / Drive (reconnect Google Workspace to grant spreadsheets & drive access)");
    }
    throw error;
  }
}

/* ---------------------------------------------------------------------------
 * Column role detection & deterministic data normalization
 * ------------------------------------------------------------------------- */

type ColumnRole = "name" | "email" | "phone" | "city" | "stage" | "role" | "score" | "notes" | "other";

function detectColumnRole(header: string): ColumnRole {
  const h = header.toLowerCase().trim();
  if (/(email|e-mail|mail)/.test(h)) return "email";
  if (/(phone|mobile|whatsapp|contact|tel|number)/.test(h)) return "phone";
  if (/(city|location|place|area|region)/.test(h)) return "city";
  if (/(stage|status|decision|state|outcome)/.test(h)) return "stage";
  if (/(candidate|applicant|full\s*name|\bname\b)/.test(h)) return "name";
  if (/(role|position|job|designation|opening)/.test(h)) return "role";
  if (/(score|rating|marks|points)/.test(h)) return "score";
  if (/(note|comment|remark|feedback|summary)/.test(h)) return "notes";
  return "other";
}

function cleanSpaces(value: string): string {
  return value.replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim();
}

function toTitleCase(value: string): string {
  const smallWords = new Set(["of", "and", "in", "for", "at", "to", "the", "on", "or"]);
  return value
    .split(" ")
    .filter(Boolean)
    .map((word, index) => {
      // Preserve well-known acronyms
      if (/^(bpo|crm|hr|it|l1|l2|ncr|ist|us|uk|ctc|lpa|inr)$/i.test(word)) {
        return word.toUpperCase();
      }
      const lower = word.toLowerCase();
      if (index > 0 && smallWords.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function normalizeEmail(raw: string): { value: string; valid: boolean } {
  const cleaned = cleanSpaces(raw)
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/,+/g, ".")
    .replace(/\.+$/g, "");
  if (!cleaned) return { value: "", valid: true };
  return { value: cleaned, valid: EMAIL_RE.test(cleaned) };
}

function normalizeIndianPhone(raw: string): { value: string; digits: string; valid: boolean } {
  const cleaned = cleanSpaces(raw);
  if (!cleaned) return { value: "", digits: "", valid: true };
  const digitsOnly = cleaned.replace(/\D/g, "");
  // Strip leading 91 or 0 for 10-digit Indian mobile numbers
  let core = digitsOnly;
  if (core.length === 12 && core.startsWith("91")) core = core.slice(2);
  else if (core.length === 11 && core.startsWith("0")) core = core.slice(1);

  if (core.length === 10 && /^[6-9]/.test(core)) {
    return {
      value: `+91 ${core.slice(0, 5)} ${core.slice(5)}`,
      digits: core,
      valid: true,
    };
  }
  if (digitsOnly.length >= 10 && digitsOnly.length <= 15) {
    return { value: `+${digitsOnly}`, digits: digitsOnly.slice(-10), valid: true };
  }
  return { value: cleaned, digits: digitsOnly, valid: false };
}

const CITY_MAP: Record<string, string> = {
  blr: "Bengaluru",
  bangalore: "Bengaluru",
  bengaluru: "Bengaluru",
  hyd: "Hyderabad",
  hyderabad: "Hyderabad",
  bom: "Mumbai",
  bombay: "Mumbai",
  mumbai: "Mumbai",
  del: "Delhi NCR",
  delhi: "Delhi NCR",
  "new delhi": "Delhi NCR",
  ncr: "Delhi NCR",
  gurgaon: "Gurugram",
  gurugram: "Gurugram",
  noida: "Noida",
  pun: "Pune",
  pune: "Pune",
  maa: "Chennai",
  madras: "Chennai",
  chennai: "Chennai",
  kol: "Kolkata",
  calcutta: "Kolkata",
  kolkata: "Kolkata",
  ahm: "Ahmedabad",
  amdavad: "Ahmedabad",
  ahmedabad: "Ahmedabad",
  jaipur: "Jaipur",
  indore: "Indore",
  kochi: "Kochi",
  cochin: "Kochi",
};

function normalizeCity(raw: string): string {
  const cleaned = cleanSpaces(raw);
  if (!cleaned) return "";
  const key = cleaned.toLowerCase().replace(/[^a-z\s]/g, "").trim();
  return CITY_MAP[key] ?? toTitleCase(cleaned);
}

function normalizeStage(raw: string): string {
  const cleaned = cleanSpaces(raw);
  if (!cleaned) return "";
  const lower = cleaned.toLowerCase().replace(/[_-]+/g, " ");
  if (/^(shortlist|shortlisted|selected|pass|passed|strong|hire|yes)$/.test(lower)) return "Shortlisted";
  if (/^(scheduled|schedule|interview scheduled|booked|panel|l2)$/.test(lower)) return "Scheduled";
  if (/^(in review|review|pending|hold|on hold|maybe|needs review|screening)$/.test(lower)) return "In Review";
  if (/^(interviewed|screened|completed|done)$/.test(lower)) return "Interviewed";
  if (/^(invited|new|applied|lead|sourced|fresh)$/.test(lower)) return "Invited";
  if (/^(closed|reject|rejected|declined|not moving forward|drop|dropped|no show|no)$/.test(lower)) return "Closed";
  return toTitleCase(cleaned);
}

/**
 * Deterministic, fast, zero-quota data cleaner for messy hiring spreadsheets.
 * Never mutates the input array; returns cleaned rows + a detailed diff & quality report.
 */
export function analyzeAndCleanRows(
  rawRows: string[][],
  options: CleanOptions = {},
): { cleanedRows: string[][]; report: SheetCleanReport } {
  const opts = { ...DEFAULT_CLEAN_OPTIONS, ...options };
  if (rawRows.length === 0) {
    return {
      cleanedRows: [],
      report: {
        totalRawRows: 0,
        cleanedRowCount: 0,
        trimmedCells: 0,
        normalizedNames: 0,
        normalizedEmails: 0,
        normalizedPhones: 0,
        normalizedCities: 0,
        normalizedStages: 0,
        duplicatesDetected: 0,
        blankRowsSkipped: 0,
        issueCount: 0,
        issues: [],
        changes: [],
      },
    };
  }

  const maxCols = Math.max(...rawRows.map((r) => r.length), 1);
  const rawHeader = rawRows[0];
  const header = Array.from({ length: maxCols }, (_, c) => {
    const val = cleanSpaces(String(rawHeader[c] ?? ""));
    return val ? (val === val.toLowerCase() || val === val.toUpperCase() ? toTitleCase(val) : val) : `Column ${c + 1}`;
  });
  const roles = header.map(detectColumnRole);

  let trimmedCells = 0;
  let normalizedNames = 0;
  let normalizedEmails = 0;
  let normalizedPhones = 0;
  let normalizedCities = 0;
  let normalizedStages = 0;
  let duplicatesDetected = 0;
  let blankRowsSkipped = 0;

  const issues: SheetCellIssue[] = [];
  const changes: SheetCellChange[] = [];
  const seenEmails = new Set<string>();
  const seenPhones = new Set<string>();
  const seenNameCity = new Set<string>();

  const cleanedBody: string[][] = [];

  for (let rIdx = 1; rIdx < rawRows.length; rIdx += 1) {
    const rowNum = rIdx + 1; // 1-indexed spreadsheet row number
    const rawRow = rawRows[rIdx] ?? [];
    const padded = Array.from({ length: maxCols }, (_, c) => String(rawRow[c] ?? ""));

    const isBlank = padded.every((cell) => cleanSpaces(cell) === "");
    if (isBlank) {
      if (opts.skipBlankRows) {
        blankRowsSkipped += 1;
        continue;
      }
    }

    const nextRow: string[] = [];
    let rowEmailKey = "";
    let rowPhoneKey = "";
    let rowNameKey = "";
    let rowCityKey = "";

    for (let c = 0; c < maxCols; c += 1) {
      const original = padded[c];
      const colName = header[c];
      const role = roles[c];

      let current = opts.trimWhitespace ? cleanSpaces(original) : original;
      if (current !== original) {
        trimmedCells += 1;
      }

      let reason = current !== original ? "Trimmed extra spaces" : "";

      if (current) {
        if (role === "email" && opts.standardizeEmails) {
          const res = normalizeEmail(current);
          if (res.value !== current) {
            normalizedEmails += 1;
            reason = "Standardized email format";
          }
          current = res.value;
          rowEmailKey = res.value;
          if (!res.valid) {
            issues.push({
              rowIndex: rowNum,
              column: colName,
              value: current,
              kind: "invalid_email",
              message: `Invalid email address “${current}”`,
            });
          }
        } else if (role === "phone" && opts.standardizePhones) {
          const res = normalizeIndianPhone(current);
          if (res.value !== current) {
            normalizedPhones += 1;
            reason = "Standardized phone number";
          }
          current = res.value;
          rowPhoneKey = res.digits;
          if (!res.valid) {
            issues.push({
              rowIndex: rowNum,
              column: colName,
              value: current,
              kind: "invalid_phone",
              message: `Incomplete or invalid phone “${current}”`,
            });
          }
        } else if (role === "city" && opts.standardizeCities) {
          const norm = normalizeCity(current);
          if (norm !== current) {
            normalizedCities += 1;
            reason = "Normalized city name";
          }
          current = norm;
          rowCityKey = norm.toLowerCase();
        } else if (role === "stage" && opts.standardizeStages) {
          const norm = normalizeStage(current);
          if (norm !== current) {
            normalizedStages += 1;
            reason = "Standardized pipeline stage";
          }
          current = norm;
        } else if ((role === "name" || role === "role") && opts.fixCasing) {
          const norm = toTitleCase(current);
          if (norm !== current) {
            normalizedNames += 1;
            reason = role === "name" ? "Formatted candidate name" : "Formatted role title";
          }
          current = norm;
          if (role === "name") rowNameKey = norm.toLowerCase();
        }
      } else if (role === "name") {
        issues.push({
          rowIndex: rowNum,
          column: colName,
          value: "",
          kind: "missing_required",
          message: "Missing candidate name",
        });
      }

      if (current !== original && changes.length < 120) {
        changes.push({
          rowIndex: rowNum,
          column: colName,
          before: original,
          after: current,
          reason: reason || "Cleaned value",
        });
      }

      nextRow.push(current);
    }

    // Duplicate detection (by email, 10-digit phone, or identical name+city when no contact exists)
    const compositeName = rowNameKey ? `${rowNameKey}|${rowCityKey}` : "";
    const isDuplicate =
      (rowEmailKey && seenEmails.has(rowEmailKey)) ||
      (rowPhoneKey && rowPhoneKey.length >= 10 && seenPhones.has(rowPhoneKey)) ||
      (!rowEmailKey && !rowPhoneKey && compositeName && seenNameCity.has(compositeName));

    if (isDuplicate) {
      duplicatesDetected += 1;
      issues.push({
        rowIndex: rowNum,
        column: header[0],
        value: nextRow[0] || rowEmailKey || rowPhoneKey,
        kind: "duplicate",
        message: `Duplicate applicant detected (${rowEmailKey || rowPhoneKey || nextRow[0]})`,
      });
      if (opts.deduplicate) {
        continue;
      }
    }

    if (rowEmailKey) seenEmails.add(rowEmailKey);
    if (rowPhoneKey && rowPhoneKey.length >= 10) seenPhones.add(rowPhoneKey);
    if (compositeName) seenNameCity.add(compositeName);

    cleanedBody.push(nextRow);
  }

  return {
    cleanedRows: [header, ...cleanedBody],
    report: {
      totalRawRows: Math.max(0, rawRows.length - 1),
      cleanedRowCount: cleanedBody.length,
      trimmedCells,
      normalizedNames,
      normalizedEmails,
      normalizedPhones,
      normalizedCities,
      normalizedStages,
      duplicatesDetected,
      blankRowsSkipped,
      issueCount: issues.length,
      issues: issues.slice(0, 60),
      changes: changes.slice(0, 80),
    },
  };
}

/**
 * Optional Gemini-assisted transformation when the recruiter supplies a custom natural-language
 * rule (e.g. "sort by score descending", "add Priority column", "extract city from notes").
 * Always runs deterministic cleaning first so free-tier tokens are only spent when needed.
 */
export async function smartCleanWithInstruction(
  rawRows: string[][],
  options: CleanOptions = {},
): Promise<{ cleanedRows: string[][]; report: SheetCleanReport; aiApplied: boolean; aiNote: string | null }> {
  const base = analyzeAndCleanRows(rawRows, options);
  const instruction = options.instruction?.trim();

  if (!instruction || !aiConfigured() || base.cleanedRows.length <= 1 || base.cleanedRows.length > 65) {
    return { ...base, aiApplied: false, aiNote: null };
  }

  // Only invoke Gemini if the instruction asks for something beyond standard cleanup
  const standardOnly = /^(clean|fix|normalize|standardize|deduplicate|dedupe|tidy|polish)(\s+(this|the|my|messy|data|sheet|spreadsheet|rows|leads|candidates))*\.?$/i.test(
    instruction,
  );
  if (standardOnly) {
    return { ...base, aiApplied: false, aiNote: null };
  }

  try {
    const response = await generateJson<{ note?: string; rows?: unknown }>({
      system: `You are a recruiting data operations specialist cleaning a hiring spreadsheet.
Apply the recruiter's transformation instruction cleanly to the provided 2D table (first row is headers).
Rules:
- Preserve truthful candidate data; never invent emails or phone numbers.
- Keep every row the same column length as the header row.
- Never delete all rows; only filter/sort/format/enrich as requested.
Return JSON only: {"note":"1 sentence describing what changed","rows":[["Header1","Header2"],["val1","val2"]]}`,
      prompt: `Instruction: ${instruction}\n\nTable JSON:\n${JSON.stringify(base.cleanedRows)}`,
      temperature: 0.1,
      maxOutputTokens: 4000,
      model: aiModels.fast,
    });

    const aiRows = response?.data?.rows;
    if (
      Array.isArray(aiRows) &&
      aiRows.length >= 1 &&
      Array.isArray(aiRows[0]) &&
      aiRows[0].length > 0
    ) {
      const colLen = aiRows[0].length;
      const sanitized: string[][] = aiRows
        .filter((r): r is unknown[] => Array.isArray(r))
        .map((r) => Array.from({ length: colLen }, (_, idx) => String(r[idx] ?? "").trim()));
      return {
        cleanedRows: sanitized,
        report: {
          ...base.report,
          cleanedRowCount: Math.max(0, sanitized.length - 1),
        },
        aiApplied: true,
        aiNote: typeof response?.data?.note === "string" ? response.data.note : "Applied custom AI transformation.",
      };
    }
  } catch {
    /* fall back gracefully to deterministic clean */
  }

  return { ...base, aiApplied: false, aiNote: null };
}

/* ---------------------------------------------------------------------------
 * Live Google Sheets API v4 + Drive listing operations
 * ------------------------------------------------------------------------- */

export async function listGoogleSheets(owner: string, query?: string): Promise<SheetSummary[]> {
  return withSheets(async () => {
    const { client } = await getAuthorizedClient(owner);
    const drive = google.drive({ version: "v3", auth: client });
    const parts = ["trashed = false", "mimeType = 'application/vnd.google-apps.spreadsheet'"];
    if (query?.trim()) {
      parts.push(`name contains '${query.trim().replace(/'/g, "\\'")}'`);
    }
    const res = await drive.files.list({
      q: parts.join(" and "),
      pageSize: 30,
      orderBy: "modifiedTime desc",
      fields: "files(id,name,modifiedTime,webViewLink)",
    });
    return (res.data.files ?? []).map((f) => ({
      id: f.id ?? "",
      name: f.name ?? "Untitled spreadsheet",
      url: f.webViewLink ?? `https://docs.google.com/spreadsheets/d/${f.id}/edit`,
      modifiedTime: f.modifiedTime ?? new Date().toISOString(),
    }));
  });
}

export async function readGoogleSheet(
  owner: string,
  spreadsheetIdOrUrl: string,
  tabName?: string,
): Promise<SheetData> {
  const spreadsheetId = extractSpreadsheetId(spreadsheetIdOrUrl);
  return withSheets(async () => {
    const { client } = await getAuthorizedClient(owner);
    const sheets = google.sheets({ version: "v4", auth: client });

    const meta = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "spreadsheetId,properties.title,spreadsheetUrl,sheets.properties.title",
    });

    const title = meta.data.properties?.title || "Untitled Sheet";
    const url = meta.data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
    const tabs = (meta.data.sheets ?? [])
      .map((s) => s.properties?.title)
      .filter((t): t is string => Boolean(t));
    const activeTab = tabName && tabs.includes(tabName) ? tabName : tabs[0] ?? "Sheet1";

    const safeTab = `'${activeTab.replace(/'/g, "''")}'!A1:Z500`;
    const valuesRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: safeTab,
    });

    const rows = (valuesRes.data.values ?? []).map((row) => row.map((cell) => String(cell ?? "")));
    const { report } = analyzeAndCleanRows(rows);

    return {
      id: spreadsheetId,
      name: title,
      url,
      tabs,
      activeTab,
      rows,
      health: report,
    };
  });
}

/** Non-destructive: creates a new tab inside the spreadsheet and writes the cleaned rows there. */
export async function writeCleanedTab(
  owner: string,
  spreadsheetIdOrUrl: string,
  baseTabName: string,
  rows: string[][],
): Promise<{ tabTitle: string; updatedRange: string; url: string }> {
  const spreadsheetId = extractSpreadsheetId(spreadsheetIdOrUrl);
  return withSheets(async () => {
    const { client } = await getAuthorizedClient(owner);
    const sheets = google.sheets({ version: "v4", auth: client });

    const stamp = new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Kolkata",
    })
      .format(new Date())
      .replace(/[:,]/g, "");
    const tabTitle = `Cleaned · ${baseTabName.slice(0, 18)} (${stamp})`.slice(0, 90);

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: tabTitle,
                gridProperties: { frozenRowCount: 1 },
              },
            },
          },
        ],
      },
    });

    const safeRange = `'${tabTitle.replace(/'/g, "''")}'!A1`;
    const res = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: safeRange,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: rows },
    });

    return {
      tabTitle,
      updatedRange: res.data.updatedRange ?? safeRange,
      url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    };
  });
}

/** Non-destructive: writes cleaned rows into a brand-new Google Sheet in Drive. */
export async function createCleanedSheet(
  owner: string,
  originalTitle: string,
  rows: string[][],
): Promise<{ id: string; name: string; url: string }> {
  const header = rows[0] ?? ["Candidate", "Email", "Phone", "City", "Stage"];
  const body = rows.slice(1);
  const title = originalTitle.toLowerCase().includes("cleaned")
    ? originalTitle
    : `${originalTitle} (Cleaned)`;
  const file = await createSheet(owner, title, header, { rows: body });
  return { id: file.id, name: file.name, url: file.url };
}

/* ---------------------------------------------------------------------------
 * Demo messy hiring spreadsheets (so recruiters can test cleaning immediately)
 * ------------------------------------------------------------------------- */

export function demoSheets(): SheetSummary[] {
  return [
    {
      id: "demo-sheet-telecaller",
      name: "Walk-in Tele Caller Drive — Raw Leads (Messy)",
      url: "https://docs.google.com/spreadsheets",
      modifiedTime: new Date(Date.now() - 3_600_000 * 2).toISOString(),
      demo: true,
    },
    {
      id: "demo-sheet-support",
      name: "Customer Support Executive — Hiring Tracker",
      url: "https://docs.google.com/spreadsheets",
      modifiedTime: new Date(Date.now() - 86_400_000).toISOString(),
      demo: true,
    },
  ];
}

export function demoSheetData(id: string): SheetData {
  if (id === "demo-sheet-support") {
    const rows: string[][] = [
      ["candidate name", "EMAIL", "phone", "city", "role", "stage", "score", "notes"],
      ["  sana khan ", "SANA.KHAN@EXAMPLE.COM ", "9845011223", "bangalore", "customer support executive", "shortlist", "4.6", "Strong empathy & billing de-escalation"],
      ["manoj   patil", "manoj.patil@example.com", "09822033445", "pun", "Customer Support Executive", "scheduled", "4.3", "Bilingual Hindi/Marathi"],
      ["RAHUL VERMA", "rahul.verma@example.com", "+91-98111-22334", "del", "customer support executive", "pending", "3.4", "Needs verification on quote #2"],
      ["", "", "", "", "", "", "", ""],
      ["Sana Khan", "sana.khan@example.com", "919845011223", "BLR", "Customer Support Executive", "SHORTLISTED", "4.6", "Duplicate entry from job portal"],
    ];
    const { report } = analyzeAndCleanRows(rows);
    return {
      id: "demo-sheet-support",
      name: "Customer Support Executive — Hiring Tracker",
      url: "https://docs.google.com/spreadsheets",
      tabs: ["Raw Tracker"],
      activeTab: "Raw Tracker",
      rows,
      health: report,
      demo: true,
    };
  }

  const rows: string[][] = [
    ["candidate name", "email", "phone number", "city", "role", "stage", "notes"],
    ["  vikram   reddy ", "  VIKRAM.REDDY@GMAIL.COM ", "98480-23194", "hyd", "tele caller", "shortlist", "Immediate joiner, fluent Telugu/Hindi/English"],
    ["neha kulkarni", "neha.k@example.com", "09765188410", "bangalore", "TELE CALLER", "in review", "15 days notice, strong voice clarity"],
    ["", "", "", "", "", "", ""],
    ["ARJUN MEHTA", "arjun.mehta@example.com", "919820144556", "bombay", "outbound tele caller", "new", "Fresher, eager for day shift"],
    ["Vikram Reddy", "vikram.reddy@gmail.com", "+91 98480 23194", "Hyderabad", "Tele Caller", "SHORTLISTED", "Walk-in duplicate entry"],
    ["  priya  nair", "priya.nair@@badmail", "98450", "blr", "tele caller", "maybe", "Needs valid contact verification"],
    ["rohit   sharma", "rohit.sharma@example.com ", "98102 77889", "gurgaon", "tele caller", "interview scheduled", "Booked for tomorrow 3 PM IST"],
    ["DEEPika JOSHI", "deepika.joshi@example.com", "09900112233", "madras", "tele caller", "rejected", "Requested night shift only"],
  ];
  const { report } = analyzeAndCleanRows(rows);
  return {
    id: "demo-sheet-telecaller",
    name: "Walk-in Tele Caller Drive — Raw Leads (Messy)",
    url: "https://docs.google.com/spreadsheets",
    tabs: ["Raw Leads"],
    activeTab: "Raw Leads",
    rows,
    health: report,
    demo: true,
  };
}
