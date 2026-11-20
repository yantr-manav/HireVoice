import { NextResponse } from "next/server";
import { apiContext, assertSameOrigin, jsonError, readJson } from "@/lib/api/http";
import { googleConnection } from "@/lib/google/auth";
import { createDoc, createDriveFolder, createSheet } from "@/lib/google/services";
import { createApplicationForm } from "@/lib/google/forms";
import { addWorkspaceFile, writeAudit } from "@/lib/db/repo";

export const dynamic = "force-dynamic";

type Body = {
  kind?: "sheet" | "folder" | "doc" | "form";
  title?: string;
  header?: string;
  rows?: string;
  body?: string;
};

function splitHeader(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((cell) => cell.trim())
    .filter(Boolean);
}

function splitRows(value: string | undefined): string[][] {
  return (value ?? "")
    .split(";")
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => row.split("|").map((cell) => cell.trim()));
}

/** Direct, human-clicked Workspace writes from the Connections screen. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const ctx = await apiContext();
    const body = await readJson<Body>(request);
    const kind = body.kind;
    const title = (body.title ?? "").trim();
    if (!kind || !title) {
      return NextResponse.json({ error: "A file kind and title are required." }, { status: 400 });
    }

    const google = await googleConnection(ctx.owner);
    if (!google.connected) {
      return NextResponse.json(
        { error: "Connect Google Workspace first.", code: "google_not_connected" },
        { status: 409 },
      );
    }

    if (kind === "sheet") {
      const header = splitHeader(body.header);
      const file = await createSheet(ctx.owner, title, header.length ? header : [
        "Candidate",
        "Role",
        "Stage",
        "Decision",
        "Notes",
      ], { rows: splitRows(body.rows) });
      await addWorkspaceFile({ name: file.name, kind: "sheet", url: file.url });
      await writeAudit({
        actor: ctx.actor,
        action: "sheet_created",
        target: title,
        detail: file.url,
        surface: "drive",
      });
      return NextResponse.json({ file, header, message: "Google Sheet created." }, { headers: { "Cache-Control": "no-store" } });
    }

    if (kind === "folder") {
      const file = await createDriveFolder(ctx.owner, title);
      await addWorkspaceFile({ name: file.name, kind: "folder", url: file.url });
      await writeAudit({
        actor: ctx.actor,
        action: "folder_created",
        target: title,
        detail: file.url,
        surface: "drive",
      });
      return NextResponse.json({ file, message: "Drive folder created." }, { headers: { "Cache-Control": "no-store" } });
    }

    if (kind === "form") {
      const form = await createApplicationForm(ctx.owner, title);
      const file = await addWorkspaceFile({ name: form.name, kind: "form", url: form.formUrl });
      await writeAudit({
        actor: ctx.actor,
        action: "form_created",
        target: form.name,
        detail: form.formUrl,
        surface: "forms",
      });
      return NextResponse.json(
        { file, form, message: "Google Application Form created." },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const file = await createDoc(
      ctx.owner,
      title,
      body.body?.trim() ||
        body.rows?.trim() ||
        "Created from the Hirevoice desk.\n\nReplace this text with the interview summary or role notes.",
    );
    await addWorkspaceFile({ name: file.name, kind: "doc", url: file.url });
    await writeAudit({
      actor: ctx.actor,
      action: "doc_created",
      target: title,
      detail: file.url,
      surface: "drive",
    });
    return NextResponse.json({ file, message: "Google Doc created." }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}
