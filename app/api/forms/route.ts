import { NextResponse } from "next/server";
import { apiContext, assertSameOrigin, jsonError, readJson } from "@/lib/api/http";
import { googleConnection } from "@/lib/google/auth";
import {
  createApplicationForm,
  demoForms,
  extractFormId,
  FORM_PRESETS,
  type FormPresetKey,
} from "@/lib/google/forms";
import { addWorkspaceFile, listWorkspaceFiles, writeAudit } from "@/lib/db/repo";
import type { FormFile, FormQuestion } from "@/lib/types";

export const dynamic = "force-dynamic";

type CreateFormBody = {
  roleTitle?: string;
  description?: string;
  preset?: FormPresetKey;
  questions?: FormQuestion[];
};

export async function GET() {
  try {
    const ctx = await apiContext();
    const google = await googleConnection(ctx.owner);
    const files = await listWorkspaceFiles(40);
    const storedForms: FormFile[] = files
      .filter((file) => file.kind === "form")
      .map((file) => {
        const formId = extractFormId(file.url);
        return {
          formId,
          name: file.name,
          formUrl: file.url,
          editUrl: `https://docs.google.com/forms/d/${formId}/edit`,
          responsesUrl: `https://docs.google.com/forms/d/${formId}/viewanalytics`,
          questionCount: 0,
          createdAt: file.createdAt,
        };
      });

    const forms = storedForms.length > 0 ? storedForms : google.connected ? [] : demoForms();

    return NextResponse.json(
      {
        connection: google,
        source: google.connected ? "google" : "demo",
        forms,
        presets: Object.values(FORM_PRESETS).map(({ key, label, roleTitle, description, questions }) => ({
          key,
          label,
          roleTitle,
          description,
          questions,
        })),
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
    const body = await readJson<CreateFormBody>(request);
    const roleTitle = (body.roleTitle ?? "").trim();

    if (!roleTitle) {
      return NextResponse.json({ error: "Provide a role title for the application form." }, { status: 400 });
    }

    const google = await googleConnection(ctx.owner);
    if (!google.connected) {
      return NextResponse.json(
        {
          error: "Connect Google Workspace first to create a live Google Form in your Drive.",
          code: "google_not_connected",
        },
        { status: 409 },
      );
    }

    const form = await createApplicationForm(ctx.owner, roleTitle, {
      description: body.description,
      preset: body.preset,
      questions: Array.isArray(body.questions) && body.questions.length > 0 ? body.questions : undefined,
    });

    await addWorkspaceFile({ name: form.name, kind: "form", url: form.formUrl });
    await writeAudit({
      actor: ctx.actor,
      action: "form_created",
      target: form.name,
      detail: form.formUrl,
      surface: "forms",
    });

    return NextResponse.json(
      { form, message: `Application form created for ${roleTitle}.` },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return jsonError(error);
  }
}
