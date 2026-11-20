import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { RoleTable } from "@/components/roles/role-table";
import { getWorkspace } from "@/lib/data/workspace";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Roles" };

export default async function RolesPage() {
  const workspace = await getWorkspace();
  const open = workspace.roles.filter((role) => role.status === "open").length;
  const totalInterviewed = workspace.roles.reduce((sum, role) => sum + role.interviewed, 0);

  return (
    <div className="mx-auto max-w-[1480px] px-4 py-5 sm:px-6 sm:py-7 xl:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium text-slate">{open} open role · {totalInterviewed} interviews</p>
          <h1 className="mt-1 font-display text-[32px] font-medium leading-none tracking-[-0.04em] text-ink sm:text-[38px]">
            Roles
          </h1>
          <p className="mt-1.5 text-[13px] text-slate">
            Each role pins a playbook version. Edit the playbook once, publish deliberately.
          </p>
        </div>
        <Button variant="primary" size="md" asChild>
          <Link href="/app/onboarding">
            <Plus className="h-3.5 w-3.5" />
            Create a role
          </Link>
        </Button>
      </div>

      <Panel className="mt-6 overflow-hidden">
        <RoleTable roles={workspace.roles} />
      </Panel>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {[
          {
            title: "Playbook pins",
            detail: "A role keeps the playbook version it was published with. Publishing a new version does not silently change open roles.",
          },
          {
            title: "Human stage moves",
            detail: "Dragging a candidate writes an audit event. The model can suggest a route, never move a candidate.",
          },
          {
            title: "No auto-reject",
            detail: "Low scores produce a draft feedback email for approval. A recruiter always owns the outcome.",
          },
        ].map((item) => (
          <div key={item.title} className="border-t border-rule pt-3">
            <p className="text-[11px] font-medium text-ink">{item.title}</p>
            <p className="mt-1 text-[10.5px] leading-relaxed text-slate">{item.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
