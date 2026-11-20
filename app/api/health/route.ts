import { NextResponse } from "next/server";
import { storeStatus } from "@/lib/db/repo";
import { aiConfigured } from "@/lib/ai/keys";

export const dynamic = "force-dynamic";

export async function GET() {
  const store = await storeStatus();
  return NextResponse.json(
    {
      ok: true,
      service: "hirevoice",
      runtime: process.env.VERCEL ? "vercel" : process.env.K_SERVICE ? "cloud-run" : "local",
      region: process.env.VERCEL_REGION || process.env.CLOUD_RUN_REGION || "asia-south1",
      store: store.active,
      aiConfigured: aiConfigured(),
      timestamp: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
