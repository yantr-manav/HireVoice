import { NextResponse } from "next/server";
import { apiContext, assertSameOrigin, jsonError, readJson } from "@/lib/api/http";
import { googleConnection } from "@/lib/google/auth";
import { createSheet } from "@/lib/google/services";
import { demoSheets, extractSpreadsheetId, listGoogleSheets } from "@/lib/google/sheets";
import { addWorkspaceFile, listWorkspaceFiles, writeAudit } from "@/lib/db/repo";
import type { SheetSummary } from "@/lib/types";

export const dynamic = "force-dynamic";

const SHEET_TEMPLATES: Record<string, { label: string; header: string[] }> = {
  tele_caller: {
    label: "Tele Caller Hiring Tracker",
    header: ["Candidate Name", "Email", "Phone", "City", "Languages", "Role", "Stage", "Score", "Notes"],
  },
  walkin_leads: {
    label: "Walk-in & Job Fair Leads",
    header: ["Candidate Name", "Email", "Phone", "City", "Experience", "Preferred Shift", "Stage", "Source"],
  },
  interview_panel: {
    label: "Interview Schedule & Panel",
    header: ["Candidate Name", "Role", "Interview Date", "Time (IST)", "Interviewer", "Meet Link", "Decision", "Notes"],
  },
};

export async function GET(request: Request) {
  try {
    const ctx = await apiContext();
    const url = new URL(request.url);
    const query = url.searchParams.get("q")?.trim() || undefined;
    const google = await googleConnection(ctx.owner);

    const files = await listWorkspaceFiles(40);
    const localSheets: SheetSummary[] = files
      .filter((f) => f.kind === "sheet")
      .map((f) => ({
        id: extractSpreadsheetId(f.url),
        name: f.name,
        url: f.url,
        modifiedTime: f.createdAt,
      }));

    if (!google.connected) {
      const merged = localSheets.length > 0 ? localSheets : demoSheets();
      return NextResponse.json(
        {
          connection: google,
          source: "demo",
          sheets: merged,
          templates: SHEET_TEMPLATES,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    let driveSheets: SheetSummary[] = [];
    let warning: string | null = null;
    try {
      driveSheets = await listGoogleSheets(ctx.owner, query);
    } catch (error) {
      warning = error instanceof Error ? error.message : "Could not list Drive spreadsheets.";
    }

    const byId = new Map<string, SheetSummary>();
    for (const sheet of [...driveSheets, ...localSheets]) {
      if (sheet.id && !byId.has(sheet.id)) byId.set(sheet.id, sheet);
    }

    return NextResponse.json(
      {
        connection: google,
        source: "google",
        sheets: Array.from(byId.values()),
        templates: SHEET_TEMPLATES,
        warning,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const ctx = await apiContext();
    const body = await readJson<{ title?: string; template?: string; header?: string }>(request);
    const title = (body.title ?? "").trim();
    if (!title) {
      return NextResponse.json({ error: "Provide a spreadsheet title." }, { status: 400 });
    }

    const google = await googleConnection(ctx.owner);
    if (!google.connected) {
      return NextResponse.json(
        { error: "Connect Google Workspace first to create a live Google Sheet.", code: "google_not_connected" },
        { status: 409 },
      );
    }

    const customHeader = (body.header ?? "")
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    const templateHeader = body.template ? SHEET_TEMPLATES[body.template]?.header : undefined;
    const header =
      customHeader.length > 0
        ? customHeader
        : templateHeader ?? ["Candidate Name", "Email", "Phone", "City", "Role", "Stage", "Notes"];

    const file = await createSheet(ctx.owner, title, header);
    await addWorkspaceFile({ name: file.name, kind: "sheet", url: file.url });
    await writeAudit({
      actor: ctx.actor,
      action: "sheet_created",
      target: title,
      detail: file.url,
      surface: "drive",
    });

    return NextResponse.json(
      {
        sheet: { id: file.id, name: file.name, url: file.url, modifiedTime: file.createdAt },
        message: `Google Sheet “${file.name}” created.`,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return jsonError(error);
  }
}
