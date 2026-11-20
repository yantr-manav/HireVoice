import type { Metadata } from "next";
import { CalendarConsole } from "@/components/calendar/calendar-console";
import { getWorkspace } from "@/lib/data/workspace";

export const metadata: Metadata = { title: "Calendar" };

export default async function CalendarPage() {
  const workspace = await getWorkspace();
  return <CalendarConsole workspace={workspace} />;
}
