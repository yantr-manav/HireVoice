import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { google } from "googleapis";
import { googleConfigured, googleOAuth } from "@/lib/config";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "hv_google_login_state";

/**
 * Starts a direct Google Sign-In (OpenID Connect: email + profile) flow using
 * GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET so recruiters can sign in with Google
 * even when Supabase's external Google provider is not toggled on.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const nextParam = url.searchParams.get("next");
  const next = nextParam?.startsWith("/") ? nextParam : "/app";

  if (!googleConfigured) {
    return NextResponse.redirect(new URL("/sign-in?error=google_not_configured", url.origin));
  }

  const origin =
    request.headers.get("x-forwarded-host")
      ? `${request.headers.get("x-forwarded-proto") || "https"}://${request.headers.get("x-forwarded-host")}`
      : url.origin;
  const callbackUrl = `${origin}/api/auth/google/callback`;

  const state = crypto.randomBytes(16).toString("hex");
  const client = new google.auth.OAuth2(googleOAuth.clientId, googleOAuth.clientSecret, callbackUrl);
  const authUrl = client.generateAuthUrl({
    access_type: "online",
    scope: ["openid", "email", "profile"],
    prompt: "select_account",
    state: `${state}:${encodeURIComponent(next)}`,
  });

  const response = NextResponse.redirect(authUrl);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return response;
}
