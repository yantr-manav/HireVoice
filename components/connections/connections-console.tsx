"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowUpRight,
  CalendarDays,
  Check,
  Cloud,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  KeyRound,
  Loader2,
  MessageSquare,
  Plug,
  RefreshCcw,
  ShieldCheck,
  SquarePen,
  Table2,
  Ticket,
  X,
} from "lucide-react";
import type { Connection, GoogleConnection, Workspace } from "@/lib/types";
import { cn, formatRelative } from "@/lib/utils";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { WorkspaceActions } from "@/components/connections/workspace-actions";

type ConnectionService = Connection["service"];

const googleServices = new Set<ConnectionService>(["gmail", "calendar", "drive", "sheets", "docs", "forms"]);

function isGoogle(service: ConnectionService) {
  return googleServices.has(service);
}

function iconFor(service: ConnectionService) {
  if (service === "gmail") return SquarePen;
  if (service === "calendar") return CalendarDays;
  if (service === "drive") return Cloud;
  if (service === "sheets") return Table2;
  if (service === "forms") return FileSpreadsheet;
  if (service === "docs") return FileText;
  if (service === "slack") return MessageSquare;
  return Ticket;
}

function statusMeta(status: Connection["status"]) {
  if (status === "connected") return { label: "Connected", tone: "verified" as const };
  if (status === "error") return { label: "Needs attention", tone: "onair" as const };
  if (status === "planned") return { label: "Planned", tone: "neutral" as const };
  return { label: "Not connected", tone: "neutral" as const };
}

export function ConnectionsConsole({
  workspace,
  googleResult,
  googleReason,
}: {
  workspace: Workspace;
  googleResult?: string;
  googleReason?: string;
}) {
  const [connections, setConnections] = useState(workspace.connections);
  const [google, setGoogle] = useState<GoogleConnection>(workspace.google);
  const [busy, setBusy] = useState<string | null>(null);
  const [detail, setDetail] = useState<Connection | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);

  useEffect(() => {
    if (googleResult === "error") {
      toast.error("Google connection did not complete", {
        description: googleReason ?? "Check the OAuth client settings and try again.",
      });
    } else if (googleResult === "connected" || google.connected) {
      if (googleResult === "connected") {
        toast.success("Google Workspace connected", {
          description: google.email ? `Mail and Calendar are live as ${google.email}.` : undefined,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = connections.filter((connection) => connection.status === "connected");
  const errors = connections.filter((connection) => connection.status === "error");

  const beginGoogle = () => {
    if (!google.configured) {
      setSetupOpen(true);
      return;
    }
    window.location.href = `/api/google/connect?next=${encodeURIComponent("/app/connections")}`;
  };

  const connect = (connection: Connection) => {
    if (isGoogle(connection.service)) {
      beginGoogle();
      return;
    }
    toast("Not available in the pilot", {
      description: `${connection.name} is on the roadmap. Nothing was connected.`,
    });
  };

  const reconnect = (connection: Connection) => {
    if (isGoogle(connection.service)) {
      beginGoogle();
      return;
    }
    connect(connection);
  };

  const disconnect = async (connection?: Connection) => {
    if (connection && !isGoogle(connection.service)) {
      setDetail(null);
      return;
    }
    setBusy("google");
    try {
      const response = await fetch("/api/google/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await response.json()) as { google?: GoogleConnection; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Google could not be disconnected.");
      const next = data.google ?? { ...google, connected: false, email: null, scopes: [], connectedAt: null };
      setGoogle(next);
      setConnections((current) =>
        current.map((item) =>
          isGoogle(item.service)
            ? { ...item, status: "not_connected", account: undefined, lastChecked: undefined }
            : item,
        ),
      );
      setDetail(null);
      toast("Google Workspace disconnected", {
        description: "Tokens were deleted. Agents that need Google will show as blocked; nothing retries.",
      });
    } catch (error) {
      toast.error("Could not disconnect", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-[1480px] px-4 py-5 sm:px-6 sm:py-7 xl:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium text-slate">
            {active.length} connected · {errors.length} need attention
          </p>
          <h1 className="mt-1 font-display text-[32px] font-medium leading-none tracking-[-0.04em] text-ink sm:text-[38px]">
            Connections
          </h1>
          <p className="mt-1.5 max-w-[600px] text-[13px] leading-relaxed text-slate">
            Google Workspace powers the desk. Every connection is scoped, and every write still goes
            through the same approval gate.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-[6px] border border-verified/25 bg-verified-soft px-2.5 py-1.5 text-[10.5px] text-[#0a7f51]">
          <ShieldCheck className="h-3.5 w-3.5" />
          Least-privilege scopes
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 rounded-[10px] border border-rule bg-paper px-4 py-3">
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-[7px] border",
            google.connected ? "border-verified/20 bg-verified-soft text-verified" : "border-rule bg-chalk/60 text-slate",
          )}
        >
          <KeyRound className="h-4 w-4" strokeWidth={1.7} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-medium text-ink">
            Google Workspace
            {google.connected ? <span className="ml-1.5 font-normal text-slate">· {google.email}</span> : null}
          </p>
          <p className="mt-0.5 text-[10px] leading-relaxed text-slate">
            {google.connected
              ? `One OAuth grant covers Gmail, Calendar, Meet, Drive, Docs, Sheets and Forms. ${google.scopes.length} scopes · connected ${google.connectedAt ? formatRelative(google.connectedAt) : "recently"}.`
              : google.configured
                ? "Not connected. Mail and Calendar show sample data until you grant access."
                : "OAuth client not configured in this environment. Sample data stays on; nothing external is called."}
          </p>
        </div>
        {google.connected ? (
          <div className="flex items-center gap-2">
            <Link href="/app/mail">
              <Button variant="outline" size="sm">Open mail</Button>
            </Link>
            <Button variant="danger" size="sm" onClick={() => void disconnect()} disabled={busy === "google"}>
              {busy === "google" ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
              Disconnect
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSetupOpen(true)}>
              Setup
            </Button>
            <Button variant="ink" size="sm" onClick={beginGoogle}>
              {busy === "google" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plug className="h-3 w-3" />}
              {google.configured ? "Connect Google" : "Configuration"}
            </Button>
          </div>
        )}
      </div>

      {errors.length > 0 ? (
        <div className="mt-5 flex flex-wrap items-center gap-2.5 rounded-[8px] border border-onair/25 bg-onair-soft/70 px-3.5 py-3">
          <AlertCircle className="h-4 w-4 shrink-0 text-onair" />
          <div className="min-w-0 flex-1">
            <p className="text-[11.5px] font-medium text-ink">
              {errors[0].name} needs permission again.
            </p>
            <p className="mt-0.5 text-[10px] text-slate">
              The grant expired or a scope was revoked. Reconnect to restore it; the last action failed once
              and did not retry.
            </p>
          </div>
          <Button variant="ink" size="sm" onClick={() => errors[0] && reconnect(errors[0])}>
            <RefreshCcw className="h-3.5 w-3.5" />
            Reconnect
          </Button>
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {connections.map((connection) => {
          const Icon = iconFor(connection.service);
          const meta = statusMeta(connection.status);
          const isBusy = busy === connection.id;
          return (
            <div
              key={connection.id}
              className={cn(
                "flex flex-col rounded-[10px] border bg-paper p-4 transition",
                connection.status === "error" ? "border-onair/25" : "border-rule hover:border-slate/40",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-[7px] border",
                      connection.status === "connected"
                        ? "border-verified/20 bg-verified-soft"
                        : connection.status === "error"
                          ? "border-onair/20 bg-onair-soft"
                          : "border-rule bg-chalk/60",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4",
                        connection.status === "connected"
                          ? "text-verified"
                          : connection.status === "error"
                            ? "text-onair"
                            : "text-slate",
                      )}
                      strokeWidth={1.7}
                    />
                  </span>
                  <div>
                    <p className="text-[12.5px] font-medium text-ink">{connection.name}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[9.5px] text-slate">
                      <StatusDot status={connection.status === "not_connected" ? "idle" : connection.status} />
                      {meta.label}
                    </p>
                  </div>
                </div>
                <Badge tone={meta.tone}>{connection.status === "planned" ? "roadmap" : connection.status === "error" ? "error" : meta.label}</Badge>
              </div>

              <p className="mt-3 text-[10.5px] leading-relaxed text-slate">{connection.description}</p>

              <div className="mt-3 flex flex-wrap gap-1">
                {connection.scopes.length > 0 ? (
                  connection.scopes.map((scope) => (
                    <span key={scope} className="rounded-[3px] border border-rule bg-white px-1.5 py-0.5 font-mono text-[8.5px] text-slate">
                      {scope}
                    </span>
                  ))
                ) : (
                  <span className="text-[9px] text-slate/70">No scopes requested yet</span>
                )}
              </div>

              <div className="mt-auto flex items-center justify-between gap-2 border-t border-rule/80 pt-3">
                <span className="truncate text-[9px] text-slate">
                  {connection.account ?? (connection.status === "planned" ? "Not available in the pilot" : "No account connected")}
                </span>
                {connection.status === "connected" ? (
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setDetail(connection)}>
                      Manage
                    </Button>
                    <span className="flex items-center gap-1 text-[9px] text-slate">
                      <Check className="h-3 w-3 text-verified" />
                      {connection.lastChecked ? formatRelative(connection.lastChecked) : "verified"}
                    </span>
                  </div>
                ) : connection.status === "planned" ? (
                  <span className="text-[9px] font-medium text-slate">Pilot 2</span>
                ) : connection.status === "error" ? (
                  <Button variant="outline" size="sm" onClick={() => reconnect(connection)} disabled={isBusy}>
                    {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCcw className="h-3 w-3" />}
                    Reconnect
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => connect(connection)} disabled={isBusy}>
                    {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plug className="h-3 w-3" />}
                    Connect
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Panel className="overflow-hidden">
          <PanelHeader title="What each scope is for" meta="Plain-language permission list" />
          <div className="divide-y divide-rule">
            {[
              {
                scope: "gmail.modify",
                title: "Read, label and draft mail",
                body: "Covers inbox read, search, labels, archive and Gmail drafts. Send is a separate, approved action.",
              },
              {
                scope: "calendar",
                title: "See free/busy and create events",
                body: "Reads events to find a slot and creates the interview with a Meet link, only after approval.",
              },
              {
                scope: "meet.spaces.created",
                title: "Attach a Google Meet link",
                body: "Creates the meeting space that belongs to the event you approved.",
              },
              {
                scope: "drive.readonly + drive.file",
                title: "List resumes, create files",
                body: "Read-only listing for resumes, plus create access for the sheets, docs and folders Hirevoice makes.",
              },
              {
                scope: "spreadsheets",
                title: "Create and update trackers",
                body: "Creates a real Google Sheet on request and appends rows you approve. No other spreadsheet is touched.",
              },
              {
                scope: "documents",
                title: "Create interview & offer docs",
                body: "Creates formatted offer letters and redacted interview notes. Existing documents are not deleted.",
              },
              {
                scope: "forms.body + forms.responses.readonly",
                title: "Create application forms & read submissions",
                body: "Builds role-specific Google Forms for intake and parses candidate responses directly into HireVoice and Sheets.",
              },
            ].map((item) => (
              <div key={item.scope} className="flex items-start gap-3 px-4 py-2.5">
                <span className="mt-0.5 rounded-[3px] border border-rule bg-white px-1.5 py-0.5 font-mono text-[8.5px] text-slate">
                  {item.scope}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-ink">{item.title}</p>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-slate">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <div className="space-y-3">
          <WorkspaceActions connected={google.connected} />
          <Panel className="p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-verified" />
              <h2 className="text-[12px] font-semibold text-ink">Connection health</h2>
            </div>
            <div className="mt-3 space-y-2">
              {connections.slice(0, 5).map((connection) => (
                <div key={connection.id} className="flex items-center justify-between text-[10px]">
                  <span className="flex items-center gap-1.5 text-slate">
                    <StatusDot status={connection.status === "not_connected" ? "idle" : connection.status} />
                    {connection.name}
                  </span>
                  <span className="font-mono text-[9px] text-slate/70">
                    {connection.lastChecked ? formatRelative(connection.lastChecked) : "—"}
                  </span>
                </div>
              ))}
            </div>
          </Panel>
          <div className="rounded-[10px] border border-ink/10 bg-ink p-4 text-chalk">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.08em] text-mist/45">
              <Plug className="h-3 w-3 text-glow" />
              Google Cloud
            </div>
            <p className="mt-2 font-display text-[18px] font-medium leading-tight tracking-[-0.03em] text-mist">
              Runs in asia-south1 on Cloud Run.
            </p>
            <p className="mt-1.5 text-[10px] leading-relaxed text-mist/55">
              Supabase stays hosted for auth and Postgres. Secrets come from Secret Manager; none are
              baked into the image.
            </p>
            <a
              href="https://console.cloud.google.com/run"
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-[10px] font-medium text-glow hover:underline"
            >
              Open Cloud Run
              <ArrowUpRight className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>

      {setupOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4 backdrop-blur-[2px]">
          <button type="button" className="absolute inset-0" aria-label="Close setup" onClick={() => setSetupOpen(false)} />
          <div className="relative max-h-[90dvh] w-full max-w-[540px] animate-rise overflow-y-auto scroll-thin rounded-[20px] border border-rule bg-paper shadow-2xl">
            <div className="flex items-start justify-between border-b border-rule px-5 py-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.08em] text-slate">One grant · seven services</p>
                <h2 className="mt-1 font-display text-[22px] font-medium tracking-[-0.03em] text-ink">
                  Connect Google Workspace
                </h2>
                <p className="mt-0.5 text-[10.5px] text-slate">
                  {google.configured
                    ? "OAuth is configured. Consent opens on Google's domain."
                    : "This environment has no OAuth client yet. Add the four values below, then restart."}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSetupOpen(false)} aria-label="Close setup">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-3 px-5 py-4">
              <div className="rounded-[7px] border border-rule bg-white p-3">
                <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate">Environment</p>
                <ul className="mt-2 space-y-1.5 font-mono text-[9.5px] text-ink">
                  <li>GOOGLE_CLIENT_ID</li>
                  <li>GOOGLE_CLIENT_SECRET</li>
                  <li>GOOGLE_REDIRECT_URI</li>
                  <li>CONNECTOR_ENCRYPTION_KEY</li>
                </ul>
                <p className="mt-2 text-[9.5px] leading-relaxed text-slate">
                  Set the redirect URI to{" "}
                  <span className="break-all text-ink">
                    {typeof window === "undefined" ? "/api/google/callback" : `${window.location.origin}/api/google/callback`}
                  </span>
                  . In Google Cloud, enable Gmail, Calendar, Drive, Docs, Sheets and Forms APIs, then add test users
                  if the consent screen is still in testing.
                </p>
              </div>

              <div className="rounded-[7px] border border-rule bg-white p-3">
                <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate">Scopes requested</p>
                <ul className="mt-2 grid gap-1 text-[10px] text-slate sm:grid-cols-2">
                  {[
                    "gmail.modify",
                    "calendar",
                    "meet.spaces.created",
                    "drive.readonly + drive.file",
                    "documents",
                    "spreadsheets",
                    "forms.body",
                    "forms.responses.readonly",
                  ].map((scope) => (
                    <li key={scope} className="flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-verified" />
                      {scope}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-[7px] border border-flag/30 bg-flag-soft/60 p-3">
                <p className="text-[10px] font-medium text-[#6c5200]">What stays local</p>
                <p className="mt-1 text-[9.5px] leading-relaxed text-[#6c5200]/85">
                  Refresh tokens are encrypted with AES-256-GCM before they touch the database. Hiring
                  decisions, evidence and approval state stay in Hirevoice.
                </p>
              </div>

              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[10px] font-medium text-slate hover:text-ink hover:underline"
              >
                Open Google Cloud credentials
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <div className="flex items-center gap-2 border-t border-rule bg-chalk/40 px-5 py-3">
              <Button
                variant="ink"
                size="sm"
                onClick={() => {
                  setSetupOpen(false);
                  beginGoogle();
                }}
                disabled={!google.configured}
              >
                <Plug className="h-3 w-3" />
                {google.configured ? "Start consent" : "Add credentials first"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSetupOpen(false)} className="ml-auto">
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {detail ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4 backdrop-blur-[2px]">
          <button type="button" className="absolute inset-0" aria-label="Close connection details" onClick={() => setDetail(null)} />
          <div className="relative w-full max-w-[460px] animate-rise overflow-hidden rounded-[20px] border border-rule bg-paper shadow-2xl">
            <div className="flex items-start justify-between border-b border-rule px-5 py-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.08em] text-slate">Connection</p>
                <h2 className="mt-1 font-display text-[22px] font-medium tracking-[-0.03em] text-ink">
                  {detail.name}
                </h2>
                <p className="mt-0.5 text-[10.5px] text-slate">{detail.account}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setDetail(null)} aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-5">
              <p className="text-[10px] font-medium text-slate">Granted scopes</p>
              <div className="mt-2 space-y-1.5">
                {(isGoogle(detail.service) && google.scopes.length > 0 ? google.scopes : detail.scopes).map((scope) => (
                  <div key={scope} className="flex items-center justify-between rounded-[5px] border border-rule bg-white px-2.5 py-2">
                    <span className="font-mono text-[9.5px] text-ink">{scope}</span>
                    <Check className="h-3 w-3 text-verified" />
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-[6px] border border-flag/30 bg-flag-soft/60 p-3">
                <p className="text-[10px] font-medium text-[#6c5200]">Disconnecting</p>
                <p className="mt-1 text-[10px] leading-relaxed text-[#6c5200]/85">
                  Disconnecting stops dependent agents immediately. Existing interview evidence stays
                  available to the review team.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-rule bg-chalk/40 px-5 py-3">
              <Button variant="danger" size="sm" onClick={() => disconnect(detail)}>
                Disconnect
              </Button>
              <Button variant="ink" size="sm" onClick={() => setDetail(null)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
