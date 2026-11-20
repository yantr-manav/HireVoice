import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlaybookStudio } from "@/components/playbooks/playbook-studio";
import { getWorkspace } from "@/lib/data/workspace";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ playbookId: string }>;
}): Promise<Metadata> {
  const { playbookId } = await params;
  const workspace = await getWorkspace();
  const playbook = workspace.playbooks.find((item) => item.id === playbookId);
  return { title: playbook ? playbook.name : "Playbook" };
}

export default async function PlaybookDetailPage({
  params,
}: {
  params: Promise<{ playbookId: string }>;
}) {
  const { playbookId } = await params;
  const workspace = await getWorkspace();
  const playbook = workspace.playbooks.find((item) => item.id === playbookId);
  if (!playbook) notFound();

  const candidates = workspace.candidates.filter((candidate) => candidate.roleTitle === playbook.roleTitle);

  return <PlaybookStudio playbook={playbook} candidates={candidates} />;
}
