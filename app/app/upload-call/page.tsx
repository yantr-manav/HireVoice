import type { Metadata } from "next";
import { UploadCallConsole } from "@/components/upload-call/upload-call-console";
import { getWorkspace } from "@/lib/data/workspace";

export const metadata: Metadata = {
  title: "Upload Screening Call",
};

export default async function UploadCallPage() {
  const workspace = await getWorkspace();
  return <UploadCallConsole roles={workspace.roles} />;
}
