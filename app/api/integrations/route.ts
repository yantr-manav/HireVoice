import { NextResponse } from "next/server";
import { googleConnection } from "@/lib/google/auth";
import { apiContext, jsonError, jsonOk } from "@/lib/api/http";
import { aiStatus } from "@/lib/ai/keys";
import { storeStatus } from "@/lib/db/repo";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ctx = await apiContext();
    return jsonOk({
      google: await googleConnection(ctx.owner),
      ai: await aiStatus(),
      store: await storeStatus(),
      demo: ctx.demo,
    });
  } catch (error) {
    return jsonError(error);
  }
}
