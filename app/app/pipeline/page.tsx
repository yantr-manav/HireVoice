import type { Metadata } from "next";
import { PipelineBoard } from "@/components/pipeline/pipeline-board";
import { getWorkspace } from "@/lib/data/workspace";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pipeline" };

export default async function PipelinePage() {
  const workspace = await getWorkspace();
  return <PipelineBoard workspace={workspace} />;
}
