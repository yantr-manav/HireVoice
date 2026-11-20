"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowUpRight,
  Check,
  FileAudio,
  Loader2,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/panel";
import type { Candidate, Language, Role } from "@/lib/types";

const SAMPLE_CALL_TRANSCRIPT = `Recruiter: Hi Priya, thanks for taking this quick screening call for Customer Support Executive. Can you tell me how you would handle an upset customer whose refund of ₹1,800 is delayed?
Candidate: Yes, thank you for calling. First I would say I am really sorry for the delay and I understand how frustrating it is to wait for your own money. Then I would ask for the order number, check the payment gateway status right away, and give them a clear ticket ID with a 24-hour callback commitment.
Recruiter: And what if the issue is stuck with the bank and you don't know the exact credit date?
Candidate: I would not guess or make a false promise. I would escalate it to our payments team with the UTR reference and update the customer by SMS and call by 5 PM tomorrow.`;

export function UploadCallConsole({ roles }: { roles: Role[] }) {
  const [file, setFile] = useState<File | null>(null);
  const [candidateName, setCandidateName] = useState("");
  const [phone, setPhone] = useState("");
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "role-support");
  const [language, setLanguage] = useState<Language>("hinglish");
  const [transcript, setTranscript] = useState("");
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [swapSpeakers, setSwapSpeakers] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    candidate: Candidate;
    transcribeModel: string;
    audioQuality: string;
    verifiedCount: number;
    totalQuotes: number;
    latencyMs: number;
    reviewUrl: string;
  } | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!consentConfirmed) {
      toast.error("Please confirm recording consent before uploading.");
      return;
    }
    if (!file && !transcript.trim()) {
      toast.error("Attach an audio file or paste a call transcript.");
      return;
    }

    setBusy(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append("consentConfirmed", "true");
      form.append("candidateName", candidateName.trim() || "Priya Sharma (Call)");
      form.append("phone", phone.trim());
      form.append("roleId", roleId);
      form.append("language", language);
      form.append("swapSpeakers", String(swapSpeakers));
      if (file) form.append("audio", file);
      if (transcript.trim()) form.append("transcript", transcript.trim());

      const res = await fetch("/api/interviews/upload-call", { method: "POST", body: form });
      const data = (await res.json()) as typeof result & { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        toast.error(data.error ?? "Failed to process screening call.");
        return;
      }
      setResult(data);
      toast.success("Screening call transcribed, scored & verified.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1160px] px-4 py-6 sm:px-6 xl:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Badge tone="ultra" dot>P1 · Zero-Friction Adoption</Badge>
          <h1 className="mt-2 font-display text-[30px] font-medium leading-[1.05] tracking-[-0.04em] text-ink sm:text-[34px]">
            Upload Existing Screening Call
          </h1>
          <p className="mt-1 max-w-[680px] text-[13px] text-slate">
            Already screening candidates over regular phone calls? Upload a consented recording (MP3, WAV, M4A, WebM) — Gemini diarizes speakers, applies the same role rubric, and runs deterministic quote verification.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Panel className="p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[11px] font-medium text-ink">Candidate name</label>
                <input
                  type="text"
                  value={candidateName}
                  onChange={(e) => setCandidateName(e.target.value)}
                  placeholder="e.g. Priya Sharma"
                  className="mt-1 w-full rounded-[7px] border border-rule bg-white px-3 py-2 text-[12.5px] text-ink outline-none focus:border-ink"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-ink">Phone (optional)</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98201 11223"
                  className="mt-1 w-full rounded-[7px] border border-rule bg-white px-3 py-2 text-[12.5px] text-ink outline-none focus:border-ink"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-ink">Target role</label>
                <select
                  value={roleId}
                  onChange={(e) => setRoleId(e.target.value)}
                  className="mt-1 w-full rounded-[7px] border border-rule bg-white px-3 py-2 text-[12.5px] text-ink outline-none focus:border-ink"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-ink">Primary language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as Language)}
                  className="mt-1 w-full rounded-[7px] border border-rule bg-white px-3 py-2 text-[12.5px] text-ink outline-none focus:border-ink"
                >
                  <option value="hinglish">Hinglish</option>
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-medium text-ink">Call recording (MP3 / WAV / M4A / WebM · max 18 MB)</label>
              <label className="mt-1.5 flex cursor-pointer flex-col items-center justify-center rounded-[10px] border border-dashed border-slate/40 bg-chalk/50 px-4 py-6 text-center transition hover:border-ink hover:bg-chalk">
                <UploadCloud className="h-6 w-6 text-ultramarine" />
                <p className="mt-2 text-[12.5px] font-medium text-ink">
                  {file ? file.name : "Drop a mobile call recording or click to choose"}
                </p>
                <p className="mt-0.5 text-[10.5px] text-slate">
                  {file
                    ? `${(file.size / 1024).toFixed(0)} KB · ${file.type || "audio"}`
                    : "Gemini transcribes with speaker diarization (Recruiter vs Candidate)"}
                </p>
                <input
                  type="file"
                  accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg"
                  className="sr-only"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium text-ink">
                  Or paste a diarized call transcript <span className="font-normal text-slate">(instant test)</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setCandidateName("Priya Sharma (Phone Call)");
                    setTranscript(SAMPLE_CALL_TRANSCRIPT);
                    setConsentConfirmed(true);
                  }}
                  className="text-[10.5px] font-medium text-ultramarine hover:underline"
                >
                  Load sample BPO call
                </button>
              </div>
              <textarea
                rows={5}
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Recruiter: ...&#10;Candidate: ..."
                className="mt-1.5 w-full rounded-[7px] border border-rule bg-white px-3 py-2 font-mono text-[11px] text-ink outline-none focus:border-ink"
              />
            </div>

            <div className="space-y-2 rounded-[8px] border border-rule bg-chalk/45 p-3">
              <label className="flex cursor-pointer items-start gap-2.5 text-[11.5px] text-ink">
                <input
                  type="checkbox"
                  checked={consentConfirmed}
                  onChange={(e) => setConsentConfirmed(e.target.checked)}
                  className="mt-0.5 accent-ultramarine"
                />
                <span>
                  <strong>Consent gate (required):</strong> I confirm both the recruiter and the candidate were informed and consented to AI transcription and rubric review.
                </span>
              </label>
              <label className="flex cursor-pointer items-center gap-2.5 text-[11px] text-slate">
                <input
                  type="checkbox"
                  checked={swapSpeakers}
                  onChange={(e) => setSwapSpeakers(e.target.checked)}
                  className="accent-ultramarine"
                />
                Swap speaker labels (if candidate spoke first on the recording)
              </label>
            </div>

            <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Transcribing, scoring & verifying quotes…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Run Gemini Rubric & Quote Verification
                </>
              )}
            </Button>
          </form>
        </Panel>

        <div className="space-y-4">
          <Panel className="p-4">
            <PanelHeader
              title="Privacy & Truth Policy"
              meta="How uploaded calls are handled"
            />
            <ul className="mt-3 space-y-2 text-[11.5px] text-slate">
              <li className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-verified" />
                PII (phone, email, name) is redacted before the transcript reaches the rubric scorer.
              </li>
              <li className="flex items-start gap-2">
                <FileAudio className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ultramarine" />
                Interviewer turns are strictly blocked from being cited as candidate evidence.
              </li>
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-verified" />
                Unverified quotes are visibly flagged and excluded from evidence quality.
              </li>
            </ul>
          </Panel>

          {result ? (
            <Panel className="border-verified/35 bg-verified-soft/35 p-4">
              <Badge tone="verified" dot>Real result saved</Badge>
              <h3 className="mt-2 font-display text-[20px] font-medium text-ink">
                {result.candidate.name}
              </h3>
              <p className="mt-1 text-[11.5px] text-slate">{result.candidate.score.summary}</p>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-[6px] border border-rule bg-white px-2.5 py-2">
                  <dt className="text-[9.5px] text-slate">Overall score</dt>
                  <dd className="font-mono text-[14px] font-semibold text-ink">
                    {result.candidate.score.overall.toFixed(1)}/5
                  </dd>
                </div>
                <div className="rounded-[6px] border border-rule bg-white px-2.5 py-2">
                  <dt className="text-[9.5px] text-slate">Verified quotes</dt>
                  <dd className="font-mono text-[14px] font-semibold text-[#0a7f51]">
                    {result.verifiedCount}/{result.totalQuotes}
                  </dd>
                </div>
                <div className="rounded-[6px] border border-rule bg-white px-2.5 py-2">
                  <dt className="text-[9.5px] text-slate">Scoring latency</dt>
                  <dd className="font-mono text-[12px] text-ink">
                    {(result.latencyMs / 1000).toFixed(1)}s
                  </dd>
                </div>
                <div className="rounded-[6px] border border-rule bg-white px-2.5 py-2">
                  <dt className="text-[9.5px] text-slate">Model</dt>
                  <dd className="truncate font-mono text-[11px] text-ink">
                    {result.candidate.score.model}
                  </dd>
                </div>
              </dl>
              <Button variant="ink" size="md" className="mt-4 w-full" asChild>
                <Link href={result.reviewUrl}>
                  Open Evidence Timeline <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </Panel>
          ) : null}
        </div>
      </div>
    </div>
  );
}
