import type { Metadata } from "next";
import { DriveConsole } from "@/components/drive/drive-console";
import { getWorkspace } from "@/lib/data/workspace";

export const metadata: Metadata = {
  title: "Walk-in Drive Mode",
};

export default async function DrivePage() {
  const workspace = await getWorkspace();
  return <DriveConsole roles={workspace.roles} initialMetrics={workspace.realMetrics} />;
}
