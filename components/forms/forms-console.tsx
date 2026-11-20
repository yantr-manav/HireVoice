"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import {
  Check,
  ClipboardList,
  Copy,
  ExternalLink,
  FileSpreadsheet,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plug,
  Plus,
  QrCode,
  RefreshCcw,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import type { FormFile, FormQuestion, FormQuestionKind, FormResponse, GoogleConnection, Workspace } from "@/lib/types";
import { cn, formatRelative } from "@/lib/utils";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { RichText } from "@/components/ui/rich-text";

type PresetSummary = {
  key: "tele_caller" | "customer_support" | "technical_support" | "collections" | "general";
  label: string;
  roleTitle: string;
  description: string;
  questions: FormQuestion[];
};

type FormsPayload = {
  connection: GoogleConnection;
  source: "google" | "demo";
  forms: FormFile[];
  presets: PresetSummary[];
  error?: string;
};

type ResponsesPayload = {
  source: "google" | "demo";
  formName: string;
  responses: FormResponse[];
  error?: string;
};

const kindLabels: Record<FormQuestionKind, string> = {
  text: "Short text",
  paragraph: "Paragraph",
  multiple_choice: "Single choice",
  checkbox: "Multi-select",
};

export function FormsConsole({ workspace }: { workspace: Workspace }) {
  const [connection, setConnection] = useState<GoogleConnection>(workspace.google);
  const [source, setSource] = useState<"google" | "demo">(workspace.google.connected ? "google" : "demo");
  const [forms, setForms] = useState<FormFile[]>([]);
  const [presets, setPresets] = useState<PresetSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedForm, setSelectedForm] = useState<FormFile | null>(null);
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [loadingResponses, setLoadingResponses] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [builderOpen, setBuilderOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [presetKey, setPresetKey] = useState<PresetSummary["key"]>("tele_caller");
  const [roleTitle, setRoleTitle] = useState("Tele Caller Executive");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<FormQuestion[]>([]);
  const [newQTitle, setNewQTitle] = useState("");
  const [newQKind, setNewQKind] = useState<FormQuestionKind>("text");
  const [newQOptions, setNewQOptions] = useState("");
  const [newQRequired, setNewQRequired] = useState(true);

  const [appendText, setAppendText] = useState("");
  const [appending, setAppending] = useState(false);
  const [qrOpen, setQrOpen] = useState<FormFile | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadForms = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/forms", { cache: "no-store" });
      const data = (await res.json()) as FormsPayload;
      if (!res.ok) throw new Error(data.error ?? "Could not load application forms.");
      setConnection(data.connection);
      setSource(data.source);
      setForms(data.forms);
      setPresets(data.presets);
      if (data.presets.length > 0 && questions.length === 0) {
        const first = data.presets[0];
        setPresetKey(first.key);
        setRoleTitle(first.roleTitle);
        setDescription(first.description);
        setQuestions(first.questions);
      }
      setSelectedForm((current) => {
        if (current && data.forms.some((f) => f.formId === current.formId)) return current;
        return data.forms[0] ?? null;
      });
    } catch (error) {
      toast.error("Forms unavailable", {
        description: error instanceof Error ? error.message : "Try again in a moment.",
      });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadResponses = useCallback(async (formId: string) => {
    setLoadingResponses(true);
    try {
      const res = await fetch(`/api/forms/${encodeURIComponent(formId)}/responses`, { cache: "no-store" });
      const data = (await res.json()) as ResponsesPayload;
      if (!res.ok) throw new Error(data.error ?? "Could not fetch form responses.");
      setResponses(data.responses);
    } catch (error) {
      setResponses([]);
      toast.error("Could not load responses", {
        description: error instanceof Error ? error.message : "Check Google Forms API permissions.",
      });
    } finally {
      setLoadingResponses(false);
    }
  }, []);

  useEffect(() => {
    void loadForms();
  }, [loadForms]);

  useEffect(() => {
    if (selectedForm) {
      void loadResponses(selectedForm.formId);
    } else {
      setResponses([]);
    }
  }, [selectedForm, loadResponses]);

  const applyPreset = (key: PresetSummary["key"]) => {
    setPresetKey(key);
    const found = presets.find((p) => p.key === key);
    if (found) {
      setRoleTitle(found.roleTitle);
      setDescription(found.description);
      setQuestions(found.questions);
    }
  };

  const addDraftQuestion = () => {
    if (!newQTitle.trim()) return;
    const options =
      newQKind === "multiple_choice" || newQKind === "checkbox"
        ? newQOptions
            .split(",")
            .map((o) => o.trim())
            .filter(Boolean)
        : undefined;
    setQuestions((current) => [
      ...current,
      {
        title: newQTitle.trim(),
        kind: newQKind,
        required: newQRequired,
        options: options && options.length > 0 ? options : undefined,
      },
    ]);
    setNewQTitle("");
    setNewQOptions("");
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!roleTitle.trim()) {
      toast.error("Enter a role title first.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleTitle: roleTitle.trim(),
          description: description.trim() || undefined,
          preset: presetKey,
          questions,
        }),
      });
      const data = (await res.json()) as { form?: FormFile; message?: string; error?: string };
      if (!res.ok || !data.form) throw new Error(data.error ?? "Form could not be created.");
      toast.success(data.message ?? "Google Form created", {
        description: data.form.name,
        action: { label: "Open form", onClick: () => window.open(data.form!.formUrl, "_blank", "noreferrer") },
      });
      setForms((current) => [data.form!, ...current.filter((f) => !f.demo)]);
      setSelectedForm(data.form);
      setBuilderOpen(false);
    } catch (error) {
      toast.error("Form was not created", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleExportToSheet = async () => {
    if (!selectedForm) return;
    setExporting(true);
    try {
      const res = await fetch(`/api/forms/${encodeURIComponent(selectedForm.formId)}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetTitle: `${selectedForm.name} — Applicants` }),
      });
      const data = (await res.json()) as { sheet?: { name: string; url: string }; message?: string; error?: string };
      if (!res.ok || !data.sheet) throw new Error(data.error ?? "Export failed.");
      toast.success(data.message ?? "Exported to Google Sheets", {
        description: data.sheet.name,
        action: { label: "Open Sheet", onClick: () => window.open(data.sheet!.url, "_blank", "noreferrer") },
      });
    } catch (error) {
      toast.error("Could not export", {
        description: error instanceof Error ? error.message : "Connect Google Workspace first.",
      });
    } finally {
      setExporting(false);
    }
  };

  const handleAppendQuestion = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedForm || !appendText.trim()) return;
    setAppending(true);
    try {
      const res = await fetch(`/api/forms/${encodeURIComponent(selectedForm.formId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addQuestions: [{ title: appendText.trim(), kind: "text", required: false }],
        }),
      });
      const data = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not add question.");
      toast.success("Question added to live Google Form", { description: appendText.trim() });
      setAppendText("");
    } catch (error) {
      toast.error("Could not update form", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setAppending(false);
    }
  };

  const copyLink = async (form: FormFile) => {
    try {
      await navigator.clipboard.writeText(form.formUrl);
      setCopiedId(form.formId);
      toast.success("Form share link copied");
      window.setTimeout(() => setCopiedId(null), 1800);
    } catch {
      toast.error("Could not copy link");
    }
  };

  return (
    <div className="mx-auto max-w-[1480px] px-4 py-5 sm:px-6 sm:py-7 xl:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate">
            <ClipboardList className="h-3.5 w-3.5" />
            Google Forms · Hiring Intake
            {connection.email ? <span className="font-mono text-[9.5px] text-slate/70">· {connection.email}</span> : null}
          </p>
          <h1 className="mt-1 font-display text-[32px] font-medium leading-none tracking-[-0.04em] text-ink sm:text-[38px]">
            Application Forms
          </h1>
          <p className="mt-1.5 max-w-[660px] text-[13px] leading-relaxed text-slate">
            Create role-specific Google Forms with structured screening questions, share QR codes for walk-in drives,
            read parsed submissions, and export applicants directly to Google Sheets — by click or voice command.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {connection.connected ? (
            <Badge tone="verified" dot>
              Google Forms live
            </Badge>
          ) : (
            <Link
              href="/app/connections"
              className="inline-flex items-center gap-1.5 rounded-[6px] border border-flag/35 bg-flag-soft px-2.5 py-1.5 text-[10.5px] font-medium text-[#6c5200] hover:border-flag"
            >
              <Plug className="h-3 w-3" />
              Connect Google for live forms
            </Link>
          )}
          <Button variant="outline" size="sm" onClick={() => void loadForms()} disabled={loading}>
            <RefreshCcw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button variant="ink" size="sm" onClick={() => setBuilderOpen((open) => !open)}>
            {builderOpen ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {builderOpen ? "Close builder" : "New application form"}
          </Button>
        </div>
      </div>

      {builderOpen ? (
        <Panel className="mt-5 overflow-hidden border-ink/20">
          <PanelHeader
            title="Create Google Application Form"
            meta="Creates a real Google Form in your Drive · no deletion"
            action={
              <span className="flex items-center gap-1.5 text-[10px] text-slate">
                <Sparkles className="h-3 w-3 text-ultramarine" />
                Voice equivalent: “Create an application form for {roleTitle || "Tele Caller"}”
              </span>
            }
          />
          <form onSubmit={handleCreate} className="grid gap-5 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div className="space-y-3.5">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate">1. Choose a hiring template</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {presets.map((preset) => (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => applyPreset(preset.key)}
                      className={cn(
                        "rounded-[6px] border px-2.5 py-1.5 text-[11px] font-medium transition",
                        presetKey === preset.key
                          ? "border-ink bg-ink text-chalk"
                          : "border-rule bg-white text-slate hover:border-slate/50 hover:text-ink",
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block">
                <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate">2. Role / Form Title</span>
                <input
                  value={roleTitle}
                  onChange={(e) => setRoleTitle(e.target.value)}
                  placeholder="e.g. Tele Caller Executive — Bengaluru"
                  className="mt-1 h-10 w-full rounded-[6px] border border-rule bg-white px-3 text-[12.5px] text-ink outline-none focus:border-ink"
                />
              </label>

              <label className="block">
                <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate">3. Candidate Instructions</span>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short instructions shown at the top of the Google Form…"
                  className="mt-1 w-full rounded-[6px] border border-rule bg-white p-2.5 text-[12px] leading-relaxed text-ink outline-none focus:border-ink"
                />
              </label>

              <div className="rounded-[8px] border border-rule bg-chalk/45 p-3">
                <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate">Add custom screening question</p>
                <div className="mt-2 space-y-2">
                  <input
                    value={newQTitle}
                    onChange={(e) => setNewQTitle(e.target.value)}
                    placeholder="e.g. Are you comfortable with 6-day rotational shifts?"
                    className="h-9 w-full rounded-[6px] border border-rule bg-white px-2.5 text-[12px] text-ink outline-none focus:border-ink"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={newQKind}
                      onChange={(e) => setNewQKind(e.target.value as FormQuestionKind)}
                      className="h-8 rounded-[6px] border border-rule bg-white px-2 text-[11px] text-ink outline-none"
                    >
                      <option value="text">Short answer</option>
                      <option value="paragraph">Long paragraph</option>
                      <option value="multiple_choice">Single choice (Radio)</option>
                      <option value="checkbox">Multi-select (Checkbox)</option>
                    </select>
                    <label className="flex items-center gap-1.5 text-[11px] text-slate">
                      <input
                        type="checkbox"
                        checked={newQRequired}
                        onChange={(e) => setNewQRequired(e.target.checked)}
                        className="rounded border-rule"
                      />
                      Required
                    </label>
                    <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={addDraftQuestion}>
                      <Plus className="h-3 w-3" />
                      Add question
                    </Button>
                  </div>
                  {(newQKind === "multiple_choice" || newQKind === "checkbox") ? (
                    <input
                      value={newQOptions}
                      onChange={(e) => setNewQOptions(e.target.value)}
                      placeholder="Options comma-separated: Yes, No, Negotiable"
                      className="h-8 w-full rounded-[6px] border border-rule bg-white px-2.5 text-[11px] text-ink outline-none focus:border-ink"
                    />
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button type="submit" variant="primary" size="md" disabled={creating || !connection.connected}>
                  {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ClipboardList className="h-3.5 w-3.5" />}
                  {connection.connected ? `Create Google Form (${questions.length} questions)` : "Connect Google Workspace first"}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setBuilderOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>

            <div className="rounded-[10px] border border-rule bg-white p-4">
              <div className="flex items-center justify-between border-b border-rule pb-2.5">
                <p className="text-[11.5px] font-semibold text-ink">Question blueprint ({questions.length})</p>
                <span className="text-[10px] text-slate">Rendered as live Google Form items</span>
              </div>
              <ol className="mt-3 max-h-[360px] space-y-2 overflow-y-auto pr-1 scroll-thin">
                {questions.map((q, idx) => (
                  <li key={`${q.title}-${idx}`} className="flex items-start gap-2.5 rounded-[7px] border border-rule/80 bg-chalk/35 px-3 py-2">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-rule bg-white font-mono text-[9px] text-slate">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11.5px] font-medium text-ink">
                        {q.title}
                        {q.required ? <span className="ml-1 text-onair">*</span> : null}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="rounded-[3px] border border-rule bg-white px-1.5 py-0.5 font-mono text-[8.5px] text-slate">
                          {kindLabels[q.kind ?? "text"]}
                        </span>
                        {q.options?.slice(0, 4).map((opt) => (
                          <span key={opt} className="rounded-[3px] bg-ultramarine-soft/60 px-1.5 py-0.5 text-[9px] text-[#2536c9]">
                            {opt}
                          </span>
                        ))}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </form>
        </Panel>
      ) : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Panel className="overflow-hidden">
          <PanelHeader
            title="Your application forms"
            meta={`${forms.length} ${source === "demo" ? "sample" : "live"}`}
          />
          {loading ? (
            <div className="flex items-center justify-center gap-2 px-4 py-12 text-[11.5px] text-slate">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading forms…
            </div>
          ) : forms.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <ClipboardList className="mx-auto h-7 w-7 text-slate/45" />
              <p className="mt-3 text-[12.5px] font-medium text-ink">No application forms yet</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate">
                Click “New application form” above or ask Vaani to create one for any role.
              </p>
              <Button variant="ink" size="sm" className="mt-3" onClick={() => setBuilderOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
                Create first form
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-rule">
              {forms.map((form) => {
                const active = selectedForm?.formId === form.formId;
                return (
                  <li key={form.formId}>
                    <button
                      type="button"
                      onClick={() => setSelectedForm(form)}
                      className={cn(
                        "w-full px-4 py-3 text-left transition",
                        active ? "bg-ultramarine-soft/55" : "hover:bg-white",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[12.5px] font-medium leading-snug text-ink">{form.name}</p>
                        {form.demo ? <Badge tone="neutral">sample</Badge> : <Badge tone="verified" dot>live</Badge>}
                      </div>
                      <p className="mt-1 font-mono text-[9.5px] text-slate">
                        {form.createdAt ? `Created ${formatRelative(form.createdAt)}` : form.formId}
                      </p>
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            void copyLink(form);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.stopPropagation();
                              void copyLink(form);
                            }
                          }}
                          className="inline-flex items-center gap-1 rounded-[4px] border border-rule bg-white px-2 py-0.5 text-[10px] text-slate hover:border-ink hover:text-ink"
                        >
                          {copiedId === form.formId ? <Check className="h-2.5 w-2.5 text-verified" /> : <Copy className="h-2.5 w-2.5" />}
                          Copy link
                        </span>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            setQrOpen(form);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.stopPropagation();
                              setQrOpen(form);
                            }
                          }}
                          className="inline-flex items-center gap-1 rounded-[4px] border border-rule bg-white px-2 py-0.5 text-[10px] text-slate hover:border-ink hover:text-ink"
                        >
                          <QrCode className="h-2.5 w-2.5" />
                          QR poster
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <div className="min-w-0 space-y-4">
          {selectedForm ? (
            <>
              <Panel className="overflow-hidden">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-rule px-5 py-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-[22px] font-medium leading-tight tracking-[-0.03em] text-ink">
                        {selectedForm.name}
                      </h2>
                      <Badge tone={selectedForm.demo ? "neutral" : "verified"}>
                        {responses.length} submission{responses.length === 1 ? "" : "s"}
                      </Badge>
                    </div>
                    {selectedForm.description ? (
                      <p className="mt-1 text-[11.5px] leading-relaxed text-slate">{selectedForm.description}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button variant="outline" size="sm" onClick={() => setQrOpen(selectedForm)}>
                      <QrCode className="h-3.5 w-3.5" />
                      QR Code
                    </Button>
                    <a
                      href={selectedForm.formUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-8 items-center gap-1.5 rounded-[6px] border border-rule bg-white px-2.5 text-[11px] font-medium text-ink hover:border-ink"
                    >
                      Open Form
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <a
                      href={selectedForm.editUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-8 items-center gap-1.5 rounded-[6px] border border-rule bg-white px-2.5 text-[11px] font-medium text-slate hover:border-ink hover:text-ink"
                    >
                      Edit in Google
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <Button
                      variant="ink"
                      size="sm"
                      disabled={exporting || responses.length === 0 || !connection.connected}
                      onClick={() => void handleExportToSheet()}
                    >
                      {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
                      Export to Google Sheet
                    </Button>
                  </div>
                </div>

                {!selectedForm.demo && connection.connected ? (
                  <form onSubmit={handleAppendQuestion} className="flex flex-wrap items-center gap-2 border-b border-rule bg-chalk/45 px-5 py-2.5">
                    <span className="text-[10.5px] font-medium text-slate">Append question:</span>
                    <input
                      value={appendText}
                      onChange={(e) => setAppendText(e.target.value)}
                      placeholder="Add a new question to this live Google Form (no deletions)…"
                      className="h-8 min-w-[240px] flex-1 rounded-[5px] border border-rule bg-white px-2.5 text-[11.5px] text-ink outline-none focus:border-ink"
                    />
                    <Button type="submit" variant="outline" size="sm" disabled={appending || !appendText.trim()}>
                      {appending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                      Add to form
                    </Button>
                  </form>
                ) : null}

                <div className="p-4 sm:p-5">
                  {loadingResponses ? (
                    <div className="flex items-center justify-center gap-2 py-12 text-[12px] text-slate">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Parsing applicant responses…
                    </div>
                  ) : responses.length === 0 ? (
                    <div className="rounded-[10px] border border-dashed border-rule bg-chalk/30 px-6 py-10 text-center">
                      <Users className="mx-auto h-6 w-6 text-slate/45" />
                      <p className="mt-2.5 text-[12.5px] font-medium text-ink">Waiting for first applicant</p>
                      <p className="mt-1 text-[11px] text-slate">
                        Share the form link or QR poster on WhatsApp, job boards, or your walk-in desk. Parsed answers appear here automatically.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      {responses.map((resp) => (
                        <article
                          key={resp.responseId}
                          className="rounded-[10px] border border-rule bg-white p-4 transition hover:border-slate/40"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-rule/80 pb-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-[14px] font-semibold text-ink">{resp.applicantName}</h3>
                                {resp.experience ? <Badge tone="ultra">{resp.experience}</Badge> : null}
                                <span className="font-mono text-[9.5px] text-slate">
                                  Submitted {formatRelative(resp.lastSubmittedTime)}
                                </span>
                              </div>
                              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate">
                                {resp.applicantEmail ? (
                                  <span className="flex items-center gap-1">
                                    <Mail className="h-3 w-3" />
                                    {resp.applicantEmail}
                                  </span>
                                ) : null}
                                {resp.applicantPhone ? (
                                  <span className="flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    {resp.applicantPhone}
                                  </span>
                                ) : null}
                                {resp.location ? (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {resp.location}
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5">
                              {resp.applicantEmail ? (
                                <Button variant="outline" size="sm" asChild>
                                  <Link href={`/app/mail?to=${encodeURIComponent(resp.applicantEmail)}&compose=1`}>
                                    <Mail className="h-3 w-3" />
                                    Invite / Email
                                  </Link>
                                </Button>
                              ) : null}
                              <Button variant="ghost" size="sm" asChild>
                                <Link href={`/app/offer?name=${encodeURIComponent(resp.applicantName)}&email=${encodeURIComponent(resp.applicantEmail)}`}>
                                  Draft Offer
                                </Link>
                              </Button>
                            </div>
                          </div>

                          <dl className="mt-3 grid gap-2.5 sm:grid-cols-2">
                            {resp.items
                              .filter((item) => !/^(Full Name|Email Address|Phone \/ WhatsApp Number)$/i.test(item.question))
                              .map((item) => {
                                const longAnswer = item.answer.length > 75;
                                return (
                                  <div
                                    key={item.questionId}
                                    className={cn(
                                      "rounded-[7px] border border-rule/70 bg-chalk/40 px-3 py-2",
                                      longAnswer && "sm:col-span-2",
                                    )}
                                  >
                                    <dt className="text-[10px] font-medium text-slate">{item.question}</dt>
                                    <dd className="mt-1">
                                      <RichText text={item.answer} compact className="text-ink" />
                                    </dd>
                                  </div>
                                );
                              })}
                          </dl>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </Panel>

              <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate">
                <span className="flex items-center gap-1.5">
                  <StatusDot status={connection.connected ? "connected" : "idle"} />
                  {connection.connected ? "Connected to Google Forms API v1" : "Preview mode (connect Google in Connections for live forms)"}
                </span>
                <span className="ml-auto">
                  Tip: Say “Create a hiring kit for Tele Caller” in Vaani to build Folder + Sheet + Form together.
                </span>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {qrOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/35 p-4 backdrop-blur-[2px]">
          <button type="button" className="absolute inset-0" aria-label="Close QR modal" onClick={() => setQrOpen(null)} />
          <div className="relative w-full max-w-[380px] animate-rise rounded-[18px] border border-rule bg-paper p-6 text-center shadow-2xl">
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-3 top-3"
              onClick={() => setQrOpen(null)}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
            <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate">Walk-in & Job Fair QR</p>
            <h3 className="mt-1 font-display text-[20px] font-medium tracking-[-0.03em] text-ink">{qrOpen.name}</h3>
            <div className="mx-auto mt-4 inline-flex rounded-[12px] border border-rule bg-white p-4">
              <QRCodeSVG value={qrOpen.formUrl} size={184} />
            </div>
            <p className="mt-3 break-all font-mono text-[9.5px] text-slate">{qrOpen.formUrl}</p>
            <div className="mt-4 flex justify-center gap-2">
              <Button variant="outline" size="sm" onClick={() => void copyLink(qrOpen)}>
                <Copy className="h-3.5 w-3.5" />
                Copy link
              </Button>
              <Button variant="ink" size="sm" onClick={() => window.print()}>
                Print poster
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
