import "server-only";
import { google } from "googleapis";
import type { forms_v1 } from "googleapis";
import { getAuthorizedClient } from "@/lib/google/auth";
import { GoogleScopeError } from "@/lib/google/services";
import type {
  FormAnswerItem,
  FormDetail,
  FormFile,
  FormQuestion,
  FormQuestionKind,
  FormResponse,
} from "@/lib/types";

export type FormPresetKey = "tele_caller" | "customer_support" | "technical_support" | "collections" | "general";

export type FormPreset = {
  key: FormPresetKey;
  label: string;
  roleTitle: string;
  description: string;
  questions: FormQuestion[];
};

const CORE_QUESTIONS: FormQuestion[] = [
  { title: "Full Name", required: true, kind: "text" },
  { title: "Email Address", required: true, kind: "text" },
  { title: "Phone / WhatsApp Number", required: true, kind: "text" },
  { title: "Current City & Location", required: true, kind: "text" },
  {
    title: "Languages Spoken Fluently",
    required: true,
    kind: "checkbox",
    options: ["English", "Hindi", "Hinglish", "Marathi", "Tamil", "Telugu", "Kannada"],
  },
  {
    title: "Total Relevant Experience",
    required: true,
    kind: "multiple_choice",
    options: ["Fresher (0–6 months)", "6 months – 1 year", "1 – 3 years", "3+ years"],
  },
  {
    title: "Preferred Shift Availability",
    required: true,
    kind: "multiple_choice",
    options: ["Day shift (IST)", "Rotational shifts", "Night / US-UK shift", "Flexible"],
  },
];

export const FORM_PRESETS: Record<FormPresetKey, FormPreset> = {
  tele_caller: {
    key: "tele_caller",
    label: "Tele Caller / Outbound Sales",
    roleTitle: "Tele Caller Executive",
    description:
      "Apply for our Tele Caller & Outbound Sales role. Shortlisted applicants receive a 4-minute voice screen link.",
    questions: [
      ...CORE_QUESTIONS,
      {
        title: "Have you worked with outbound calling targets or CRM tools before?",
        required: true,
        kind: "multiple_choice",
        options: ["Yes, regularly", "Some experience", "No, eager to learn"],
      },
      {
        title: "Tell us briefly how you handle a busy customer who says they don't have time to talk.",
        required: true,
        kind: "paragraph",
      },
      { title: "Earliest Joining Date & Notice Period", required: true, kind: "text" },
    ],
  },
  customer_support: {
    key: "customer_support",
    label: "Customer Support Executive",
    roleTitle: "Customer Support Executive",
    description:
      "Apply for our Voice Customer Support role. Takes 2 minutes — our recruiting team reviews every submission personally.",
    questions: [
      ...CORE_QUESTIONS,
      {
        title: "Which support channels have you handled?",
        kind: "checkbox",
        options: ["Inbound Voice", "Chat / WhatsApp", "Email / Ticketing", "None yet"],
      },
      {
        title: "Describe a time you calmed down an upset customer or solved a tricky problem.",
        required: true,
        kind: "paragraph",
      },
      { title: "Expected Monthly Take-Home Salary (INR)", kind: "text" },
    ],
  },
  technical_support: {
    key: "technical_support",
    label: "Technical Support Specialist",
    roleTitle: "Technical Support Specialist",
    description:
      "Application form for L1/L2 Technical Support. Share your troubleshooting background and shift availability.",
    questions: [
      ...CORE_QUESTIONS,
      {
        title: "Technical tools or platforms you are comfortable troubleshooting",
        required: true,
        kind: "paragraph",
      },
      {
        title: "Comfort level guiding non-technical callers step by step over phone",
        required: true,
        kind: "multiple_choice",
        options: ["Very comfortable", "Comfortable with a guide", "Still building confidence"],
      },
      { title: "Expected CTC / Monthly Compensation", kind: "text" },
    ],
  },
  collections: {
    key: "collections",
    label: "Collections & Retention",
    roleTitle: "Collections & Retention Associate",
    description:
      "Apply for our empathetic Collections & Retention team. Clear communication and compliance come first.",
    questions: [
      ...CORE_QUESTIONS,
      {
        title: "Prior experience in billing, renewals, or soft collections",
        required: true,
        kind: "multiple_choice",
        options: ["Yes, 1+ year", "Under 1 year", "No prior collections experience"],
      },
      {
        title: "How do you keep a payment reminder call firm yet respectful?",
        required: true,
        kind: "paragraph",
      },
    ],
  },
  general: {
    key: "general",
    label: "General Hiring Intake",
    roleTitle: "Open Role",
    description: "General candidate intake form for HireVoice screening.",
    questions: [
      ...CORE_QUESTIONS,
      { title: "Why are you interested in this role?", required: true, kind: "paragraph" },
      { title: "Earliest Joining Date", kind: "text" },
    ],
  },
};

export function defaultQuestionsForRole(roleTitle: string, preset?: FormPresetKey): FormQuestion[] {
  if (preset && FORM_PRESETS[preset]) return FORM_PRESETS[preset].questions;
  const lower = roleTitle.toLowerCase();
  if (/(tele\s*caller|telecaller|sales|outbound|bde|calling)/.test(lower)) return FORM_PRESETS.tele_caller.questions;
  if (/(tech|it|l1|l2|helpdesk|troubleshoot)/.test(lower)) return FORM_PRESETS.technical_support.questions;
  if (/(collection|retention|billing|recovery|renewal)/.test(lower)) return FORM_PRESETS.collections.questions;
  if (/(support|customer|care|service|bpo|voice)/.test(lower)) return FORM_PRESETS.customer_support.questions;
  return FORM_PRESETS.general.questions;
}

export function extractFormId(value: string): string {
  const match = value.match(/\/forms\/d\/(?:e\/)?([a-zA-Z0-9-_]+)/);
  return match?.[1] ?? value.trim();
}

function isScopeError(error: unknown) {
  const message = error instanceof Error ? error.message : JSON.stringify(error);
  return (
    message.includes("insufficient") ||
    message.includes("insufficientPermissions") ||
    message.includes("403") ||
    message.includes("Forms API has not been used")
  );
}

async function withForms<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Forms API has not been used") || message.includes("SERVICE_DISABLED")) {
      throw new Error(
        "Google Forms API is not enabled in your Google Cloud project yet. Enable 'Google Forms API' in Cloud Console → APIs & Services → Library, then retry.",
      );
    }
    if (isScopeError(error)) {
      throw new GoogleScopeError("Google Forms (reconnect Google Workspace to grant forms.body & forms.responses.readonly)");
    }
    throw error;
  }
}

function buildQuestionRequest(question: FormQuestion, index: number): forms_v1.Schema$Request {
  const kind = question.kind ?? "text";
  let questionBody: forms_v1.Schema$Question;

  if (kind === "multiple_choice" || kind === "checkbox") {
    const options = (question.options ?? []).map((opt) => opt.trim()).filter(Boolean);
    const safeOptions = options.length > 0 ? options : ["Yes", "No"];
    questionBody = {
      required: Boolean(question.required),
      choiceQuestion: {
        type: kind === "checkbox" ? "CHECKBOX" : "RADIO",
        options: safeOptions.map((value) => ({ value })),
      },
    };
  } else {
    questionBody = {
      required: Boolean(question.required),
      textQuestion: {
        paragraph: kind === "paragraph",
      },
    };
  }

  return {
    createItem: {
      item: {
        title: question.title.trim(),
        description: question.description?.trim() || undefined,
        questionItem: {
          question: questionBody,
        },
      },
      location: { index },
    },
  };
}

export async function createApplicationForm(
  owner: string,
  roleTitle: string,
  options: {
    description?: string;
    questions?: FormQuestion[];
    preset?: FormPresetKey;
  } = {},
): Promise<FormFile> {
  const cleanRole = roleTitle.trim() || "Open Role";
  const formTitle = cleanRole.toLowerCase().includes("form") || cleanRole.toLowerCase().includes("application")
    ? cleanRole
    : `${cleanRole} — Application Form`;
  const description =
    options.description?.trim() ||
    `Apply for the ${cleanRole} position. Every application is reviewed by a recruiter — shortlisted applicants receive a short voice interview link.`;
  const questions =
    options.questions && options.questions.length > 0
      ? options.questions
      : defaultQuestionsForRole(cleanRole, options.preset);

  return withForms(async () => {
    const { client } = await getAuthorizedClient(owner);
    const forms = google.forms({ version: "v1", auth: client });

    const created = await forms.forms.create({
      requestBody: {
        info: {
          title: formTitle,
          documentTitle: formTitle,
        },
      },
    });

    const formId = created.data.formId;
    if (!formId) {
      throw new Error("Google Forms did not return a form ID.");
    }

    const requests: forms_v1.Schema$Request[] = [
      {
        updateFormInfo: {
          info: {
            description,
          },
          updateMask: "description",
        },
      },
      ...questions.map((question, idx) => buildQuestionRequest(question, idx)),
    ];

    await forms.forms.batchUpdate({
      formId,
      requestBody: {
        includeFormInResponse: false,
        requests,
      },
    });

    const formUrl = created.data.responderUri || `https://docs.google.com/forms/d/${formId}/viewform`;
    return {
      formId,
      name: formTitle,
      description,
      formUrl,
      editUrl: `https://docs.google.com/forms/d/${formId}/edit`,
      responsesUrl: `https://docs.google.com/forms/d/${formId}/viewanalytics`,
      questionCount: questions.length,
      createdAt: new Date().toISOString(),
    };
  });
}

/** Add new questions or update description on an existing Google Form. Deletion is intentionally unsupported. */
export async function updateApplicationForm(
  owner: string,
  formIdOrUrl: string,
  options: {
    description?: string;
    addQuestions?: FormQuestion[];
  },
): Promise<FormDetail> {
  const formId = extractFormId(formIdOrUrl);
  return withForms(async () => {
    const { client } = await getAuthorizedClient(owner);
    const forms = google.forms({ version: "v1", auth: client });

    const existing = await forms.forms.get({ formId });
    const currentItems = existing.data.items ?? [];
    const requests: forms_v1.Schema$Request[] = [];

    if (options.description?.trim()) {
      requests.push({
        updateFormInfo: {
          info: { description: options.description.trim() },
          updateMask: "description",
        },
      });
    }

    if (options.addQuestions && options.addQuestions.length > 0) {
      options.addQuestions.forEach((question, offset) => {
        requests.push(buildQuestionRequest(question, currentItems.length + offset));
      });
    }

    if (requests.length > 0) {
      await forms.forms.batchUpdate({
        formId,
        requestBody: { requests },
      });
    }

    return getFormDetails(owner, formId);
  });
}

function inferKind(question: forms_v1.Schema$Question | undefined): FormQuestionKind {
  if (question?.choiceQuestion) {
    return question.choiceQuestion.type === "CHECKBOX" ? "checkbox" : "multiple_choice";
  }
  if (question?.textQuestion?.paragraph) return "paragraph";
  return "text";
}

export async function getFormDetails(owner: string, formIdOrUrl: string): Promise<FormDetail> {
  const formId = extractFormId(formIdOrUrl);
  return withForms(async () => {
    const { client } = await getAuthorizedClient(owner);
    const forms = google.forms({ version: "v1", auth: client });

    const [formRes, responsesRes] = await Promise.all([
      forms.forms.get({ formId }),
      forms.forms.responses.list({ formId }).catch(() => ({ data: { responses: [] } })),
    ]);

    const data = formRes.data;
    const questions = (data.items ?? [])
      .map((item) => {
        const q = item.questionItem?.question;
        if (!q?.questionId) return null;
        return {
          questionId: q.questionId,
          title: item.title || "Untitled question",
          required: Boolean(q.required),
          kind: inferKind(q),
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

    const responseCount = responsesRes.data.responses?.length ?? 0;

    return {
      formId,
      name: data.info?.title || data.info?.documentTitle || "Application Form",
      description: data.info?.description || "",
      formUrl: data.responderUri || `https://docs.google.com/forms/d/${formId}/viewform`,
      editUrl: `https://docs.google.com/forms/d/${formId}/edit`,
      responsesUrl: `https://docs.google.com/forms/d/${formId}/viewanalytics`,
      questionCount: questions.length,
      questions,
      responseCount,
    };
  });
}

function pickField(items: FormAnswerItem[], pattern: RegExp, fallback = ""): string {
  const found = items.find((item) => pattern.test(item.question));
  return found?.answer?.trim() || fallback;
}

export async function getFormResponses(owner: string, formIdOrUrl: string): Promise<FormResponse[]> {
  const formId = extractFormId(formIdOrUrl);
  return withForms(async () => {
    const { client } = await getAuthorizedClient(owner);
    const forms = google.forms({ version: "v1", auth: client });

    const [formRes, responsesRes] = await Promise.all([
      forms.forms.get({ formId }),
      forms.forms.responses.list({ formId }),
    ]);

    // Build ordered questionId -> human-readable title lookup
    const questionOrder: { id: string; title: string }[] = [];
    for (const item of formRes.data.items ?? []) {
      const qid = item.questionItem?.question?.questionId;
      if (qid) {
        questionOrder.push({ id: qid, title: item.title || `Question ${questionOrder.length + 1}` });
      }
    }
    const titleMap = new Map(questionOrder.map((q) => [q.id, q.title]));

    const rawResponses = responsesRes.data.responses ?? [];
    return rawResponses
      .map((resp): FormResponse => {
        const answersObj = resp.answers ?? {};
        const flatAnswers: Record<string, string> = {};
        const items: FormAnswerItem[] = [];

        // Preserve form question ordering first
        const seen = new Set<string>();
        for (const q of questionOrder) {
          const entry = answersObj[q.id];
          const values = entry?.textAnswers?.answers?.map((a) => a.value ?? "").filter(Boolean) ?? [];
          if (values.length > 0) {
            const joined = values.join(", ");
            flatAnswers[q.title] = joined;
            items.push({ questionId: q.id, question: q.title, answer: joined });
            seen.add(q.id);
          }
        }

        // Any extra/legacy question IDs still present in responses
        for (const [qid, entry] of Object.entries(answersObj)) {
          if (seen.has(qid)) continue;
          const values = entry?.textAnswers?.answers?.map((a) => a.value ?? "").filter(Boolean) ?? [];
          if (values.length > 0) {
            const title = titleMap.get(qid) ?? `Field ${qid}`;
            const joined = values.join(", ");
            flatAnswers[title] = joined;
            items.push({ questionId: qid, question: title, answer: joined });
          }
        }

        const applicantName =
          pickField(items, /\b(full\s*name|your\s*name|candidate\s*name|name)\b/i) ||
          resp.respondentEmail?.split("@")[0] ||
          "Applicant";
        const applicantEmail =
          pickField(items, /\b(email|e-mail)\b/i) || resp.respondentEmail || "";
        const applicantPhone = pickField(items, /\b(phone|mobile|whatsapp|contact|number)\b/i);
        const location = pickField(items, /\b(city|location|address|where)\b/i);
        const experience = pickField(items, /\b(experience|years|worked)\b/i);

        return {
          responseId: resp.responseId || `resp_${Date.now()}`,
          createTime: resp.createTime || new Date().toISOString(),
          lastSubmittedTime: resp.lastSubmittedTime || resp.createTime || new Date().toISOString(),
          applicantName,
          applicantEmail,
          applicantPhone,
          location,
          experience,
          answers: flatAnswers,
          items,
        };
      })
      .sort((a, b) => b.lastSubmittedTime.localeCompare(a.lastSubmittedTime));
  });
}

/* ---------------------------------------------------------------------------
 * Demo fallback data when Google Workspace is not connected
 * ------------------------------------------------------------------------- */

export function demoForms(): FormFile[] {
  return [
    {
      formId: "demo-tele-caller-intake",
      name: "Tele Caller Executive — Application Form",
      description:
        "Sample application intake form for Outbound Tele Caller roles. Connect Google Workspace to create live forms in Drive.",
      formUrl: "https://docs.google.com/forms",
      editUrl: "https://docs.google.com/forms",
      responsesUrl: "https://docs.google.com/forms",
      questionCount: 10,
      createdAt: new Date(Date.now() - 86_400_000 * 2).toISOString(),
      demo: true,
    },
    {
      formId: "demo-support-exec-intake",
      name: "Customer Support Executive — Application Form",
      description:
        "Sample voice support screening form with language fluency, shift preference, and scenario response.",
      formUrl: "https://docs.google.com/forms",
      editUrl: "https://docs.google.com/forms",
      responsesUrl: "https://docs.google.com/forms",
      questionCount: 10,
      createdAt: new Date(Date.now() - 86_400_000 * 5).toISOString(),
      demo: true,
    },
  ];
}

export function demoFormResponses(formId: string): FormResponse[] {
  const now = Date.now();
  if (formId === "demo-support-exec-intake") {
    return [
      {
        responseId: "demo-resp-3",
        createTime: new Date(now - 3_600_000 * 4).toISOString(),
        lastSubmittedTime: new Date(now - 3_600_000 * 4).toISOString(),
        applicantName: "Ananya Deshmukh",
        applicantEmail: "ananya.deshmukh@example.com",
        applicantPhone: "+91 98204 51209",
        location: "Pune",
        experience: "1 – 3 years",
        answers: {
          "Full Name": "Ananya Deshmukh",
          "Email Address": "ananya.deshmukh@example.com",
          "Phone / WhatsApp Number": "+91 98204 51209",
          "Current City & Location": "Pune",
          "Languages Spoken Fluently": "English, Hindi, Marathi",
          "Total Relevant Experience": "1 – 3 years",
          "Preferred Shift Availability": "Day shift (IST)",
          "Describe a time you calmed down an upset customer or solved a tricky problem.":
            "A billing customer was charged twice before a weekend trip. I acknowledged the frustration immediately, verified the duplicate auth, initiated the instant reversal, and sent an SMS reference number within 4 minutes.",
        },
        items: [
          { questionId: "q1", question: "Full Name", answer: "Ananya Deshmukh" },
          { questionId: "q2", question: "Email Address", answer: "ananya.deshmukh@example.com" },
          { questionId: "q3", question: "Phone / WhatsApp Number", answer: "+91 98204 51209" },
          { questionId: "q4", question: "Current City & Location", answer: "Pune" },
          { questionId: "q5", question: "Languages Spoken Fluently", answer: "English, Hindi, Marathi" },
          { questionId: "q6", question: "Total Relevant Experience", answer: "1 – 3 years" },
          { questionId: "q7", question: "Preferred Shift Availability", answer: "Day shift (IST)" },
          {
            questionId: "q8",
            question: "Describe a time you calmed down an upset customer or solved a tricky problem.",
            answer:
              "A billing customer was charged twice before a weekend trip. I acknowledged the frustration immediately, verified the duplicate auth, initiated the instant reversal, and sent an SMS reference number within 4 minutes.",
          },
        ],
      },
    ];
  }

  return [
    {
      responseId: "demo-resp-1",
      createTime: new Date(now - 3_600_000 * 2).toISOString(),
      lastSubmittedTime: new Date(now - 3_600_000 * 2).toISOString(),
      applicantName: "Vikram Reddy",
      applicantEmail: "vikram.reddy@example.com",
      applicantPhone: "+91 98480 23194",
      location: "Hyderabad",
      experience: "1 – 3 years",
      answers: {
        "Full Name": "Vikram Reddy",
        "Email Address": "vikram.reddy@example.com",
        "Phone / WhatsApp Number": "+91 98480 23194",
        "Current City & Location": "Hyderabad",
        "Languages Spoken Fluently": "English, Hindi, Telugu",
        "Total Relevant Experience": "1 – 3 years",
        "Preferred Shift Availability": "Day shift (IST)",
        "Tell us briefly how you handle a busy customer who says they don't have time to talk.":
          "I respect their time right away, share the single key benefit in 15 seconds, and ask for a specific 2-minute callback slot later in the day.",
        "Earliest Joining Date & Notice Period": "Immediate (0 days)",
      },
      items: [
        { questionId: "q1", question: "Full Name", answer: "Vikram Reddy" },
        { questionId: "q2", question: "Email Address", answer: "vikram.reddy@example.com" },
        { questionId: "q3", question: "Phone / WhatsApp Number", answer: "+91 98480 23194" },
        { questionId: "q4", question: "Current City & Location", answer: "Hyderabad" },
        { questionId: "q5", question: "Languages Spoken Fluently", answer: "English, Hindi, Telugu" },
        { questionId: "q6", question: "Total Relevant Experience", answer: "1 – 3 years" },
        { questionId: "q7", question: "Preferred Shift Availability", answer: "Day shift (IST)" },
        {
          questionId: "q8",
          question: "Tell us briefly how you handle a busy customer who says they don't have time to talk.",
          answer:
            "I respect their time right away, share the single key benefit in 15 seconds, and ask for a specific 2-minute callback slot later in the day.",
        },
        { questionId: "q9", question: "Earliest Joining Date & Notice Period", answer: "Immediate (0 days)" },
      ],
    },
    {
      responseId: "demo-resp-2",
      createTime: new Date(now - 3_600_000 * 7).toISOString(),
      lastSubmittedTime: new Date(now - 3_600_000 * 7).toISOString(),
      applicantName: "Neha Kulkarni",
      applicantEmail: "neha.kulkarni@example.com",
      applicantPhone: "+91 97651 88410",
      location: "Bengaluru",
      experience: "6 months – 1 year",
      answers: {
        "Full Name": "Neha Kulkarni",
        "Email Address": "neha.kulkarni@example.com",
        "Phone / WhatsApp Number": "+91 97651 88410",
        "Current City & Location": "Bengaluru",
        "Languages Spoken Fluently": "English, Hindi, Kannada",
        "Total Relevant Experience": "6 months – 1 year",
        "Preferred Shift Availability": "Rotational shifts",
        "Tell us briefly how you handle a busy customer who says they don't have time to talk.":
          "I apologise for interrupting, confirm whether evening or tomorrow morning works better, and send a short WhatsApp summary if they prefer reading first.",
        "Earliest Joining Date & Notice Period": "15 days notice",
      },
      items: [
        { questionId: "q1", question: "Full Name", answer: "Neha Kulkarni" },
        { questionId: "q2", question: "Email Address", answer: "neha.kulkarni@example.com" },
        { questionId: "q3", question: "Phone / WhatsApp Number", answer: "+91 97651 88410" },
        { questionId: "q4", question: "Current City & Location", answer: "Bengaluru" },
        { questionId: "q5", question: "Languages Spoken Fluently", answer: "English, Hindi, Kannada" },
        { questionId: "q6", question: "Total Relevant Experience", answer: "6 months – 1 year" },
        { questionId: "q7", question: "Preferred Shift Availability", answer: "Rotational shifts" },
        {
          questionId: "q8",
          question: "Tell us briefly how you handle a busy customer who says they don't have time to talk.",
          answer:
            "I apologise for interrupting, confirm whether evening or tomorrow morning works better, and send a short WhatsApp summary if they prefer reading first.",
        },
        { questionId: "q9", question: "Earliest Joining Date & Notice Period", answer: "15 days notice" },
      ],
    },
  ];
}
