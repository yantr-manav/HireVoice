import type { Metadata } from "next";
import { ConnectionsConsole } from "@/components/connections/connections-console";
import { getWorkspace } from "@/lib/data/workspace";

export const metadata: Metadata = { title: "Connections" };

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string; reason?: string }>;
}) {
  const [workspace, params] = await Promise.all([getWorkspace(), searchParams]);
  return (
    <ConnectionsConsole
      workspace={workspace}
      googleResult={params.google}
      googleReason={params.reason}
    />
  );
}
