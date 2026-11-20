import type { Metadata } from "next";
import { MailConsole } from "@/components/mail/mail-console";
import { getWorkspace } from "@/lib/data/workspace";

export const metadata: Metadata = { title: "Mail" };

export default async function MailPage({
  searchParams,
}: {
  searchParams: Promise<{ to?: string; candidateId?: string; compose?: string; connected?: string }>;
}) {
  const params = await searchParams;
  const workspace = await getWorkspace();
  return (
    <MailConsole
      workspace={workspace}
      initialTo={params.to}
      initialCandidateId={params.candidateId}
      initialCompose={params.compose === "1" || Boolean(params.to)}
    />
  );
}
