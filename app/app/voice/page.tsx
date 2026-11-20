import type { Metadata } from "next";
import { VoiceConsole } from "@/components/voice/voice-console";
import { getWorkspace } from "@/lib/data/workspace";

export const metadata: Metadata = { title: "Voice" };

export default async function VoicePage() {
  const workspace = await getWorkspace();
  return <VoiceConsole workspace={workspace} />;
}
