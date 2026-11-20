import type { Metadata } from "next";
import { ReviewQueue } from "@/components/review/review-queue";
import { getWorkspace } from "@/lib/data/workspace";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Review queue" };

export default async function ReviewPage() {
  const workspace = await getWorkspace();
  const initial = workspace.candidates.filter((candidate) => candidate.stage === "in_review");
  return <ReviewQueue initial={initial.length > 0 ? initial : workspace.candidates.slice(0, 3)} />;
}
