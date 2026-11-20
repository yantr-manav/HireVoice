"use client";

import { useState } from "react";
import { ClipboardList, ExternalLink, FileSpreadsheet, FileText, FolderPlus, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/panel";
import type { WorkspaceFile } from "@/lib/types";

type Kind = "sheet" | "folder" | "doc" | "form";

const kinds: { kind: Kind; label: string; icon: typeof FileSpreadsheet }[] = [
  { kind: "sheet", label: "Sheet", icon: FileSpreadsheet },
  { kind: "form", label: "Form", icon: ClipboardList },
  { kind: "folder", label: "Folder", icon: FolderPlus },
  { kind: "doc", label: "Doc", icon: FileText },
];

export function WorkspaceActions({ connected }: { connected: boolean }) {
  const [kind, setKind] = useState<Kind>("sheet");
  const [title, setTitle] = useState("");
  const [header, setHeader] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<WorkspaceFile[]>([]);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) {
      toast.error("Give the file a name.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/google/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, title: title.trim(), header: kind === "sheet" ? header : undefined }),
      });
      const data = (await response.json()) as { file?: WorkspaceFile; error?: string; message?: string };
      if (!response.ok || !data.file) throw new Error(data.error ?? "The file could not be created.");
      setCreated((current) => [data.file!, ...current].slice(0, 4));
      setTitle("");
      setHeader("");
      toast.success(data.message ?? "Created in your Drive", {
        description: data.file.name,
        action: { label: "Open", onClick: () => window.open(data.file!.url, "_blank", "noreferrer") },
      });
    } catch (error) {
      toast.error("Nothing was created", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel className="overflow-hidden">
      <PanelHeader
        title="Create in Workspace"
        meta={connected ? "Real Drive files, created as you" : "Connect Google to enable"}
      />
      <form onSubmit={create} className="space-y-3 p-4">
        <div className="flex flex-wrap gap-1 rounded-[7px] border border-rule bg-chalk/40 p-1">
          {kinds.map((entry) => {
            const Icon = entry.icon;
            return (
              <button
                key={entry.kind}
                type="button"
                onClick={() => setKind(entry.kind)}
                className={
                  kind === entry.kind
                    ? "flex flex-1 items-center justify-center gap-1.5 rounded-[5px] bg-ink px-3 py-2 text-[11px] font-medium text-chalk"
                    : "flex flex-1 items-center justify-center gap-1.5 rounded-[5px] px-3 py-2 text-[11px] font-medium text-slate transition hover:text-ink"
                }
              >
                <Icon className="h-3.5 w-3.5" />
                {entry.label}
              </button>
            );
          })}
        </div>

        <label className="block">
          <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate">Name</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={
              kind === "sheet"
                ? "Hiring for Tele caller"
                : kind === "form"
                  ? "Tele Caller Executive"
                  : kind === "folder"
                    ? "Hiring · Tele caller"
                    : "Interview notes"
            }
            className="mt-1 h-10 w-full rounded-[6px] border border-rule bg-white px-3 text-[12px] text-ink outline-none placeholder:text-slate/50 focus:border-ink"
          />
        </label>

        {kind === "sheet" ? (
          <label className="block">
            <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate">
              Columns <span className="normal-case tracking-normal text-slate/70">(optional)</span>
            </span>
            <input
              value={header}
              onChange={(event) => setHeader(event.target.value)}
              placeholder="Candidate, Role, Stage, Decision, Notes"
              className="mt-1 h-10 w-full rounded-[6px] border border-rule bg-white px-3 text-[12px] text-ink outline-none placeholder:text-slate/50 focus:border-ink"
            />
          </label>
        ) : null}

        <Button type="submit" variant="ink" size="sm" className="w-full" disabled={busy || !connected}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          {connected ? `Create ${kind}` : "Connect Google first"}
        </Button>

        {created.length > 0 ? (
          <div className="space-y-1.5 border-t border-rule pt-3">
            {created.map((file) => (
              <a
                key={file.id}
                href={file.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-[5px] border border-rule bg-white px-2.5 py-2 text-[10.5px] text-ink transition hover:border-slate/40"
              >
                <span className="min-w-0 flex-1 truncate">{file.name}</span>
                <span className="font-mono text-[8.5px] uppercase text-slate">{file.kind}</span>
                <ExternalLink className="h-3 w-3 text-slate" />
              </a>
            ))}
          </div>
        ) : null}
      </form>
    </Panel>
  );
}
