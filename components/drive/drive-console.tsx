"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import {
  ArrowUpRight,
  CheckCircle2,
  Copy,
  Maximize2,
  Minimize2,
  QrCode,
  Radio,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/panel";
import type { Role, Workspace } from "@/lib/types";
import { cn, languageLabel, stageLabel } from "@/lib/utils";

type QueueItem = {
  id: string;
  name: string;
  alias: string;
  driveToken: string;
  roleId: string;
  roleTitle: string;
  language: string;
  stage: string;
  overall: number;
  evidenceQuality: number;
  verifiedQuotes: number;
  totalQuotes: number;
  latencyMs: number | null;
  model: string;
  isReal: boolean;
  interviewAt: string;
  reviewUrl: string;
  alternateFit: { roleTitle: string; fitScore: number } | null;
  injectionFlagged: boolean;
};

type QueuePayload = {
  ok: boolean;
  updatedAt: string;
  realMetrics?: Workspace["realMetrics"];
  queue: QueueItem[];
  seededSample: QueueItem[];
};

export function DriveConsole({
  roles,
  initialMetrics,
}: {
  roles: Role[];
  initialMetrics?: Workspace["realMetrics"];
}) {
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "role-support");
  const [origin, setOrigin] = useState("http://localhost:3000");
  const [lanUrl, setLanUrl] = useState<string | null>(null);
  const [projectorMode, setProjectorMode] = useState(false);
  const [calledToken, setCalledToken] = useState<string | null>(null);
  const [data, setData] = useState<QueuePayload | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("hv_public_base_url");
      setOrigin(saved || window.location.origin);
    }
    fetch("/api/network-info")
      .then((r) => (r.ok ? r.json() : null))
      .then((info: { lanUrl?: string | null } | null) => {
        if (info?.lanUrl) setLanUrl(info.lanUrl);
      })
      .catch(() => {});
  }, []);

  const updateOrigin = (next: string) => {
    setOrigin(next);
    if (typeof window !== "undefined") {
      if (next.trim()) window.localStorage.setItem("hv_public_base_url", next.trim().replace(/\/$/, ""));
      else window.localStorage.removeItem("hv_public_base_url");
    }
  };

  const fetchQueue = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/drive/queue", { cache: "no-store" });
      if (res.ok) {
        const payload = (await res.json()) as QueuePayload;
        setData(payload);
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchQueue();
    const timer = window.setInterval(() => void fetchQueue(), 4500);
    return () => window.clearInterval(timer);
  }, [fetchQueue]);

  const activeRole = roles.find((r) => r.id === roleId) ?? roles[0];
  const driveUrl = `${origin.trim().replace(/\/$/, "") || "http://localhost:3000"}/i/drive-${roleId}`;
  const realQueue = data?.queue ?? [];
  const metrics = data?.realMetrics ?? initialMetrics;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(driveUrl);
      toast.success("Walk-in Drive link copied.");
    } catch {
      toast(driveUrl);
    }
  };

  return (
    <div
      className={cn(
        "mx-auto px-4 py-5 sm:px-6 xl:px-8",
        projectorMode ? "max-w-[1600px]" : "max-w-[1440px]",
      )}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge tone="onair" dot>Live Walk-in Drive</Badge>
            <span className="font-mono text-[10px] text-slate">Auto-refreshes every 4.5s</span>
          </div>
          <h1 className="mt-2 font-display text-[30px] font-medium leading-[1.05] tracking-[-0.04em] text-ink sm:text-[36px]">
            Lobby QR & Ranked Queue
          </h1>
          <p className="mt-1 text-[13px] text-slate">
            Candidates scan on their own phones while waiting. Ops managers only meet the verified top band.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            className="h-9 rounded-[7px] border border-rule bg-paper px-3 text-[12px] text-ink outline-none focus:border-ink"
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={() => void fetchQueue()} disabled={refreshing}>
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            Refresh
          </Button>
          <Button variant="ink" size="sm" onClick={() => setProjectorMode((v) => !v)}>
            {projectorMode ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            {projectorMode ? "Exit lobby view" : "Projector mode"}
          </Button>
        </div>
      </div>

      {/* Honest Real-Only Traction Strip (excludes seeded sessions) */}
      <Panel className="mt-5 overflow-hidden">
        <div className="grid grid-cols-2 divide-x divide-y divide-rule sm:grid-cols-4 sm:divide-y-0">
          {[
            { label: "Real completed screens", value: String(metrics?.completed ?? 0), sub: "Excludes seeded demos" },
            {
              label: "Median scoring latency",
              value: metrics?.medianLatencyMs ? `${(metrics.medianLatencyMs / 1000).toFixed(1)}s` : "—",
              sub: "End of interview → verified",
            },
            {
              label: "Verified / total quotes",
              value: metrics?.totalQuotes ? `${metrics.verifiedQuotes}/${metrics.totalQuotes}` : "—",
              sub: "Deterministic code check",
            },
            {
              label: "Walk-in + uploaded calls",
              value: `${metrics?.driveCount ?? 0} / ${metrics?.uploadedCalls ?? 0}`,
              sub: "Live lobby / uploaded MP3",
            },
          ].map((stat) => (
            <div key={stat.label} className="px-4 py-3">
              <p className="text-[10px] text-slate">{stat.label}</p>
              <p className="mt-1 font-display text-[24px] font-medium leading-none tracking-[-0.03em] text-ink">
                {stat.value}
              </p>
              <p className="mt-1 text-[9.5px] text-slate/75">{stat.sub}</p>
            </div>
          ))}
        </div>
      </Panel>

      <div className="mt-5 grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        {/* Lobby QR Card */}
        <Panel className="flex flex-col items-center p-6 text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-rule bg-chalk px-2.5 py-1 text-[10px] font-medium text-ink">
            <QrCode className="h-3 w-3 text-ultramarine" />
            Scan to start 4-min voice screen
          </div>
          <h2 className="mt-3 font-display text-[20px] font-medium tracking-[-0.03em] text-ink">
            {activeRole?.title ?? "Customer Support Executive"}
          </h2>
          <p className="mt-1 text-[11px] text-slate">
            English · हिंदी · Hinglish · No app download
          </p>

          <div className="mt-5 rounded-[14px] border border-rule bg-white p-4 shadow-sm">
            <QRCodeSVG value={driveUrl} size={projectorMode ? 236 : 196} level="M" />
          </div>

          <div className="mt-4 flex w-full items-center gap-1.5 rounded-[7px] border border-rule bg-chalk/60 px-2.5 py-1.5">
            <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-slate">{driveUrl}</span>
            <button
              type="button"
              onClick={copyLink}
              className="rounded p-1 text-slate hover:bg-white hover:text-ink"
              aria-label="Copy drive link"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-3 flex w-full gap-2">
            <Button variant="primary" size="md" className="flex-1" asChild>
              <Link href={`/i/drive-${roleId}`} target="_blank">
                Open candidate booth
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>

          {!projectorMode ? (
            <div className="mt-4 w-full rounded-[8px] border border-rule bg-chalk/55 p-2.5 text-left">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[9.5px] font-medium text-ink">Public / Tunnel URL</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => updateOrigin(typeof window !== "undefined" ? window.location.origin : "http://localhost:3000")}
                    className="rounded border border-rule bg-white px-1.5 py-0.5 font-mono text-[8.5px] text-slate hover:text-ink"
                  >
                    local
                  </button>
                  {lanUrl ? (
                    <button
                      type="button"
                      onClick={() => updateOrigin(lanUrl)}
                      className="rounded border border-rule bg-white px-1.5 py-0.5 font-mono text-[8.5px] text-slate hover:text-ink"
                    >
                      Wi-Fi
                    </button>
                  ) : null}
                </div>
              </div>
              <input
                type="url"
                value={origin}
                onChange={(e) => updateOrigin(e.target.value)}
                placeholder="https://xxx.trycloudflare.com"
                className="mt-1.5 w-full rounded-[5px] border border-rule bg-white px-2 py-1 font-mono text-[10px] text-ink outline-none focus:border-ink"
              />
            </div>
          ) : null}

          {calledToken ? (
            <div className="mt-4 w-full rounded-[9px] border border-verified/30 bg-verified-soft px-3.5 py-2.5 text-left">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#0a7f51]">
                <Radio className="h-3 w-3 animate-pulse" />
                Now calling to Desk 1
              </p>
              <p className="mt-0.5 font-display text-[22px] font-medium text-ink">{calledToken}</p>
            </div>
          ) : null}
        </Panel>

        {/* Ranked Live Queue */}
        <Panel className="overflow-hidden">
          <PanelHeader
            title="Ranked Lobby Queue"
            meta="Sorted by rubric score × evidence quality. Click any candidate to inspect verified quotes."
            action={
              <span className="flex items-center gap-1.5 font-mono text-[10px] text-slate">
                <Users className="h-3.5 w-3.5" />
                {realQueue.length} live
              </span>
            }
          />

          {realQueue.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-rule bg-chalk">
                <Sparkles className="h-5 w-5 text-ultramarine" />
              </div>
              <p className="mt-3 text-[14px] font-medium text-ink">Waiting for first live candidate</p>
              <p className="mt-1 max-w-[380px] text-[12px] text-slate">
                Scan the QR code on a phone (or click “Open candidate booth”) and complete a 60-second screen. The scored, verified result appears here automatically.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-rule">
              {realQueue.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 transition hover:bg-chalk/45"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border border-ink/15 bg-ink font-mono text-[13px] font-semibold text-chalk">
                      {item.driveToken}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={item.reviewUrl}
                          className="truncate text-[13.5px] font-semibold text-ink hover:text-ultramarine"
                        >
                          {item.name}
                        </Link>
                        <Badge tone="verified" dot>Real</Badge>
                        <Badge tone="neutral">{stageLabel(item.stage as never)}</Badge>
                        {item.injectionFlagged ? (
                          <Badge tone="onair">
                            <ShieldAlert className="mr-1 h-2.5 w-2.5" /> Shield flagged
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate">
                        {item.roleTitle} · {languageLabel(item.language as never)} ·{" "}
                        <span className="font-mono text-[10px]">
                          {item.verifiedQuotes}/{item.totalQuotes} quotes verified
                          {item.latencyMs ? ` · ${(item.latencyMs / 1000).toFixed(1)}s` : ""}
                        </span>
                      </p>
                      {item.alternateFit ? (
                        <p className="mt-1 text-[10.5px] font-medium text-ultramarine">
                          Re-route match: {item.alternateFit.roleTitle} ({item.alternateFit.fitScore.toFixed(1)}/5)
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="mr-2 text-right">
                      <p className="font-mono text-[15px] font-semibold text-ink">{item.overall.toFixed(1)}/5</p>
                      <p className="font-mono text-[9.5px] text-slate">
                        {Math.round(item.evidenceQuality * 100)}% quality
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setCalledToken(`${item.driveToken} · ${item.name}`);
                        toast.success(`Called ${item.driveToken} (${item.name}) to Desk 1.`);
                      }}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Call next
                    </Button>
                    <Button variant="ink" size="sm" asChild>
                      <Link href={item.reviewUrl}>
                        Evidence <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Clearly separated seeded reference examples */}
          {data?.seededSample && data.seededSample.length > 0 ? (
            <div className="border-t border-rule bg-chalk/40 px-4 py-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate">
                Seeded demo examples (excluded from live traction metrics)
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {data.seededSample.map((item) => (
                  <Link
                    key={item.id}
                    href={item.reviewUrl}
                    className="flex items-center justify-between rounded-[7px] border border-rule bg-paper px-3 py-2 text-[11.5px] transition hover:border-slate/50"
                  >
                    <span className="truncate font-medium text-ink">{item.name}</span>
                    <span className="font-mono text-[10.5px] text-slate">
                      {item.overall.toFixed(1)}/5 · {item.verifiedQuotes}/{item.totalQuotes} verified
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </Panel>
      </div>
    </div>
  );
}
