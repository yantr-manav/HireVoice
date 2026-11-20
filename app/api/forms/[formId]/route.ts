import { NextResponse } from "next/server";
import { apiContext, assertSameOrigin, jsonError, readJson } from "@/lib/api/http";
import { googleConnection } from "@/lib/google/auth";
import {
  demoFormResponses,
  demoForms,
  getFormDetails,
  updateApplicationForm,
} from "@/lib/google/forms";
import { writeAudit } from "@/lib/db/repo";
import type { FormQuestion } from "@/lib/types";

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
        {
          source: "demo",
          form: {
            ...demo,
            questions: (responses[0]?.items ?? []).map((item) => ({
              questionId: item.questionId,
              title: item.question,
              required: true,
              kind: "text" as const,
            })),
            responseCount: responses.length,
          },
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const form = await getFormDetails(ctx.owner, formId);
    return NextResponse.json(
      { source: "google", form },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return jsonError(error);
  }
}

/** Append questions or update form description. Deletion is intentionally disabled. */
export async function PATCH(
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
        { error: "Connect Google Workspace first to update a live form.", code: "google_not_connected" },
        { status: 409 },
      );
    }

    const body = await readJson<{ description?: string; addQuestions?: FormQuestion[] }>(request);
    const form = await updateApplicationForm(ctx.owner, formId, {
      description: body.description,
      addQuestions: body.addQuestions,
    });

    await writeAudit({
      actor: ctx.actor,
      action: "form_updated",
      target: form.name,
      detail: body.addQuestions?.length
        ? `Added ${body.addQuestions.length} question(s)`
        : "Updated form description",
      surface: "forms",
    });

    return NextResponse.json(
      { form, message: "Application form updated." },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return jsonError(error);
  }
}
