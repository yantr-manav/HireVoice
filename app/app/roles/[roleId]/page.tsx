import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RoleWorkspace } from "@/components/roles/role-workspace";
import { findPlaybook } from "@/lib/demo/data";
import { getWorkspace } from "@/lib/data/workspace";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ roleId: string }> }): Promise<Metadata> {
  const { roleId } = await params;
  const workspace = await getWorkspace();
  const role = workspace.roles.find((item) => item.id === roleId);
  return { title: role ? role.title : "Role" };
}

export default async function RoleDetailPage({ params }: { params: Promise<{ roleId: string }> }) {
  const { roleId } = await params;
  const workspace = await getWorkspace();
  const role = workspace.roles.find((item) => item.id === roleId);
  if (!role) notFound();

  const playbook = findPlaybook(role.playbookId);
  const candidates = workspace.candidates.filter((item) => item.roleId === role.id);

  return <RoleWorkspace role={role} candidates={candidates} playbook={playbook} />;
}
