import type { Metadata } from "next";
import { OfferGenerator } from "@/components/offer/offer-generator";
import { getWorkspace } from "@/lib/data/workspace";

export const metadata: Metadata = { title: "Offer Letter Studio" };

export default async function OfferPage({
  searchParams,
}: {
  searchParams: Promise<{ candidateId?: string; name?: string; email?: string }>;
}) {
  const params = await searchParams;
  const workspace = await getWorkspace();
  return (
    <OfferGenerator
      workspace={workspace}
      initialCandidateId={params.candidateId}
      initialName={params.name}
      initialEmail={params.email}
    />
  );
}
