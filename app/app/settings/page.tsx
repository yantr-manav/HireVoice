import type { Metadata } from "next";
import { SettingsConsole } from "@/components/settings/settings-console";
import { getWorkspace } from "@/lib/data/workspace";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const workspace = await getWorkspace();
  return <SettingsConsole workspace={workspace} />;
}
