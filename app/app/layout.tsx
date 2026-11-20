import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DeskShell } from "@/components/desk/desk-shell";
import { getViewer } from "@/lib/viewer";
import { getWorkspace } from "@/lib/data/workspace";

export const metadata: Metadata = {
  title: "Home",
  description: "Hirevoice recruiter command centre.",
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (viewer.kind === "anon") redirect("/sign-in?next=/app");

  const workspace = await getWorkspace();
  return <DeskShell workspace={workspace}>{children}</DeskShell>;
}
