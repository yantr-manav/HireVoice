import type { Metadata } from "next";
import { BoothExperience } from "@/components/booth/booth-experience";

export const metadata: Metadata = {
  title: "Practice interview",
  description: "Try a private four-minute voice screen. No account, nothing uploaded.",
};

export default function PracticePage() {
  return <BoothExperience mode="practice" roleTitle="Customer Support Executive" token="practice" />;
}
