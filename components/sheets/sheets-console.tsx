"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ExternalLink,
  FileSpreadsheet,
  Filter,
  Loader2,
  Plug,
  Plus,
  RefreshCcw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Table2,
  Wand2,
  X,
} from "lucide-react";
import type {
  GoogleConnection,
  SheetCleanReport,
  SheetData,
  SheetSummary,
  Workspace,
} from "@/lib/types";
import { cn, formatRelative } from "@/lib/utils";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/panel";

type SheetsListPayload = {
  connection: GoogleConnection;
  source: "google" | "demo";
  sheets: SheetSummary[];
  templates: Record<string, { label: string; header: string[] }>;
  warning?: string | null;
  error?: string;
};

type CleanPreviewPayload = {
  mode: "preview" | "apply";
  simulated?: boolean;
  cleanedRows: string[][];
  report: SheetCleanReport;
  aiApplied: boolean;
  aiNote: string | null;
  tab?: { tabTitle: string; updatedRange: string; url: string };
  created?: { id: string; name: string; url: string };
  message?: string;
  error?: string;
};

const QUICK_CLEAN_PRESETS = [
  { label: "Full hiring cleanup", instruction: "" },
  { label: "Standardize phones & emails", instruction: "Standardize all Indian phone numbers and lowercase emails" },
  { label: "Sort by score (high → low)", instruction: "Sort candidates by score descending and mark 4.0+ as High Priority" },
  { label: "Normalize cities & stages", instruction: "Normalize Indian city names and pipeline stages cleanly" },
];

function colLetter(index: number): string {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

export function SheetsConsole({ workspace }: { workspace: Workspace }) {
  const [connection, setConnection] = useState<GoogleConnection>(workspace.google);
  const [source, setSource] = useState<"google" | "demo">(workspace.google.connected ? "google" : "demo");
  const [sheets, setSheets] = useState<SheetSummary[]>([]);
  const [templates, setTemplates] = useState<Record<string, { label: string; header: string[] }>>({});
  const [loadingList, setLoadingList] = useState(true);
  const [listQuery, setListQuery] = useState("");
  const [customUrl, setCustomUrl] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetData | null>(null);
  const [loadingSheet, setLoadingSheet] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newTemplate, setNewTemplate] = useState("tele_caller");
  const [newHeader, setNewHeader] = useState("");
  const [creating, setCreating] = useState(false);

  const [instruction, setInstruction] = useState("");
  const [rules, setRules] = useState({
    trimWhitespace: true,
    fixCasing: true,
    standardizePhones: true,
    standardizeEmails: true,
    standardizeCities: true,
    standardizeStages: true,
    deduplicate: true,
    skipBlankRows: true,
  });

  const [preview, setPreview] = useState<CleanPreviewPayload | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [viewMode, setViewMode] = useState<"raw" | "cleaned" | "diff">("raw");
  const [gridFilter, setGridFilter] = useState("");

  const [addRowOpen, setAddRowOpen] = useState(false);
  const [newRowCells, setNewRowCells] = useState<string[]>([]);
  const [addingRow, setAddingRow] = useState(false);

  const [editingCell, setEditingCell] = useState<{ r: number; c: number; value: string } | null>(null);
  const [savingCell, setSavingCell] = useState(false);

  const loadList = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch("/api/sheets", { cache: "no-store" });
      const data = (await res.json()) as SheetsListPayload;
      if (!res.ok) throw new Error(data.error ?? "Could not list Google Sheets.");
      setConnection(data.connection);
      setSource(data.source);
      setSheets(data.sheets);
      setTemplates(data.templates ?? {});
      if (data.warning) {
        toast("Drive listing notice", { description: data.warning });
      }
      setSelectedId((curr) => {
        if (curr && data.sheets.some((s) => s.id === curr)) return curr;
        return data.sheets[0]?.id ?? null;
      });
    } catch (error) {
      toast.error("Sheets unavailable", {
        description: error instanceof Error ? error.message : "Try again in a moment.",
      });
    } finally {
      setLoadingList(false);
    }
  }, []);

  const loadSheet = useCallback(async (id: string, tab?: string) => {
    setLoadingSheet(true);
    setPreview(null);
    setViewMode("raw");
    setEditingCell(null);
    try {
      const qs = tab ? `?tab=${encodeURIComponent(tab)}` : "";
      const res = await fetch(`/api/sheets/${encodeURIComponent(id)}${qs}`, { cache: "no-store" });
      const data = (await res.json()) as { sheet?: SheetData; error?: string };
      if (!res.ok || !data.sheet) throw new Error(data.error ?? "Could not read spreadsheet.");
      setSheet(data.sheet);
      setNewRowCells(Array.from({ length: data.sheet.rows[0]?.length ?? 5 }, () => ""));
    } catch (error) {
      toast.error("Could not open sheet", {
        description: error instanceof Error ? error.message : "Check access permissions.",
      });
    } finally {
      setLoadingSheet(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (selectedId) {
      void loadSheet(selectedId);
    }
  }, [selectedId, loadSheet]);

  const visibleSheets = useMemo(() => {
    const q = listQuery.trim().toLowerCase();
    if (!q) return sheets;
    return sheets.filter((s) => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q));
  }, [sheets, listQuery]);

  const handleOpenByUrl = (event: React.FormEvent) => {
    event.preventDefault();
    const raw = customUrl.trim();
    if (!raw) return;
    const match = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    const id = match?.[1] ?? raw;
    setSelectedId(id);
    setCustomUrl("");
  };

  const handleCreateSheet = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newTitle.trim()) {
      toast.error("Enter a sheet title first.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          template: newTemplate,
          header: newHeader.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { sheet?: SheetSummary; message?: string; error?: string };
      if (!res.ok || !data.sheet) throw new Error(data.error ?? "Could not create sheet.");
      toast.success(data.message ?? "Google Sheet created", {
        action: { label: "Open in Google", onClick: () => window.open(data.sheet!.url, "_blank", "noreferrer") },
      });
      setSheets((curr) => [data.sheet!, ...curr.filter((s) => !s.demo)]);
      setSelectedId(data.sheet.id);
      setNewTitle("");
      setNewHeader("");
      setCreateOpen(false);
    } catch (error) {
      toast.error("Could not create sheet", {
        description: error instanceof Error ? error.message : "Connect Google Workspace first.",
      });
    } finally {
      setCreating(false);
    }
  };

  const runClean = async (mode: "preview" | "apply", target: "new_tab" | "new_sheet" = "new_tab") => {
    if (!sheet) return;
    if (mode === "preview") setCleaning(true);
    else setApplying(true);

    try {
      const res = await fetch(`/api/sheets/${encodeURIComponent(sheet.id)}/clean`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          target,
          tab: sheet.activeTab,
          options: {
            ...rules,
            instruction: instruction.trim() || undefined,
          },
        }),
      });
      const data = (await res.json()) as CleanPreviewPayload;
      if (!res.ok) throw new Error(data.error ?? "Data cleaning failed.");

      setPreview(data);

      if (mode === "preview") {
        setViewMode(data.report.changes.length > 0 ? "diff" : "cleaned");
        toast.success("Clean preview ready", {
          description: `${data.report.changes.length} cell fixes · ${data.report.duplicatesDetected} duplicates · ${data.report.blankRowsSkipped} blank rows`,
        });
      } else if (data.simulated) {
        setSheet((curr) => (curr ? { ...curr, rows: data.cleanedRows, health: data.report } : curr));
        setViewMode("cleaned");
        toast("Cleaned in preview workspace", {
          description: data.message,
        });
      } else {
        toast.success(data.message ?? "Cleaned data saved", {
          action: data.created
            ? { label: "Open new Sheet", onClick: () => window.open(data.created!.url, "_blank", "noreferrer") }
            : data.tab
              ? { label: "Open in Sheets", onClick: () => window.open(data.tab!.url, "_blank", "noreferrer") }
              : undefined,
        });
        if (data.tab) {
          await loadSheet(sheet.id, data.tab.tabTitle);
        } else if (data.created) {
          await loadList();
          setSelectedId(data.created.id);
        }
      }
    } catch (error) {
      toast.error("Cleaning failed", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setCleaning(false);
      setApplying(false);
    }
  };

  const handleAppendRow = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!sheet) return;
    if (newRowCells.every((c) => !c.trim())) {
      toast.error("Fill at least one field.");
      return;
    }
    if (sheet.demo || !connection.connected) {
      setSheet((curr) => (curr ? { ...curr, rows: [...curr.rows, newRowCells] } : curr));
      setNewRowCells(Array.from({ length: sheet.rows[0]?.length ?? 5 }, () => ""));
      setAddRowOpen(false);
      toast("Row added to sample preview");
      return;
    }
    setAddingRow(true);
    try {
      const res = await fetch(`/api/sheets/${encodeURIComponent(sheet.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "append", tab: sheet.activeTab, row: newRowCells }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not add row.");
      toast.success("Row appended to Google Sheet");
      setAddRowOpen(false);
      await loadSheet(sheet.id, sheet.activeTab);
    } catch (error) {
      toast.error("Could not add row", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setAddingRow(false);
    }
  };

  const saveCellEdit = async () => {
    if (!sheet || !editingCell) return;
    const { r, c, value } = editingCell;
    const nextRows = sheet.rows.map((row, rIdx) => {
      if (rIdx !== r) return row;
      const copy = [...row];
      copy[c] = value;
      return copy;
    });

    if (sheet.demo || !connection.connected) {
      setSheet({ ...sheet, rows: nextRows });
      setEditingCell(null);
      toast("Updated in sample preview");
      return;
    }

    setSavingCell(true);
    try {
      const a1 = `${colLetter(c)}${r + 1}`;
      const res = await fetch(`/api/sheets/${encodeURIComponent(sheet.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_cell", tab: sheet.activeTab, range: a1, value }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not save cell.");
      setSheet({ ...sheet, rows: nextRows });
      setEditingCell(null);
      toast.success(`Saved ${a1}`);
    } catch (error) {
      toast.error("Cell not saved", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setSavingCell(false);
    }
  };

  const activeRows = viewMode === "cleaned" && preview ? preview.cleanedRows : sheet?.rows ?? [];
  const headerRow = activeRows[0] ?? [];
  const bodyRows = useMemo(() => {
    const body = activeRows.slice(1);
    const term = gridFilter.trim().toLowerCase();
    if (!term) return body.map((row, idx) => ({ row, rowNum: idx + 2 }));
    return body
      .map((row, idx) => ({ row, rowNum: idx + 2 }))
      .filter(({ row }) => row.some((cell) => cell.toLowerCase().includes(term)));
  }, [activeRows, gridFilter]);

  const issueByRow = useMemo(() => {
    const map = new Map<number, string[]>();
    const list = preview?.report.issues ?? sheet?.health.issues ?? [];
    for (const issue of list) {
      const arr = map.get(issue.rowIndex) ?? [];
      arr.push(issue.message);
      map.set(issue.rowIndex, arr);
    }
    return map;
  }, [preview, sheet]);

  const health = preview?.report ?? sheet?.health ?? null;
  const totalMessyFixes = health
    ? health.trimmedCells +
      health.normalizedNames +
      health.normalizedEmails +
      health.normalizedPhones +
      health.normalizedCities +
      health.normalizedStages
    : 0;

  return (
    <div className="mx-auto max-w-[1540px] px-4 py-5 sm:px-6 sm:py-7 xl:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate">
            <Table2 className="h-3.5 w-3.5" />
            Google Sheets · Data Cleaner & Tracker Studio
            {connection.email ? <span className="font-mono text-[9.5px] text-slate/70">· {connection.email}</span> : null}
          </p>
          <h1 className="mt-1 font-display text-[32px] font-medium leading-none tracking-[-0.04em] text-ink sm:text-[38px]">
            Sheets Studio
          </h1>
          <p className="mt-1.5 max-w-[680px] text-[13px] leading-relaxed text-slate">
            Inspect hiring trackers, edit cells inline, and clean messy job-board exports (broken phones, duplicate
            applicants, inconsistent cities & stages) safely into a new tab — by click or voice command.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {connection.connected ? (
            <Badge tone="verified" dot>
              Google Sheets live
            </Badge>
          ) : (
            <Link
              href="/app/connections"
              className="inline-flex items-center gap-1.5 rounded-[6px] border border-flag/35 bg-flag-soft px-2.5 py-1.5 text-[10.5px] font-medium text-[#6c5200] hover:border-flag"
            >
              <Plug className="h-3 w-3" />
              Connect Google for live Drive sheets
            </Link>
          )}
          <Button variant="outline" size="sm" onClick={() => void loadList()} disabled={loadingList}>
            <RefreshCcw className={cn("h-3.5 w-3.5", loadingList && "animate-spin")} />
            Refresh
          </Button>
          <Button variant="ink" size="sm" onClick={() => setCreateOpen((o) => !o)}>
            {createOpen ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {createOpen ? "Close" : "New hiring sheet"}
          </Button>
        </div>
      </div>

      {createOpen ? (
        <Panel className="mt-5 overflow-hidden border-ink/20">
          <PanelHeader
            title="Create a new Google Sheet"
            meta="Created directly in your Google Drive"
            action={
              <span className="text-[10px] text-slate">
                Voice: “Create a sheet named Hiring for Tele Caller”
              </span>
            }
          />
          <form onSubmit={handleCreateSheet} className="grid gap-3 p-4 md:grid-cols-3">
            <label className="block">
              <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate">Sheet Title</span>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Hiring for Tele Caller — Nov"
                className="mt-1 h-9 w-full rounded-[6px] border border-rule bg-white px-3 text-[12px] text-ink outline-none focus:border-ink"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate">Template</span>
              <select
                value={newTemplate}
                onChange={(e) => setNewTemplate(e.target.value)}
                className="mt-1 h-9 w-full rounded-[6px] border border-rule bg-white px-2.5 text-[12px] text-ink outline-none focus:border-ink"
              >
                {Object.entries(templates).map(([key, tpl]) => (
                  <option key={key} value={key}>
                    {tpl.label}
                  </option>
                ))}
                {Object.keys(templates).length === 0 ? (
                  <option value="tele_caller">Tele Caller Hiring Tracker</option>
                ) : null}
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate">
                Custom columns <span className="normal-case text-slate/70">(optional, comma-separated)</span>
              </span>
              <input
                value={newHeader}
                onChange={(e) => setNewHeader(e.target.value)}
                placeholder="Candidate, Email, Phone, City, Stage"
                className="mt-1 h-9 w-full rounded-[6px] border border-rule bg-white px-3 text-[12px] text-ink outline-none focus:border-ink"
              />
            </label>
            <div className="flex items-center gap-2 md:col-span-3">
              <Button type="submit" variant="primary" size="sm" disabled={creating || !connection.connected}>
                {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
                {connection.connected ? "Create Google Sheet" : "Connect Google Workspace first"}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Panel>
      ) : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-[310px_minmax(0,1fr)]">
        <div className="space-y-3">
          <Panel className="overflow-hidden">
            <PanelHeader
              title="Spreadsheets"
              meta={`${sheets.length} ${source === "demo" ? "sample" : "in Drive"}`}
            />
            <div className="border-b border-rule p-2.5">
              <div className="flex h-8 items-center gap-1.5 rounded-[5px] border border-rule bg-white px-2">
                <Search className="h-3.5 w-3.5 text-slate/60" />
                <input
                  value={listQuery}
                  onChange={(e) => setListQuery(e.target.value)}
                  placeholder="Filter spreadsheets…"
                  className="h-full w-full bg-transparent text-[11.5px] text-ink outline-none placeholder:text-slate/55"
                />
              </div>
            </div>

            {loadingList ? (
              <div className="flex items-center justify-center gap-2 py-10 text-[11px] text-slate">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading sheets…
              </div>
            ) : visibleSheets.length === 0 ? (
              <p className="px-4 py-8 text-center text-[11px] text-slate">No matching spreadsheets found.</p>
            ) : (
              <ul className="max-h-[420px] divide-y divide-rule overflow-y-auto scroll-thin">
                {visibleSheets.map((item) => {
                  const active = selectedId === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(item.id)}
                        className={cn(
                          "w-full px-3.5 py-2.5 text-left transition",
                          active ? "bg-ultramarine-soft/60" : "hover:bg-white",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="line-clamp-2 text-[12px] font-medium text-ink">{item.name}</p>
                          {item.demo ? <Badge tone="neutral">sample</Badge> : null}
                        </div>
                        <p className="mt-1 font-mono text-[9px] text-slate">
                          Updated {formatRelative(item.modifiedTime)}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <form onSubmit={handleOpenByUrl} className="border-t border-rule bg-chalk/45 p-2.5">
              <p className="text-[9.5px] font-medium uppercase tracking-[0.06em] text-slate">Open any Sheet by URL or ID</p>
              <div className="mt-1.5 flex gap-1.5">
                <input
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="Paste Google Sheets URL…"
                  className="h-8 min-w-0 flex-1 rounded-[5px] border border-rule bg-white px-2 text-[11px] text-ink outline-none focus:border-ink"
                />
                <Button type="submit" variant="outline" size="sm">
                  Open
                </Button>
              </div>
            </form>
          </Panel>

          <Panel className="p-3.5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-verified" />
              <p className="text-[11.5px] font-semibold text-ink">Zero-deletion guarantee</p>
            </div>
            <p className="mt-1.5 text-[10.5px] leading-relaxed text-slate">
              Cleaning never erases your original raw tab. HireVoice writes standardized, deduplicated data into a
              brand-new <code className="rounded bg-chalk px-1 font-mono text-[9.5px]">Cleaned</code> tab or a new
              Google Sheet so nothing is ever lost.
            </p>
          </Panel>
        </div>

        <div className="min-w-0 space-y-4">
          {loadingSheet ? (
            <Panel className="flex items-center justify-center gap-2 py-20 text-[12px] text-slate">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading spreadsheet & scanning data health…
            </Panel>
          ) : sheet ? (
            <>
              <Panel className="overflow-hidden">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-rule px-5 py-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-[22px] font-medium leading-tight tracking-[-0.03em] text-ink">
                        {sheet.name}
                      </h2>
                      {sheet.demo ? (
                        <Badge tone="flag">Messy sample dataset</Badge>
                      ) : (
                        <Badge tone="verified" dot>
                          Live Google Sheet
                        </Badge>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {sheet.tabs.map((tab) => (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => void loadSheet(sheet.id, tab)}
                          className={cn(
                            "rounded-[5px] border px-2 py-0.5 text-[10.5px] font-medium transition",
                            sheet.activeTab === tab
                              ? "border-ink bg-ink text-chalk"
                              : "border-rule bg-white text-slate hover:border-slate/60 hover:text-ink",
                          )}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button variant="outline" size="sm" onClick={() => setAddRowOpen((o) => !o)}>
                      <Plus className="h-3.5 w-3.5" />
                      Add row
                    </Button>
                    <a
                      href={sheet.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-8 items-center gap-1.5 rounded-[6px] border border-rule bg-white px-2.5 text-[11px] font-medium text-ink hover:border-ink"
                    >
                      Open in Google Sheets
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>

                {health ? (
                  <div className="grid grid-cols-2 divide-x divide-y divide-rule border-b border-rule bg-chalk/40 sm:grid-cols-5 sm:divide-y-0">
                    <div className="px-4 py-2.5">
                      <p className="text-[9.5px] text-slate">Data rows</p>
                      <p className="mt-0.5 font-mono text-[16px] font-semibold text-ink">{health.totalRawRows}</p>
                    </div>
                    <div className="px-4 py-2.5">
                      <p className="text-[9.5px] text-slate">Messy cells detected</p>
                      <p className={cn("mt-0.5 font-mono text-[16px] font-semibold", totalMessyFixes > 0 ? "text-[#9a6700]" : "text-verified")}>
                        {totalMessyFixes}
                      </p>
                    </div>
                    <div className="px-4 py-2.5">
                      <p className="text-[9.5px] text-slate">Duplicates</p>
                      <p className={cn("mt-0.5 font-mono text-[16px] font-semibold", health.duplicatesDetected > 0 ? "text-onair" : "text-verified")}>
                        {health.duplicatesDetected}
                      </p>
                    </div>
                    <div className="px-4 py-2.5">
                      <p className="text-[9.5px] text-slate">Blank rows</p>
                      <p className="mt-0.5 font-mono text-[16px] font-semibold text-ink">{health.blankRowsSkipped}</p>
                    </div>
                    <div className="px-4 py-2.5">
                      <p className="text-[9.5px] text-slate">Flagged issues</p>
                      <p className={cn("mt-0.5 font-mono text-[16px] font-semibold", health.issueCount > 0 ? "text-onair" : "text-verified")}>
                        {health.issueCount}
                      </p>
                    </div>
                  </div>
                ) : null}

                {/* Smart Messy Data Cleaner Bar */}
                <div className="border-b border-rule bg-paper px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Wand2 className="h-4 w-4 text-ultramarine" />
                      <h3 className="text-[12.5px] font-semibold text-ink">Smart Messy Data Cleaner</h3>
                      <Badge tone="ultra">Non-destructive</Badge>
                    </div>
                    <span className="text-[10px] text-slate">
                      Voice: “Clean messy data in {sheet.name.split("—")[0].trim()}”
                    </span>
                  </div>

                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {QUICK_CLEAN_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setInstruction(preset.instruction)}
                        className="rounded-full border border-rule bg-white px-2.5 py-1 text-[10.5px] text-slate transition hover:border-ultramarine hover:text-ink"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <input
                      value={instruction}
                      onChange={(e) => setInstruction(e.target.value)}
                      placeholder="Optional custom rule: e.g. 'Sort by score descending and add Priority column for 4.0+'…"
                      className="h-9 min-w-[260px] flex-1 rounded-[6px] border border-rule bg-white px-3 text-[12px] text-ink outline-none focus:border-ink"
                    />
                    <Button
                      variant="ink"
                      size="sm"
                      disabled={cleaning}
                      onClick={() => void runClean("preview")}
                    >
                      {cleaning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                      Preview clean
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={applying}
                      onClick={() => void runClean("apply", "new_tab")}
                    >
                      {applying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      Save to Cleaned Tab
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={applying || !connection.connected || sheet.demo}
                      onClick={() => void runClean("apply", "new_sheet")}
                    >
                      Save as New Sheet
                    </Button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[10.5px] text-slate">
                    {(
                      [
                        ["trimWhitespace", "Trim spaces"],
                        ["fixCasing", "Title-case names"],
                        ["standardizePhones", "Format +91 phones"],
                        ["standardizeEmails", "Clean emails"],
                        ["standardizeCities", "Normalize cities"],
                        ["standardizeStages", "Normalize stages"],
                        ["deduplicate", "Deduplicate leads"],
                        ["skipBlankRows", "Skip blank rows"],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key} className="flex cursor-pointer items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={rules[key]}
                          onChange={(e) => setRules((curr) => ({ ...curr, [key]: e.target.checked }))}
                          className="rounded border-rule"
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>

                  {preview?.aiNote ? (
                    <div className="mt-3 flex items-center gap-2 rounded-[7px] border border-ultramarine/25 bg-ultramarine-soft/60 px-3 py-2 text-[11px] text-[#2536c9]">
                      <Sparkles className="h-3.5 w-3.5 shrink-0" />
                      <span>{preview.aiNote}</span>
                    </div>
                  ) : null}
                </div>

                {addRowOpen ? (
                  <form onSubmit={handleAppendRow} className="border-b border-rule bg-chalk/60 px-5 py-3.5">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold text-ink">Append new row to “{sheet.activeTab}”</p>
                      <button type="button" onClick={() => setAddRowOpen(false)} className="text-[10.5px] text-slate hover:text-ink">
                        Cancel
                      </button>
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
                      {headerRow.map((col, idx) => (
                        <input
                          key={`${col}-${idx}`}
                          value={newRowCells[idx] ?? ""}
                          onChange={(e) => {
                            const next = [...newRowCells];
                            next[idx] = e.target.value;
                            setNewRowCells(next);
                          }}
                          placeholder={col}
                          className="h-8 rounded-[5px] border border-rule bg-white px-2.5 text-[11.5px] text-ink outline-none focus:border-ink"
                        />
                      ))}
                    </div>
                    <Button type="submit" variant="ink" size="sm" className="mt-2.5" disabled={addingRow}>
                      {addingRow ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                      Append row
                    </Button>
                  </form>
                ) : null}

                {/* View Mode Tabs + Table Filter */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule px-4 py-2.5">
                  <div className="flex items-center gap-1 rounded-[6px] border border-rule bg-chalk/50 p-0.5">
                    <button
                      type="button"
                      onClick={() => setViewMode("raw")}
                      className={cn(
                        "rounded-[4px] px-2.5 py-1 text-[11px] font-medium transition",
                        viewMode === "raw" ? "bg-ink text-chalk" : "text-slate hover:text-ink",
                      )}
                    >
                      Current Sheet ({Math.max(0, sheet.rows.length - 1)})
                    </button>
                    <button
                      type="button"
                      disabled={!preview}
                      onClick={() => setViewMode("cleaned")}
                      className={cn(
                        "rounded-[4px] px-2.5 py-1 text-[11px] font-medium transition disabled:opacity-45",
                        viewMode === "cleaned" ? "bg-verified text-white" : "text-slate hover:text-ink",
                      )}
                    >
                      Cleaned Preview {preview ? `(${preview.report.cleanedRowCount})` : ""}
                    </button>
                    <button
                      type="button"
                      disabled={!preview}
                      onClick={() => setViewMode("diff")}
                      className={cn(
                        "rounded-[4px] px-2.5 py-1 text-[11px] font-medium transition disabled:opacity-45",
                        viewMode === "diff" ? "bg-ultramarine text-white" : "text-slate hover:text-ink",
                      )}
                    >
                      Changes & Issues {preview ? `(${preview.report.changes.length})` : ""}
                    </button>
                  </div>

                  <div className="flex h-7 w-[220px] items-center gap-1.5 rounded-[5px] border border-rule bg-white px-2">
                    <Filter className="h-3 w-3 text-slate/60" />
                    <input
                      value={gridFilter}
                      onChange={(e) => setGridFilter(e.target.value)}
                      placeholder="Filter rows…"
                      className="h-full w-full bg-transparent text-[11px] text-ink outline-none placeholder:text-slate/55"
                    />
                  </div>
                </div>

                {viewMode === "diff" && preview ? (
                  <div className="space-y-4 p-4 sm:p-5">
                    {preview.report.issues.length > 0 ? (
                      <div className="rounded-[9px] border border-onair/25 bg-onair-soft/50 p-3.5">
                        <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[#9b1b36]">
                          <AlertTriangle className="h-3.5 w-3.5 text-onair" />
                          Flagged Data Issues ({preview.report.issues.length})
                        </p>
                        <ul className="mt-2 space-y-1 text-[11px] text-[#9b1b36]/90">
                          {preview.report.issues.slice(0, 12).map((issue, idx) => (
                            <li key={idx} className="flex items-center gap-2">
                              <span className="rounded bg-white/80 px-1.5 py-0.5 font-mono text-[9px]">Row {issue.rowIndex}</span>
                              <span className="font-medium">{issue.column}:</span>
                              <span>{issue.message}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    <div>
                      <p className="mb-2 text-[11.5px] font-semibold text-ink">
                        Cell-by-cell cleanup diff ({preview.report.changes.length} fixes)
                      </p>
                      {preview.report.changes.length === 0 ? (
                        <div className="flex items-center gap-2 rounded-[8px] border border-verified/25 bg-verified-soft/50 px-4 py-4 text-[11.5px] text-[#0a7f51]">
                          <CheckCircle2 className="h-4 w-4" />
                          Your sheet already looks clean — no messy cell formatting found.
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-[8px] border border-rule">
                          <table className="w-full border-collapse text-left text-[11.5px]">
                            <thead>
                              <tr className="border-b border-rule bg-chalk/60 text-[10px] text-slate">
                                <th className="px-3 py-2 font-medium">Row</th>
                                <th className="px-3 py-2 font-medium">Column</th>
                                <th className="px-3 py-2 font-medium">Before</th>
                                <th className="px-3 py-2 font-medium">After</th>
                                <th className="px-3 py-2 font-medium">Fix applied</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-rule/70 bg-white">
                              {preview.report.changes.map((chg, idx) => (
                                <tr key={idx}>
                                  <td className="px-3 py-2 font-mono text-[10px] text-slate">#{chg.rowIndex}</td>
                                  <td className="px-3 py-2 font-medium text-ink">{chg.column}</td>
                                  <td className="px-3 py-2 font-mono text-[11px] text-[#a61c3a] line-through decoration-[#a61c3a]/40">
                                    {chg.before || "(empty)"}
                                  </td>
                                  <td className="px-3 py-2 font-mono text-[11px] font-medium text-[#0a7f51]">
                                    <span className="inline-flex items-center gap-1">
                                      <ArrowRight className="h-3 w-3 text-slate/60" />
                                      {chg.after}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-[10.5px] text-slate">{chg.reason}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto scroll-thin">
                    <table className="w-full min-w-[780px] border-collapse text-left text-[11.5px]">
                      <thead>
                        <tr className="border-b border-rule bg-chalk/65 text-[10px] font-semibold text-slate">
                          <th className="w-11 border-r border-rule/70 px-2.5 py-2 text-center font-mono">#</th>
                          {headerRow.map((col, idx) => (
                            <th key={`${col}-${idx}`} className="border-r border-rule/50 px-3 py-2 last:border-r-0">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-rule/70 bg-white">
                        {bodyRows.length === 0 ? (
                          <tr>
                            <td colSpan={Math.max(headerRow.length + 1, 2)} className="px-4 py-10 text-center text-[11.5px] text-slate">
                              No rows to display.
                            </td>
                          </tr>
                        ) : (
                          bodyRows.map(({ row, rowNum }) => {
                            const rowIssues = viewMode === "raw" ? issueByRow.get(rowNum) : undefined;
                            const isBlank = row.every((cell) => !cell.trim());
                            return (
                              <tr
                                key={rowNum}
                                className={cn(
                                  "transition hover:bg-chalk/40",
                                  isBlank && "bg-flag-soft/30",
                                  rowIssues && rowIssues.length > 0 && "bg-onair-soft/25",
                                )}
                              >
                                <td className="border-r border-rule/70 px-2 py-2 text-center font-mono text-[9.5px] text-slate">
                                  <div className="flex items-center justify-center gap-1">
                                    <span>{rowNum}</span>
                                    {rowIssues && rowIssues.length > 0 ? (
                                      <span title={rowIssues.join(" · ")}>
                                        <AlertTriangle className="h-3 w-3 text-onair" />
                                      </span>
                                    ) : null}
                                  </div>
                                </td>
                                {headerRow.map((_, cIdx) => {
                                  const cellVal = row[cIdx] ?? "";
                                  const isEditing =
                                    viewMode === "raw" &&
                                    editingCell?.r === rowNum - 1 &&
                                    editingCell?.c === cIdx;
                                  return (
                                    <td
                                      key={cIdx}
                                      onClick={() => {
                                        if (viewMode === "raw" && !isEditing) {
                                          setEditingCell({ r: rowNum - 1, c: cIdx, value: cellVal });
                                        }
                                      }}
                                      className={cn(
                                        "max-w-[260px] border-r border-rule/40 px-3 py-2 align-top last:border-r-0",
                                        viewMode === "raw" && "cursor-pointer",
                                      )}
                                    >
                                      {isEditing ? (
                                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                          <input
                                            autoFocus
                                            value={editingCell.value}
                                            onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                                            onKeyDown={(e) => {
                                              if (e.key === "Enter") void saveCellEdit();
                                              if (e.key === "Escape") setEditingCell(null);
                                            }}
                                            className="h-7 min-w-[120px] flex-1 rounded border border-ink bg-white px-1.5 text-[11.5px] text-ink outline-none"
                                          />
                                          <button
                                            type="button"
                                            disabled={savingCell}
                                            onClick={() => void saveCellEdit()}
                                            className="flex h-7 w-7 items-center justify-center rounded bg-ink text-chalk"
                                            aria-label="Save cell"
                                          >
                                            {savingCell ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                          </button>
                                        </div>
                                      ) : (
                                        <span className={cn("block break-words text-ink/90", !cellVal.trim() && "italic text-slate/40")}>
                                          {cellVal.trim() ? cellVal : "—"}
                                        </span>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>

              <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate">
                <span className="flex items-center gap-1.5">
                  <StatusDot status={connection.connected ? "connected" : "idle"} />
                  {connection.connected ? "Connected to Google Sheets API v4" : "Sample messy dataset — try clicking Preview Clean!"}
                </span>
                <span className="ml-auto">Click any cell in Current Sheet to edit inline · Enter to save.</span>
              </div>
            </>
          ) : (
            <Panel className="px-6 py-16 text-center">
              <FileSpreadsheet className="mx-auto h-7 w-7 text-slate/45" />
              <p className="mt-3 text-[13px] font-medium text-ink">Select or create a Google Sheet</p>
              <p className="mt-1 text-[11px] text-slate">
                Pick a sheet on the left, paste a Google Sheets URL, or ask Vaani to create one.
              </p>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
