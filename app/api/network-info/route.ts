import os from "node:os";
import { NextResponse } from "next/server";
import { siteUrl } from "@/lib/config";

export const dynamic = "force-dynamic";

function detectLanIp(): string | null {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    const entries = nets[name] ?? [];
    for (const net of entries) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return null;
}

/**
 * Returns the configured siteUrl and the laptop's local Wi-Fi IPv4 address so
 * invite links and QR codes work on localhost, same Wi-Fi, or a public HTTPS tunnel.
 */
export async function GET() {
  const lanIp = detectLanIp();
  const port = process.env.PORT || "3000";
  return NextResponse.json(
    {
      siteUrl,
      lanUrl: lanIp ? `http://${lanIp}:${port}` : null,
      lanIp,
      port,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
