import type { Metadata } from "next";
import { CrewConsole } from "@/components/crew/crew-console";
import { getWorkspace } from "@/lib/data/workspace";

export const metadata: Metadata = { title: "Crew" };

export default async function CrewPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const initialTab =
    params.tab === "approvals" || params.tab === "runs" || params.tab === "actions" || params.tab === "permissions"
      ? params.tab
      : "crew";
  const workspace = await getWorkspace();
  return <CrewConsole workspace={workspace} initialTab={initialTab} />;
}
