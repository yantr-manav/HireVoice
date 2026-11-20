import { NextResponse } from "next/server";
import { apiContext, assertSameOrigin, jsonError, readJson } from "@/lib/api/http";
import { googleConnection } from "@/lib/google/auth";
import {
  createCleanedSheet,
  demoSheetData,
  readGoogleSheet,
  smartCleanWithInstruction,
  writeCleanedTab,
  type CleanOptions,
} from "@/lib/google/sheets";
import { addWorkspaceFile, writeAudit } from "@/lib/db/repo";

export const dynamic = "force-dynamic";

type CleanBody = {
  mode?: "preview" | "apply";
  target?: "new_tab" | "new_sheet";
  tab?: string;
  options?: CleanOptions;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ spreadsheetId: string }> },
) {
  try {
    assertSameOrigin(request);
    const { spreadsheetId } = await context.params;
    const ctx = await apiContext();
    const google = await googleConnection(ctx.owner);
    const body = await readJson<CleanBody>(request);

    const mode = body.mode ?? "preview";
    const target = body.target ?? "new_tab";
    const isDemo = !google.connected || spreadsheetId.startsWith("demo-");

    const sheet = isDemo
      ? demoSheetData(spreadsheetId)
      : await readGoogleSheet(ctx.owner, spreadsheetId, body.tab);

    const cleaned = await smartCleanWithInstruction(sheet.rows, body.options ?? {});

    if (mode === "preview") {
      return NextResponse.json(
        {
          mode: "preview",
          source: isDemo ? "demo" : "google",
          sheetName: sheet.name,
          activeTab: sheet.activeTab,
          cleanedRows: cleaned.cleanedRows,
          report: cleaned.report,
          aiApplied: cleaned.aiApplied,
          aiNote: cleaned.aiNote,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    if (isDemo) {
      return NextResponse.json(
        {
          mode: "apply",
          simulated: true,
          sheetName: sheet.name,
          cleanedRows: cleaned.cleanedRows,
          report: cleaned.report,
          aiApplied: cleaned.aiApplied,
          aiNote: cleaned.aiNote,
          message: "Preview applied locally. Connect Google Workspace to save cleaned tabs directly to Drive.",
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    if (target === "new_sheet") {
      const created = await createCleanedSheet(ctx.owner, sheet.name, cleaned.cleanedRows);
      await addWorkspaceFile({ name: created.name, kind: "sheet", url: created.url });
      await writeAudit({
        actor: ctx.actor,
        action: "sheet_cleaned_new_file",
        target: created.name,
        detail: `${cleaned.report.cleanedRowCount} clean rows · ${cleaned.report.duplicatesDetected} duplicates resolved`,
        surface: "drive",
      });
      return NextResponse.json(
        {
          mode: "apply",
          target: "new_sheet",
          created,
          cleanedRows: cleaned.cleanedRows,
          report: cleaned.report,
          aiApplied: cleaned.aiApplied,
          aiNote: cleaned.aiNote,
          message: `Saved cleaned data to new Google Sheet “${created.name}”. Original sheet untouched.`,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const tabResult = await writeCleanedTab(ctx.owner, spreadsheetId, sheet.activeTab, cleaned.cleanedRows);
    await writeAudit({
      actor: ctx.actor,
      action: "sheet_cleaned_new_tab",
      target: sheet.name,
      detail: `Created tab “${tabResult.tabTitle}” · ${cleaned.report.cleanedRowCount} clean rows`,
      surface: "drive",
    });

    return NextResponse.json(
      {
        mode: "apply",
        target: "new_tab",
        tab: tabResult,
        cleanedRows: cleaned.cleanedRows,
        report: cleaned.report,
        aiApplied: cleaned.aiApplied,
        aiNote: cleaned.aiNote,
        message: `Cleaned data saved to new tab “${tabResult.tabTitle}”. Your raw tab was preserved untouched.`,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return jsonError(error);
  }
}
