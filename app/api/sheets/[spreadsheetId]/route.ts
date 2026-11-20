import { NextResponse } from "next/server";
import { apiContext, assertSameOrigin, jsonError, readJson } from "@/lib/api/http";
import { googleConnection } from "@/lib/google/auth";
import { appendSheetRow, updateSheet } from "@/lib/google/services";
import { demoSheetData, readGoogleSheet } from "@/lib/google/sheets";
import { writeAudit } from "@/lib/db/repo";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ spreadsheetId: string }> },
) {
  try {
    const { spreadsheetId } = await context.params;
    const url = new URL(request.url);
    const tab = url.searchParams.get("tab")?.trim() || undefined;
    const ctx = await apiContext();
    const google = await googleConnection(ctx.owner);

    if (!google.connected || spreadsheetId.startsWith("demo-")) {
      return NextResponse.json(
        { source: "demo", sheet: demoSheetData(spreadsheetId) },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const sheet = await readGoogleSheet(ctx.owner, spreadsheetId, tab);
    return NextResponse.json(
      { source: "google", sheet },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return jsonError(error);
  }
}

/** Non-destructive sheet edit: append a row or update specific cell range. Deletion is unsupported. */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ spreadsheetId: string }> },
) {
  try {
    assertSameOrigin(request);
    const { spreadsheetId } = await context.params;
    const ctx = await apiContext();
    const google = await googleConnection(ctx.owner);

    if (!google.connected || spreadsheetId.startsWith("demo-")) {
      return NextResponse.json(
        { error: "Connect Google Workspace to edit live Google Sheets.", code: "google_not_connected" },
        { status: 409 },
      );
    }

    const body = await readJson<{
      action?: "append" | "update_cell";
      tab?: string;
      row?: string[];
      range?: string;
      value?: string;
    }>(request);

    if (body.action === "append") {
      const cells = Array.isArray(body.row) ? body.row.map((c) => String(c ?? "")) : [];
      if (cells.length === 0) {
        return NextResponse.json({ error: "Provide at least one cell value to append." }, { status: 400 });
      }
      const range = body.tab ? `'${body.tab.replace(/'/g, "''")}'!A1` : "A1";
      const result = await appendSheetRow(ctx.owner, spreadsheetId, cells, range);
      await writeAudit({
        actor: ctx.actor,
        action: "sheet_row_appended",
        target: spreadsheetId,
        detail: result.updatedRange,
        surface: "drive",
      });
      return NextResponse.json({ ok: true, result, message: "Row added to Google Sheet." });
    }

    if (body.action === "update_cell" && body.range) {
      const range = body.tab ? `'${body.tab.replace(/'/g, "''")}'!${body.range}` : body.range;
      const result = await updateSheet(ctx.owner, spreadsheetId, range, [[String(body.value ?? "")]]);
      await writeAudit({
        actor: ctx.actor,
        action: "sheet_cell_updated",
        target: spreadsheetId,
        detail: result.updatedRange,
        surface: "drive",
      });
      return NextResponse.json({ ok: true, result, message: "Cell updated." });
    }

    return NextResponse.json({ error: "Unsupported sheet action." }, { status: 400 });
  } catch (error) {
    return jsonError(error);
  }
}
