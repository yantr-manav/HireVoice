import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildConsentUrl } from "@/lib/google/auth";
import { apiContext } from "@/lib/api/http";
import { siteUrl } from "@/lib/config";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "hv_google_state";

export async function GET(request: Request) {
  try {
    await apiContext();
    const url = new URL(request.url);
    const nextParam = url.searchParams.get("next") ?? "/app/mail?connected=1";
    const next = nextParam.startsWith("/") ? nextParam : "/app/mail?connected=1";
    const state = crypto.randomBytes(24).toString("hex");

    const cookieStore = await cookies();
    cookieStore.set(STATE_COOKIE, `${state}|${next}`, {
      httpOnly: true,
      sameSite: "lax",
      secure: siteUrl.startsWith("https://"),
      path: "/",
      maxAge: 600,
    });

    return NextResponse.redirect(buildConsentUrl(state));
  } catch (error) {
    const target = new URL("/app/connections", siteUrl);
    target.searchParams.set("google", "error");
    target.searchParams.set("reason", error instanceof Error ? error.message : "Could not start Google sign-in");
    return NextResponse.redirect(target);
  }
}
