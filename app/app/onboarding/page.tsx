import type { Metadata } from "next";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { getWorkspace } from "@/lib/data/workspace";

export const metadata: Metadata = { title: "Create a role" };

export default async function OnboardingPage() {
  const workspace = await getWorkspace();
  return <OnboardingWizard workspace={workspace} />;
}
