import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CandidateReview } from "@/components/candidate/candidate-review";
import { getWorkspace } from "@/lib/data/workspace";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ candidateId: string }>;
}): Promise<Metadata> {
  const { candidateId } = await params;
  const workspace = await getWorkspace();
  const candidate = workspace.candidates.find((item) => item.id === candidateId);
  return { title: candidate ? `${candidate.name} · evidence` : "Candidate" };
}

export default async function CandidateDetailPage({
  params,
}: {
  params: Promise<{ roleId: string; candidateId: string }>;
}) {
  const { roleId, candidateId } = await params;
  const workspace = await getWorkspace();
  const candidate = workspace.candidates.find((item) => item.id === candidateId);
  if (!candidate) notFound();
  const role = workspace.roles.find((item) => item.id === roleId);
  if (!role) notFound();

  return <CandidateReview candidate={candidate} />;
}
