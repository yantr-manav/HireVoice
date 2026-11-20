"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertCircle,
  BellRing,
  Check,
  ChevronRight,
  CreditCard,
  Database,
  KeyRound,
  Loader2,
  Lock,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import type { AiStatus, Workspace } from "@/lib/types";
import { cn, formatRelative } from "@/lib/utils";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/panel";

const sections = [
  { id: "profile", label: "Profile", icon: Users },
  { id: "workspace", label: "Workspace", icon: CreditCard },
  { id: "notifications", label: "Notifications", icon: BellRing },
  { id: "data", label: "Data and retention", icon: Database },
  { id: "api", label: "API and secrets", icon: KeyRound },
] as const;

type Section = (typeof sections)[number]["id"];

export function SettingsConsole({ workspace }: { workspace: Workspace }) {
  const [section, setSection] = useState<Section>("profile");
  const [name, setName] = useState(workspace.user.name);
  const [email, setEmail] = useState(workspace.user.email);
  const [org, setOrg] = useState(workspace.org.name);
  const [notifyReview, setNotifyReview] = useState(true);
  const [notifyDigest, setNotifyDigest] = useState(true);
  const [notifyReject, setNotifyReject] = useState(false);
  const [retention, setRetention] = useState("90");
  const [audio, setAudio] = useState("14");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [ai, setAi] = useState<AiStatus | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const loadAi = useCallback(async () => {
    setAiLoading(true);
    try {
      const response = await fetch("/api/ai/status", { cache: "no-store" });
      const data = (await response.json()) as AiStatus & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Model status unavailable.");
      setAi(data);
    } catch (error) {
      toast.error("Model status unavailable", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setAiLoading(false);
    }
  }, []);

  useEffect(() => {
    if (section === "api" && !ai && !aiLoading) void loadAi();
  }, [section, ai, aiLoading, loadAi]);

  return (
    <div className="mx-auto max-w-[1480px] px-4 py-5 sm:px-6 sm:py-7 xl:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium text-slate">{workspace.org.region} · pilot workspace</p>
          <h1 className="mt-1 font-display text-[32px] font-medium leading-none tracking-[-0.04em] text-ink sm:text-[38px]">
            Settings
          </h1>
          <p className="mt-1.5 text-[13px] text-slate">
            Account, workspace, data and the keys that let agents reach Google.
          </p>
        </div>
        <Badge tone={workspace.isDemo ? "flag" : "verified"} dot>
          {workspace.isDemo ? "Demo · changes are local" : "Live workspace"}
        </Badge>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[208px_minmax(0,1fr)]">
        <nav className="h-fit rounded-[8px] border border-rule bg-paper p-1.5" aria-label="Settings sections">
          {sections.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSection(item.id)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-[5px] px-2.5 py-2 text-left text-[11.5px] transition",
                section === item.id ? "bg-chalk font-medium text-ink" : "text-slate hover:bg-chalk/60 hover:text-ink",
              )}
            >
              <item.icon className="h-3.5 w-3.5" strokeWidth={1.7} />
              {item.label}
              <ChevronRight className={cn("ml-auto h-3 w-3", section === item.id ? "text-ink" : "text-transparent")} />
            </button>
          ))}
        </nav>

        <div className="space-y-4">
          {section === "profile" ? (
            <>
              <Panel className="p-5">
                <h2 className="text-[13px] font-semibold text-ink">Your profile</h2>
                <p className="mt-0.5 text-[10.5px] text-slate">
                  Your name appears on decisions and approvals in the audit trail.
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-[10px] font-medium text-slate">Full name</span>
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className="mt-1 h-9 w-full rounded-[6px] border border-rule bg-white px-2.5 text-[11.5px] text-ink outline-none focus:border-ink"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-medium text-slate">Work email</span>
                    <input
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="mt-1 h-9 w-full rounded-[6px] border border-rule bg-white px-2.5 text-[11.5px] text-ink outline-none focus:border-ink"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-medium text-slate">Role</span>
                    <input
                      defaultValue={workspace.user.role}
                      className="mt-1 h-9 w-full rounded-[6px] border border-rule bg-white px-2.5 text-[11.5px] text-ink outline-none focus:border-ink"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-medium text-slate">Time zone</span>
                    <select className="mt-1 h-9 w-full rounded-[6px] border border-rule bg-white px-2.5 text-[11.5px] text-ink outline-none focus:border-ink">
                      <option>Asia/Kolkata (IST)</option>
                      <option>Asia/Dubai</option>
                      <option>Asia/Singapore</option>
                    </select>
                  </label>
                </div>
                <div className="mt-4 flex justify-end">
                  <Button variant="ink" size="sm" onClick={() => toast.success("Profile saved in this demo.")}>
                    Save profile
                  </Button>
                </div>
              </Panel>
              <Panel className="overflow-hidden">
                <PanelHeader title="Sessions" meta="Signed-in devices" />
                <div className="divide-y divide-rule">
                  {[
                    { device: "Chrome on Windows", where: "Hyderabad, IN", when: "This session" },
                    { device: "Safari on iPhone", where: "Hyderabad, IN", when: "2 days ago" },
                  ].map((session) => (
                    <div key={session.device} className="flex items-center gap-3 px-4 py-2.5">
                      <Lock className="h-3.5 w-3.5 text-slate" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] text-ink">{session.device}</p>
                        <p className="text-[9.5px] text-slate">
                          {session.where} · {session.when}
                        </p>
                      </div>
                      {session.when === "This session" ? (
                        <Badge tone="verified" dot>Current</Badge>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => toast("Session revoked in this demo.")}>
                          Revoke
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </Panel>
            </>
          ) : null}

          {section === "workspace" ? (
            <>
              <Panel className="p-5">
                <h2 className="text-[13px] font-semibold text-ink">Workspace</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-[10px] font-medium text-slate">Organisation name</span>
                    <input
                      value={org}
                      onChange={(event) => setOrg(event.target.value)}
                      className="mt-1 h-9 w-full rounded-[6px] border border-rule bg-white px-2.5 text-[11.5px] text-ink outline-none focus:border-ink"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-medium text-slate">Region</span>
                    <input
                      value="asia-south1 · Mumbai"
                      readOnly
                      className="mt-1 h-9 w-full rounded-[6px] border border-rule bg-chalk/60 px-2.5 text-[11.5px] text-slate outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-medium text-slate">Default interview language</span>
                    <select className="mt-1 h-9 w-full rounded-[6px] border border-rule bg-white px-2.5 text-[11.5px] text-ink outline-none focus:border-ink">
                      <option>Hindi + English</option>
                      <option>English</option>
                      <option>Hinglish</option>
                      <option>Marathi</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-medium text-slate">Candidate identifier shown</span>
                    <select className="mt-1 h-9 w-full rounded-[6px] border border-rule bg-white px-2.5 text-[11.5px] text-ink outline-none focus:border-ink">
                      <option>Alias until shortlisted</option>
                      <option>Name always</option>
                    </select>
                  </label>
                </div>
                <div className="mt-4 flex justify-end">
                  <Button variant="ink" size="sm" onClick={() => toast.success("Workspace saved in this demo.")}>
                    Save workspace
                  </Button>
                </div>
              </Panel>
              <Panel className="overflow-hidden">
                <PanelHeader title="Seats" meta={`${workspace.org.seats} seats · pilot`} />
                <div className="divide-y divide-rule">
                  {[
                    { name: workspace.user.name, email: workspace.user.email, role: "Owner", initials: workspace.user.initials },
                    { name: "Imran Qureshi", email: "imran@northstar.example", role: "Recruiter", initials: "IQ" },
                    { name: "Divya Menon", email: "divya@northstar.example", role: "Reviewer", initials: "DM" },
                  ].map((member) => (
                    <div key={member.email} className="flex items-center gap-2.5 px-4 py-2.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full border border-rule bg-white font-mono text-[9px] text-slate">
                        {member.initials}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] text-ink">{member.name}</p>
                        <p className="text-[9.5px] text-slate">{member.email}</p>
                      </div>
                      <Badge tone={member.role === "Owner" ? "ultra" : "neutral"}>{member.role}</Badge>
                    </div>
                  ))}
                </div>
                <div className="border-t border-rule px-4 py-2.5">
                  <Button variant="outline" size="sm" onClick={() => toast("Invite flow opens in the live workspace.")}>
                    Invite a teammate
                  </Button>
                </div>
              </Panel>
            </>
          ) : null}

          {section === "notifications" ? (
            <Panel className="overflow-hidden">
              <PanelHeader title="Notifications" meta="Only what needs a human" />
              <div className="divide-y divide-rule">
                {[
                  {
                    label: "A candidate needs review",
                    body: "Sent when evidence is uncertain or a quote fails verification.",
                    checked: notifyReview,
                    set: setNotifyReview,
                  },
                  {
                    label: "Daily 6 PM summary",
                    body: "Completed interviews, decisions waiting, and any blocked connections.",
                    checked: notifyDigest,
                    set: setNotifyDigest,
                  },
                  {
                    label: "Decision recorded by a teammate",
                    body: "Useful when more than one recruiter works a role.",
                    checked: notifyReject,
                    set: setNotifyReject,
                  },
                ].map((item) => (
                  <label key={item.label} className="flex cursor-pointer items-start gap-3 px-4 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11.5px] font-medium text-ink">{item.label}</span>
                      <span className="mt-0.5 block text-[10px] leading-relaxed text-slate">{item.body}</span>
                    </span>
                    <span className="relative mt-0.5 inline-flex h-4 w-7 shrink-0 items-center">
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={(event) => item.set(event.target.checked)}
                        className="peer sr-only"
                      />
                      <span className="h-4 w-7 rounded-full border border-rule bg-white transition peer-checked:border-ultramarine peer-checked:bg-ultramarine" />
                      <span className="absolute left-0.5 h-3 w-3 rounded-full bg-slate transition peer-checked:translate-x-3 peer-checked:bg-white" />
                    </span>
                  </label>
                ))}
              </div>
              <div className="flex justify-end border-t border-rule bg-chalk/40 px-4 py-2.5">
                <Button variant="ink" size="sm" onClick={() => toast.success("Notification preferences saved.")}>
                  Save preferences
                </Button>
              </div>
            </Panel>
          ) : null}

          {section === "data" ? (
            <>
              <Panel className="p-5">
                <h2 className="text-[13px] font-semibold text-ink">Retention</h2>
                <p className="mt-0.5 text-[10.5px] leading-relaxed text-slate">
                  Audio is deleted first. Transcripts keep the evidence available for review, then are
                  deleted on the same clock.
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-[10px] font-medium text-slate">Transcript retention</span>
                    <select
                      value={retention}
                      onChange={(event) => setRetention(event.target.value)}
                      className="mt-1 h-9 w-full rounded-[6px] border border-rule bg-white px-2.5 text-[11.5px] text-ink outline-none focus:border-ink"
                    >
                      <option value="30">30 days</option>
                      <option value="90">90 days</option>
                      <option value="180">180 days</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-medium text-slate">Audio retention</span>
                    <select
                      value={audio}
                      onChange={(event) => setAudio(event.target.value)}
                      className="mt-1 h-9 w-full rounded-[6px] border border-rule bg-white px-2.5 text-[11.5px] text-ink outline-none focus:border-ink"
                    >
                      <option value="0">Delete immediately</option>
                      <option value="14">14 days</option>
                      <option value="30">30 days</option>
                    </select>
                  </label>
                </div>
                <div className="mt-4 flex items-center gap-2 rounded-[6px] border border-verified/25 bg-verified-soft/60 px-3 py-2">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-verified" />
                  <p className="text-[10px] leading-relaxed text-[#0a7f51]">
                    Audio is only stored when the candidate gives separate recording consent. Withholding
                    consent never blocks the interview.
                  </p>
                </div>
                <div className="mt-4 flex justify-end">
                  <Button variant="ink" size="sm" onClick={() => toast.success("Retention updated in this demo.")}>
                    Save retention
                  </Button>
                </div>
              </Panel>
              <Panel className="overflow-hidden">
                <PanelHeader title="Candidate data controls" meta="Export or erase" />
                <div className="divide-y divide-rule">
                  <div className="flex flex-wrap items-center gap-2 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium text-ink">Export a candidate record</p>
                      <p className="mt-0.5 text-[10px] text-slate">Transcript, score, evidence and audit events as JSON.</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => toast("Export queued in this demo.")}>
                      Request export
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium text-ink">Erase a candidate record</p>
                      <p className="mt-0.5 text-[10px] text-slate">Audio, transcript and derived scores are removed. The audit event remains.</p>
                    </div>
                    <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
                      <Trash2 className="h-3.5 w-3.5" />
                      Erase
                    </Button>
                  </div>
                </div>
              </Panel>
            </>
          ) : null}

          {section === "api" ? (
            <>
              <Panel className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-[13px] font-semibold text-ink">Model routing and keys</h2>
                    <p className="mt-0.5 max-w-[520px] text-[10.5px] leading-relaxed text-slate">
                      Keys are read on the server only. One key per model family is enough; add more to
                      spread free-tier quota. A cooled key is skipped, never retried in a loop.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => void loadAi()} disabled={aiLoading}>
                    {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    Refresh
                  </Button>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge tone={ai?.configured ? "verified" : "neutral"} dot>
                    {ai ? (ai.configured ? "Models available" : "No model keys") : "Not checked"}
                  </Badge>
                  <Badge tone={ai?.liveReady ? "ultra" : "neutral"}>
                    {ai?.liveReady ? "Live token ready" : "Live token gated"}
                  </Badge>
                  {ai?.lastCall ? (
                    <span className="text-[9.5px] text-slate">
                      last call {ai.lastCall.model} · {ai.lastCall.status} · {formatRelative(ai.lastCall.at)}
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 divide-y divide-rule rounded-[6px] border border-rule bg-white">
                  {[
                    {
                      name: "GEMINI_API_KEY / GEMINI_API_KEYS",
                      ok: Boolean(ai?.configured),
                      detail: ai?.configured ? "loaded on the server" : "not set",
                    },
                    {
                      name: "GOOGLE_CLIENT_ID + SECRET",
                      ok: workspace.google.configured,
                      detail: workspace.google.configured ? "OAuth client present" : "not set",
                    },
                    {
                      name: "Google account tokens",
                      ok: workspace.google.connected,
                      detail: workspace.google.connected
                        ? workspace.google.email ?? "connected"
                        : "connect from Connections",
                    },
                    {
                      name: "SUPABASE_URL + ANON_KEY",
                      ok: !workspace.isDemo,
                      detail: workspace.isDemo ? "demo cookie mode" : "signed-in via Supabase",
                    },
                  ].map((row) => (
                    <div key={row.name} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                      <span className="font-mono text-[9.5px] text-ink">{row.name}</span>
                      <span
                        className={cn(
                          "ml-auto flex items-center gap-1 text-[9px]",
                          row.ok ? "text-verified" : "text-slate",
                        )}
                      >
                        {row.ok ? <Check className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                        {row.detail}
                      </span>
                    </div>
                  ))}
                </div>

                {ai?.models?.length ? (
                  <div className="mt-3">
                    <p className="text-[9.5px] font-medium uppercase tracking-[0.08em] text-slate">Routing order</p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {ai.models.map((model) => (
                        <span
                          key={model.id}
                          className="rounded-[3px] border border-rule bg-white px-1.5 py-0.5 text-[9px] text-slate"
                          title={`${model.id} · ${model.role}`}
                        >
                          <span className="font-medium text-ink">{model.label}</span>
                          <span className="ml-1 font-mono text-[8px] uppercase">{model.family}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {ai?.keys?.length ? (
                  <div className="mt-3">
                    <p className="text-[9.5px] font-medium uppercase tracking-[0.08em] text-slate">Keys in rotation</p>
                    <div className="mt-1.5 grid gap-1 sm:grid-cols-2">
                      {ai.keys.map((key) => (
                        <div key={key.ref} className="flex items-center gap-2 rounded-[4px] border border-rule bg-white px-2 py-1.5">
                          <StatusDot status={key.cooling ? "error" : "connected"} />
                          <span className="min-w-0 flex-1 truncate font-mono text-[9px] text-ink">{key.label}</span>
                          <span className="text-[8.5px] text-slate">
                            {key.calls} calls{key.failures > 0 ? ` · ${key.failures} fail` : ""}
                            {key.cooling ? " · cooling" : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 rounded-[6px] border border-rule bg-chalk/50 px-3 py-2 text-[9.5px] leading-relaxed text-slate">
                    No model keys found. Command planning uses the local parser and email drafts use the
                    built-in templates. Add <span className="font-mono">GEMINI_API_KEYS</span> or{" "}
                    <span className="font-mono">GEMMA_API_KEYS</span> to the server environment, then restart.
                  </p>
                )}

                <div className="mt-3 flex items-center gap-2 rounded-[6px] border border-rule bg-chalk/50 px-3 py-2 text-[9.5px] text-slate">
                  <Lock className="h-3 w-3 shrink-0" />
                  Keys never reach the browser. Rotate them in Secret Manager and restart the revision.
                </div>
              </Panel>
              <Panel className="overflow-hidden">
                <PanelHeader title="Webhooks" meta="Pilot" />
                <div className="px-4 py-3">
                  <p className="text-[10.5px] text-slate">
                    Send a signed event when an interview is scored and when a human decision is recorded.
                    No candidate audio is included.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {["interview.scored", "decision.recorded", "approval.decided", "connection.error"].map((event) => (
                      <span key={event} className="rounded-[3px] border border-rule bg-white px-1.5 py-0.5 font-mono text-[8.5px] text-slate">
                        {event}
                      </span>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => toast("Webhook endpoint created in this demo.")}>
                    Add endpoint
                  </Button>
                </div>
              </Panel>
            </>
          ) : null}

          <div className="flex items-center justify-between rounded-[8px] border border-onair/20 bg-onair-soft/40 px-4 py-3">
            <div>
              <p className="text-[10.5px] font-medium text-ink">Danger zone</p>
              <p className="mt-0.5 text-[9.5px] text-slate">
                Deleting the workspace removes interviews, evidence and audit history.
              </p>
            </div>
            <Button variant="danger" size="sm" onClick={() => toast.error("Workspace deletion is disabled in the demo.")}>
              Delete workspace
            </Button>
          </div>
        </div>
      </div>

      {deleteOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4 backdrop-blur-[2px]">
          <button type="button" className="absolute inset-0" aria-label="Close" onClick={() => setDeleteOpen(false)} />
          <div className="relative w-full max-w-[440px] animate-rise overflow-hidden rounded-[20px] border border-rule bg-paper shadow-2xl">
            <div className="border-b border-rule px-5 py-4">
              <h2 className="font-display text-[22px] font-medium tracking-[-0.03em] text-ink">Erase one candidate?</h2>
              <p className="mt-1 text-[10.5px] leading-relaxed text-slate">
                This removes audio, transcript and derived scores. In the live workspace the request is
                queued, confirmed by a second person, then logged.
              </p>
            </div>
            <div className="flex justify-end gap-2 bg-chalk/40 px-5 py-3">
              <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(false)}>Cancel</Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  setDeleteOpen(false);
                  toast("Erase request recorded in this demo. Nothing was deleted.");
                }}
              >
                Record erase request
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
