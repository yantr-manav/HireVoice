import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { exchangeCode, saveGoogleAccount } from "@/lib/google/auth";
import { apiContext } from "@/lib/api/http";
import { siteUrl } from "@/lib/config";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "hv_google_state";

function back(params: Record<string, string>) {
  const target = new URL("/app/connections", siteUrl);
  for (const [key, value] of Object.entries(params)) target.searchParams.set(key, value);
  return NextResponse.redirect(target);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const cookieStore = await cookies();
  const stored = cookieStore.get(STATE_COOKIE)?.value ?? "";
  cookieStore.delete(STATE_COOKIE);

  const googleError = url.searchParams.get("error");
  if (googleError) {
    return back({ google: "error", reason: url.searchParams.get("error_description") ?? googleError });
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return back({ google: "error", reason: "Google did not return a code." });

  const [expectedState, nextPath] = stored.split("|");
  if (!expectedState || expectedState !== state) {
    return back({ google: "error", reason: "The sign-in state did not match. Please try again." });
  }

  try {
    const ctx = await apiContext();
    const { tokens, email, scopes } = await exchangeCode(code);
    await saveGoogleAccount(ctx.owner, tokens, email, scopes);
    const next = nextPath && nextPath.startsWith("/") ? nextPath : "/app/mail?connected=1";
    const target = new URL(next, siteUrl);
    target.searchParams.set("connected", "1");
    return NextResponse.redirect(target);
  } catch (error) {
    return back({
      google: "error",
      reason: error instanceof Error ? error.message : "Could not exchange the Google code.",
    });
  }
}
