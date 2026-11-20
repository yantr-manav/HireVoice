import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, CircleAlert, FileText, Plus, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { getWorkspace } from "@/lib/data/workspace";
import { formatRelative } from "@/lib/utils";

export const metadata: Metadata = { title: "Playbooks" };

export default async function PlaybooksPage() {
  const workspace = await getWorkspace();
  const published = workspace.playbooks.filter((playbook) => playbook.status === "published").length;

  return (
    <div className="mx-auto max-w-[1480px] px-4 py-5 sm:px-6 sm:py-7 xl:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium text-slate">
            {published} published · {workspace.playbooks.length - published} draft
          </p>
          <h1 className="mt-1 font-display text-[32px] font-medium leading-none tracking-[-0.04em] text-ink sm:text-[38px]">
            Playbooks
          </h1>
          <p className="mt-1.5 max-w-[560px] text-[13px] leading-relaxed text-slate">
            A playbook is the role&apos;s interview script, scoring rubric and decision rules in one
            reviewable file. Editing never changes an open role until you publish.
          </p>
        </div>
        <Button variant="primary" size="md" asChild>
          <Link href="/app/onboarding">
            <Plus className="h-3.5 w-3.5" />
            New playbook
          </Link>
        </Button>
      </div>

      <div className="mt-6 grid gap-3 lg:grid-cols-3">
        {workspace.playbooks.map((playbook) => {
          const candidates = workspace.candidates.filter((candidate) => candidate.roleTitle === playbook.roleTitle);
          return (
            <Link
              key={playbook.id}
              href={`/app/playbooks/${playbook.id}`}
              className="group flex flex-col rounded-[10px] border border-rule bg-paper p-4 transition hover:border-slate/40 hover:shadow-[0_10px_30px_-24px_rgba(11,16,48,0.5)]"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-[6px] border border-rule bg-chalk/60">
                  <FileText className="h-4 w-4 text-slate" strokeWidth={1.7} />
                </span>
                <Badge tone={playbook.status === "published" ? "verified" : "flag"} dot>
                  {playbook.status === "published" ? "Published" : "Draft"}
                </Badge>
              </div>
              <h2 className="mt-3 font-display text-[20px] font-medium leading-tight tracking-[-0.03em] text-ink">
                {playbook.name}
              </h2>
              <p className="mt-0.5 text-[11px] text-slate">{playbook.roleTitle}</p>

              <dl className="mt-3 grid grid-cols-3 gap-1.5 border-y border-rule/80 py-2">
                <div>
                  <dt className="text-[9px] text-slate">Version</dt>
                  <dd className="mt-0.5 font-mono text-[11px] text-ink">v{playbook.version}</dd>
                </div>
                <div>
                  <dt className="text-[9px] text-slate">Skills</dt>
                  <dd className="mt-0.5 font-mono text-[11px] text-ink">4</dd>
                </div>
                <div>
                  <dt className="text-[9px] text-slate">Interviews</dt>
                  <dd className="mt-0.5 font-mono text-[11px] text-ink">{candidates.length}</dd>
                </div>
              </dl>

              {playbook.warnings.length > 0 ? (
                <p className="mt-2 flex items-start gap-1.5 text-[9.5px] leading-relaxed text-[#8e6a00]">
                  <CircleAlert className="mt-0.5 h-3 w-3 shrink-0" />
                  {playbook.warnings[0].message}
                </p>
              ) : (
                <p className="mt-2 flex items-center gap-1.5 text-[9.5px] text-slate">
                  <ShieldCheck className="h-3 w-3 text-verified" />
                  Compiles clean. Never auto-rejects.
                </p>
              )}

              <div className="mt-auto flex items-center justify-between pt-3 text-[9.5px] text-slate">
                <span>
                  {playbook.updatedBy} · {formatRelative(playbook.updatedAt)}
                </span>
                <span className="inline-flex items-center gap-1 font-medium text-ultramarine">
                  Open Studio
                  <ArrowUpRight className="h-3 w-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      <Panel className="mt-4 overflow-hidden">
        <PanelHeader title="How publishing works" meta="same rules for every role" />
        <div className="grid gap-0 divide-y divide-rule sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[
            {
              title: "1 · Edit with a diff",
              body: "Changes are shown against the published version. Compile checks thresholds, weights and allowed actions.",
            },
            {
              title: "2 · Simulate on stored scores",
              body: "Replay existing interviews through the new rule. No model calls, no candidate contact, no surprises.",
            },
            {
              title: "3 · Publish deliberately",
              body: "A new version is created. Open roles stay pinned until someone republishes the role with intent.",
            },
          ].map((step) => (
            <div key={step.title} className="px-4 py-3.5">
              <p className="text-[11px] font-medium text-ink">{step.title}</p>
              <p className="mt-1 text-[10.5px] leading-relaxed text-slate">{step.body}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
