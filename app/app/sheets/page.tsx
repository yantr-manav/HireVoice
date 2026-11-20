import type { Metadata } from "next";
import { SheetsConsole } from "@/components/sheets/sheets-console";
import { getWorkspace } from "@/lib/data/workspace";

export const metadata: Metadata = { title: "Sheets Studio" };

export default async function SheetsPage() {
  const workspace = await getWorkspace();
  return <SheetsConsole workspace={workspace} />;
}
