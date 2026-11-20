import { NextResponse } from "next/server";
import { google } from "googleapis";
import { googleConfigured, googleOAuth } from "@/lib/config";
import { encrypt } from "@/lib/crypto";
import { DEMO_COOKIE, GOOGLE_SESSION_COOKIE } from "@/lib/viewer";
import { writeAudit } from "@/lib/db/repo";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "hv_google_login_state";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const rawState = url.searchParams.get("state") || "";
  const [stateToken, encodedNext] = rawState.split(":", 2);
  const decodedNext = encodedNext ? decodeURIComponent(encodedNext) : "/app";
  const next = decodedNext.startsWith("/") ? decodedNext : "/app";

  const origin =
    request.headers.get("x-forwarded-host")
      ? `${request.headers.get("x-forwarded-proto") || "https"}://${request.headers.get("x-forwarded-host")}`
      : url.origin;

  if (!googleConfigured || !code) {
    return NextResponse.redirect(new URL("/sign-in?error=google_auth_failed", origin));
  }

  const cookieHeader = request.headers.get("cookie") || "";
  const stateMatch = cookieHeader.match(new RegExp(`(?:^|;\\s*)${STATE_COOKIE}=([^;]+)`));
  const expectedState = stateMatch?.[1] ?? "";
  if (!expectedState || expectedState !== stateToken) {
    return NextResponse.redirect(new URL("/sign-in?error=google_state_mismatch", origin));
  }

  try {
    const callbackUrl = `${origin}/api/auth/google/callback`;
    const client = new google.auth.OAuth2(googleOAuth.clientId, googleOAuth.clientSecret, callbackUrl);
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const { data: profile } = await oauth2.userinfo.get();
    const email = profile.email ?? "";
    const name = profile.name ?? (email.split("@")[0] || "Recruiter");
    const userId = `google_${profile.id || email}`;

    const sealed = encrypt(
      JSON.stringify({
        userId,
        name,
        email,
        exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
      }),
    );

    await writeAudit({
      actor: name,
      action: "google_sign_in",
      target: email,
      detail: "Signed in via Google OAuth",
      surface: "workspace",
    });

    const response = NextResponse.redirect(new URL(next, origin));
    response.cookies.set(GOOGLE_SESSION_COOKIE, sealed, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });
    response.cookies.delete(DEMO_COOKIE);
    response.cookies.delete(STATE_COOKIE);
    return response;
  } catch {
    return NextResponse.redirect(new URL("/sign-in?error=google_callback_failed", origin));
  }
}
