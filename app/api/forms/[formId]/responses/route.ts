import { NextResponse } from "next/server";
import { apiContext, assertSameOrigin, jsonError, readJson } from "@/lib/api/http";
import { googleConnection } from "@/lib/google/auth";
import { demoFormResponses, demoForms, getFormDetails, getFormResponses } from "@/lib/google/forms";
import { createSheet } from "@/lib/google/services";
import { addWorkspaceFile, writeAudit } from "@/lib/db/repo";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ formId: string }> },
) {
  try {
    const { formId } = await context.params;
    const ctx = await apiContext();
    const google = await googleConnection(ctx.owner);

    if (!google.connected || formId.startsWith("demo-")) {
      const demo = demoForms().find((entry) => entry.formId === formId) ?? demoForms()[0];
      const responses = demoFormResponses(demo.formId);
      return NextResponse.json(
        { source: "demo", formName: demo.name, responses },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const [detail, responses] = await Promise.all([
      getFormDetails(ctx.owner, formId),
      getFormResponses(ctx.owner, formId),
    ]);

    return NextResponse.json(
      { source: "google", formName: detail.name, responses },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return jsonError(error);
  }
}

/** Export parsed form responses directly into a new Google Sheet in Drive. */
export async function POST(
  request: Request,
  context: { params: Promise<{ formId: string }> },
) {
  try {
    assertSameOrigin(request);
    const { formId } = await context.params;
    const ctx = await apiContext();
    const google = await googleConnection(ctx.owner);

    if (!google.connected) {
      return NextResponse.json(
        { error: "Connect Google Workspace first to export responses to Google Sheets.", code: "google_not_connected" },
        { status: 409 },
      );
    }

    const body = await readJson<{ sheetTitle?: string }>(request).catch(() => ({ sheetTitle: undefined }));
    const [detail, responses] = formId.startsWith("demo-")
      ? [
          { name: demoForms().find((f) => f.formId === formId)?.name ?? "Application Form" },
          demoFormResponses(formId),
        ]
      : await Promise.all([getFormDetails(ctx.owner, formId), getFormResponses(ctx.owner, formId)]);

    // Collect union of all human-readable question headers in order
    const questionColumns: string[] = [];
    for (const resp of responses) {
      for (const item of resp.items) {
        if (!questionColumns.includes(item.question)) {
          questionColumns.push(item.question);
        }
      }
    }

    const header =
      questionColumns.length > 0
        ? ["Submitted At", "Applicant", "Email", "Phone", ...questionColumns.filter((q) => !/^(Full Name|Email Address|Phone \/ WhatsApp Number)$/i.test(q))]
        : ["Submitted At", "Applicant", "Email", "Phone", "Location", "Experience"];

    const rows = responses.map((resp) => {
      if (questionColumns.length === 0) {
        return [
          resp.lastSubmittedTime,
          resp.applicantName,
          resp.applicantEmail,
          resp.applicantPhone,
          resp.location,
          resp.experience,
        ];
      }
      const extraCols = questionColumns.filter((q) => !/^(Full Name|Email Address|Phone \/ WhatsApp Number)$/i.test(q));
      return [
        new Date(resp.lastSubmittedTime).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
        resp.applicantName,
        resp.applicantEmail,
        resp.applicantPhone,
        ...extraCols.map((col) => resp.answers[col] ?? ""),
      ];
    });

    const title = body.sheetTitle?.trim() || `${detail.name} — Applicants`;
    const sheet = await createSheet(ctx.owner, title, header, { rows });
    await addWorkspaceFile({ name: sheet.name, kind: "sheet", url: sheet.url });
    await writeAudit({
      actor: ctx.actor,
      action: "form_exported_to_sheet",
      target: title,
      detail: `${responses.length} applicants exported · ${sheet.url}`,
      surface: "forms",
    });

    return NextResponse.json(
      {
        sheet,
        exportedCount: responses.length,
        message: `Exported ${responses.length} response${responses.length === 1 ? "" : "s"} to Google Sheets.`,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return jsonError(error);
  }
}
