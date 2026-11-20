import type { Metadata } from "next";
import { BoothExperience } from "@/components/booth/booth-experience";
import { roles } from "@/lib/demo/data";

export const metadata: Metadata = {
  title: "Voice interview",
  description: "A four-minute voice screen. No account needed.",
  robots: { index: false, follow: false },
};

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const isDrive = token.toLowerCase().startsWith("drive");
  const matchedRole = roles.find((r) => token.toLowerCase().includes(r.id.toLowerCase())) ?? roles[0];

  return (
    <BoothExperience
      mode="invite"
      source={isDrive ? "drive" : "invite"}
      roleId={matchedRole?.id ?? "role-support"}
      roleTitle={matchedRole?.title ?? "Customer Support Executive"}
      token={token}
    />
  );
}
