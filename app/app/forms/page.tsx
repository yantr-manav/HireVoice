import type { Metadata } from "next";
import { FormsConsole } from "@/components/forms/forms-console";
import { getWorkspace } from "@/lib/data/workspace";

export const metadata: Metadata = { title: "Application Forms" };

export default async function FormsPage() {
  const workspace = await getWorkspace();
  return <FormsConsole workspace={workspace} />;
}
