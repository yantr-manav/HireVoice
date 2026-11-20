"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Check,
  Copy,
  ExternalLink,
  FileSignature,
  FileText,
  Loader2,
  Mail,
  Plug,
  Printer,
  Sparkles,
} from "lucide-react";
import type { Workspace, WorkspaceFile } from "@/lib/types";
import { offerEmail, offerLetterDocument } from "@/lib/agent/templates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { RichText } from "@/components/ui/rich-text";

export function OfferGenerator({
  workspace,
  initialCandidateId,
  initialName,
  initialEmail,
}: {
  workspace: Workspace;
  initialCandidateId?: string;
  initialName?: string;
  initialEmail?: string;
}) {
  const initialCandidate = workspace.candidates.find((c) => c.id === initialCandidateId);

  const [selectedCandidateId, setSelectedCandidateId] = useState(initialCandidate?.id ?? "");
  const [candidateName, setCandidateName] = useState(initialCandidate?.name ?? initialName ?? "");
  const [candidateEmail, setCandidateEmail] = useState(initialCandidate?.email ?? initialEmail ?? "");
  const [roleTitle, setRoleTitle] = useState(initialCandidate?.roleTitle ?? workspace.roles[0]?.title ?? "Customer Support Executive");
  const [compensation, setCompensation] = useState("₹28,000 / month (₹3.36 LPA) + performance incentives");
  const [startDate, setStartDate] = useState(() => {
    const next = new Date(Date.now() + 86_400_000 * 7);
    return next.toISOString().slice(0, 10);
  });
  const [location, setLocation] = useState(initialCandidate?.location ?? "Bengaluru · Hybrid");
  const [shift, setShift] = useState("Day shift · 9:30 AM – 6:30 PM IST (Mon–Sat rotational)");
  const [reportingManager, setReportingManager] = useState("Operations Team Lead");
  const [probationMonths, setProbationMonths] = useState("3 months");
  const [noticePeriod, setNoticePeriod] = useState("30 days");

  const [creatingDoc, setCreatingDoc] = useState(false);
  const [draftingMail, setDraftingMail] = useState(false);
  const [copied, setCopied] = useState(false);
  const [createdDoc, setCreatedDoc] = useState<WorkspaceFile | null>(null);
  const [draftLink, setDraftLink] = useState<string | null>(null);

  const formattedDate = useMemo(() => {
    const parsed = new Date(startDate);
    if (Number.isNaN(parsed.getTime())) return startDate || "TBD";
    return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric" }).format(parsed);
  }, [startDate]);

  const previewText = useMemo(
    () =>
      offerLetterDocument({
        candidateName: candidateName.trim() || "[Candidate Name]",
        candidateEmail: candidateEmail.trim() || undefined,
        roleTitle: roleTitle.trim() || "Open Role",
        compensation: compensation.trim() || "As discussed",
        startDate: formattedDate,
        location: location.trim(),
        shift: shift.trim(),
        reportingManager: reportingManager.trim(),
        probationMonths: probationMonths.trim(),
        noticePeriod: noticePeriod.trim(),
        org: workspace.org.name,
        recruiterName: `${workspace.user.name}, ${workspace.user.role}`,
      }),
    [
      candidateName,
      candidateEmail,
      roleTitle,
      compensation,
      formattedDate,
      location,
      shift,
      reportingManager,
      probationMonths,
      noticePeriod,
      workspace.org.name,
      workspace.user.name,
      workspace.user.role,
    ],
  );

  const pickCandidate = (id: string) => {
    setSelectedCandidateId(id);
    const found = workspace.candidates.find((c) => c.id === id);
    if (found) {
      setCandidateName(found.name);
      setCandidateEmail(found.email);
      setRoleTitle(found.roleTitle);
      setLocation(found.location);
    }
  };

  const createGoogleDoc = async () => {
    if (!candidateName.trim()) {
      toast.error("Enter a candidate name first.");
      return;
    }
    setCreatingDoc(true);
    try {
      const title = `Offer Letter — ${candidateName.trim()} (${roleTitle.trim()})`;
      const res = await fetch("/api/google/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "doc", title, body: previewText }),
      });
      const data = (await res.json()) as { file?: WorkspaceFile; error?: string };
      if (!res.ok || !data.file) throw new Error(data.error ?? "Offer letter Google Doc could not be created.");
      setCreatedDoc(data.file);
      toast.success("Offer letter created in Google Docs", {
        description: data.file.name,
        action: { label: "Open Doc", onClick: () => window.open(data.file!.url, "_blank", "noreferrer") },
      });
    } catch (error) {
      toast.error("Could not create Google Doc", {
        description: error instanceof Error ? error.message : "Connect Google Workspace first.",
      });
    } finally {
      setCreatingDoc(false);
    }
  };

  const saveOfferEmailDraft = async () => {
    if (!candidateEmail.trim()) {
      toast.error("Add the candidate's email address to save a Gmail draft.");
      return;
    }
    setDraftingMail(true);
    try {
      const emailBody = offerEmail({
        candidateName: candidateName.trim() || "Candidate",
        candidateEmail: candidateEmail.trim(),
        roleTitle: roleTitle.trim(),
        compensation: compensation.trim(),
        startDate: formattedDate,
        location: location.trim(),
        shift: shift.trim(),
        org: workspace.org.name,
        recruiterName: workspace.user.name,
      });
      const res = await fetch("/api/mail/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: candidateEmail.trim(),
          subject: `Offer of Employment — ${roleTitle.trim()} at ${workspace.org.name}`,
          body: createdDoc ? `${emailBody}\n\nOffer Letter Document: ${createdDoc.url}` : emailBody,
        }),
      });
      const data = (await res.json()) as { link?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not save Gmail draft.");
      setDraftLink(data.link ?? null);
      toast.success("Offer email saved to Gmail Drafts", {
        description: "Review and send when ready — nothing was sent automatically.",
        action: data.link ? { label: "Open Gmail", onClick: () => window.open(data.link, "_blank", "noreferrer") } : undefined,
      });
    } catch (error) {
      toast.error("Could not save draft", {
        description: error instanceof Error ? error.message : "Connect Gmail first.",
      });
    } finally {
      setDraftingMail(false);
    }
  };

  const copyLetter = async () => {
    try {
      await navigator.clipboard.writeText(previewText);
      setCopied(true);
      toast.success("Formatted offer letter copied");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy text");
    }
  };

  return (
    <div className="mx-auto max-w-[1480px] px-4 py-5 sm:px-6 sm:py-7 xl:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate">
            <FileSignature className="h-3.5 w-3.5" />
            Hiring Packet · Offer Letter Studio
          </p>
          <h1 className="mt-1 font-display text-[32px] font-medium leading-none tracking-[-0.04em] text-ink sm:text-[38px]">
            Offer Letter Generator
          </h1>
          <p className="mt-1.5 max-w-[640px] text-[13px] leading-relaxed text-slate">
            Configure role compensation, shift window, and joining terms with a live formatted preview. Export directly
            to Google Docs and save a Gmail draft for recruiter review.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {workspace.google.connected ? (
            <Badge tone="verified" dot>
              Google Docs + Gmail ready
            </Badge>
          ) : (
            <Link
              href="/app/connections"
              className="inline-flex items-center gap-1.5 rounded-[6px] border border-flag/35 bg-flag-soft px-2.5 py-1.5 text-[10.5px] font-medium text-[#6c5200] hover:border-flag"
            >
              <Plug className="h-3 w-3" />
              Connect Google to export Docs
            </Link>
          )}
          <span className="hidden items-center gap-1.5 rounded-[6px] border border-rule bg-paper px-2.5 py-1.5 text-[10.5px] text-slate md:inline-flex">
            <Sparkles className="h-3 w-3 text-ultramarine" />
            Voice: “Generate offer letter for Sana at ₹30,000/month”
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[440px_minmax(0,1fr)]">
        <Panel className="overflow-hidden">
          <PanelHeader title="Offer details" meta="Auto-fill from candidate or type custom" />
          <div className="space-y-3 p-4">
            <label className="block">
              <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate">Select workspace candidate</span>
              <select
                value={selectedCandidateId}
                onChange={(e) => pickCandidate(e.target.value)}
                className="mt-1 h-9 w-full rounded-[6px] border border-rule bg-white px-2.5 text-[12px] text-ink outline-none focus:border-ink"
              >
                <option value="">Custom candidate…</option>
                {workspace.candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.stage.replace(/_/g, " ")} ({c.score.overall.toFixed(1)}/5)
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate">Candidate full name</span>
                <input
                  value={candidateName}
                  onChange={(e) => setCandidateName(e.target.value)}
                  placeholder="Sana Khan"
                  className="mt-1 h-9 w-full rounded-[6px] border border-rule bg-white px-2.5 text-[12px] text-ink outline-none focus:border-ink"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate">Email address</span>
                <input
                  type="email"
                  value={candidateEmail}
                  onChange={(e) => setCandidateEmail(e.target.value)}
                  placeholder="sana@example.com"
                  className="mt-1 h-9 w-full rounded-[6px] border border-rule bg-white px-2.5 text-[12px] text-ink outline-none focus:border-ink"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate">Role title</span>
              <input
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                placeholder="Tele Caller Executive"
                className="mt-1 h-9 w-full rounded-[6px] border border-rule bg-white px-2.5 text-[12px] text-ink outline-none focus:border-ink"
              />
            </label>

            <label className="block">
              <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate">Compensation / CTC</span>
              <input
                value={compensation}
                onChange={(e) => setCompensation(e.target.value)}
                placeholder="₹28,000 / month + incentives"
                className="mt-1 h-9 w-full rounded-[6px] border border-rule bg-white px-2.5 text-[12px] text-ink outline-none focus:border-ink"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate">Joining date</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1 h-9 w-full rounded-[6px] border border-rule bg-white px-2.5 text-[12px] text-ink outline-none focus:border-ink"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate">Work location</span>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Bengaluru · Hybrid"
                  className="mt-1 h-9 w-full rounded-[6px] border border-rule bg-white px-2.5 text-[12px] text-ink outline-none focus:border-ink"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate">Shift window</span>
              <input
                value={shift}
                onChange={(e) => setShift(e.target.value)}
                className="mt-1 h-9 w-full rounded-[6px] border border-rule bg-white px-2.5 text-[12px] text-ink outline-none focus:border-ink"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate">Reporting to</span>
                <input
                  value={reportingManager}
                  onChange={(e) => setReportingManager(e.target.value)}
                  className="mt-1 h-9 w-full rounded-[6px] border border-rule bg-white px-2.5 text-[11.5px] text-ink outline-none focus:border-ink"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate">Probation</span>
                <input
                  value={probationMonths}
                  onChange={(e) => setProbationMonths(e.target.value)}
                  className="mt-1 h-9 w-full rounded-[6px] border border-rule bg-white px-2.5 text-[11.5px] text-ink outline-none focus:border-ink"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate">Notice period</span>
                <input
                  value={noticePeriod}
                  onChange={(e) => setNoticePeriod(e.target.value)}
                  className="mt-1 h-9 w-full rounded-[6px] border border-rule bg-white px-2.5 text-[11.5px] text-ink outline-none focus:border-ink"
                />
              </label>
            </div>

            <div className="space-y-2 border-t border-rule pt-3">
              <Button
                variant="ink"
                size="md"
                className="w-full"
                disabled={creatingDoc || !workspace.google.connected}
                onClick={() => void createGoogleDoc()}
              >
                {creatingDoc ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                {workspace.google.connected ? "Create Google Doc in Drive" : "Connect Google Workspace to create Doc"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                disabled={draftingMail || !workspace.google.connected || !candidateEmail.trim()}
                onClick={() => void saveOfferEmailDraft()}
              >
                {draftingMail ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                Save Offer Email Draft in Gmail
              </Button>
            </div>

            {createdDoc || draftLink ? (
              <div className="space-y-1.5 rounded-[8px] border border-verified/25 bg-verified-soft/60 p-3">
                {createdDoc ? (
                  <a
                    href={createdDoc.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between text-[11px] font-medium text-[#0a7f51] hover:underline"
                  >
                    <span className="truncate">{createdDoc.name}</span>
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                ) : null}
                {draftLink ? (
                  <a
                    href={draftLink}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between text-[11px] font-medium text-[#0a7f51] hover:underline"
                  >
                    <span>Open Gmail Offer Draft</span>
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
        </Panel>

        <Panel className="overflow-hidden">
          <PanelHeader
            title="Live formatted offer preview"
            meta="Parsed document structure · ready for Google Docs or PDF print"
            action={
              <div className="flex items-center gap-1.5">
                <Button variant="ghost" size="sm" onClick={() => void copyLetter()}>
                  {copied ? <Check className="h-3.5 w-3.5 text-verified" /> : <Copy className="h-3.5 w-3.5" />}
                  Copy
                </Button>
                <Button variant="outline" size="sm" onClick={() => window.print()}>
                  <Printer className="h-3.5 w-3.5" />
                  Print / PDF
                </Button>
              </div>
            }
          />
          <div className="bg-chalk/40 p-4 sm:p-6">
            <div className="mx-auto max-w-[740px] rounded-[12px] border border-rule bg-white p-6 shadow-sm sm:p-8">
              <div className="mb-5 flex items-center justify-between border-b border-rule pb-4">
                <div>
                  <p className="font-display text-[18px] font-semibold tracking-[-0.03em] text-ink">
                    {workspace.org.name}
                  </p>
                  <p className="text-[10.5px] text-slate">Confidential Offer of Employment</p>
                </div>
                <Badge tone="ultra">HireVoice Verified</Badge>
              </div>
              <RichText text={previewText} />
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
