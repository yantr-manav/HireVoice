import { NextResponse } from "next/server";
import { getViewer, ownerFor, type Viewer } from "@/lib/viewer";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import {
  GoogleNotConfiguredError,
  GoogleNotConnectedError,
  GoogleReconnectRequiredError,
} from "@/lib/google/auth";
import { GoogleScopeError } from "@/lib/google/services";
import { AiUnavailableError } from "@/lib/ai/gemini";
import { ToolError } from "@/lib/agent/tools";

export type ApiContext = {
  viewer: Viewer;
  owner: string;
  actor: string;
  email: string;
  demo: boolean;
};

export class ApiAuthError extends Error {
  constructor() {
    super("Sign in to use this endpoint.");
    this.name = "ApiAuthError";
  }
}

export async function apiContext(): Promise<ApiContext> {
  const viewer = await getViewer();
  if (viewer.kind === "anon" && isSupabaseConfigured()) throw new ApiAuthError();
  return {
    viewer,
    owner: ownerFor(viewer),
    actor: viewer.name,
    email: viewer.email,
    demo: viewer.kind !== "user",
  };
}

export function jsonOk(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, { ...init, headers: { "Cache-Control": "no-store", ...(init?.headers ?? {}) } });
}

export function jsonError(error: unknown) {
  if (error instanceof ApiAuthError) {
    return NextResponse.json({ error: error.message, code: "unauthorized" }, { status: 401 });
  }
  if (error instanceof GoogleNotConfiguredError) {
    return NextResponse.json({ error: error.message, code: "google_not_configured" }, { status: 409 });
  }
  if (error instanceof GoogleNotConnectedError) {
    return NextResponse.json({ error: error.message, code: "google_not_connected" }, { status: 409 });
  }
  if (error instanceof GoogleReconnectRequiredError) {
    return NextResponse.json({ error: error.message, code: "google_reconnect" }, { status: 401 });
  }
  if (error instanceof GoogleScopeError) {
    return NextResponse.json({ error: error.message, code: "google_scope" }, { status: 403 });
  }
  if (error instanceof ToolError) {
    return NextResponse.json({ error: error.message, code: "tool_error" }, { status: 400 });
  }
  if (error instanceof AiUnavailableError) {
    return NextResponse.json({ error: error.message, code: "ai_unavailable" }, { status: 503 });
  }
  const message = error instanceof Error ? error.message : "Unexpected error";
  const status = message.includes("invalid_grant") || message.includes("invalid_request") ? 401 : 500;
  return NextResponse.json({ error: message, code: status === 401 ? "google_reconnect" : "server_error" }, { status });
}

export async function readJson<T = Record<string, unknown>>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    return {} as T;
  }
}

/**
 * Cookie-authenticated writes must come from the same origin. Requests with no
 * Origin header (curl, server-to-server) are allowed and still require the cookie.
 */
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const allowed = new Set<string>();
  try {
    allowed.add(new URL(request.url).origin);
  } catch {
    /* ignore */
  }
  const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  if (forwardedHost) {
    allowed.add(`${forwardedProto}://${forwardedHost}`);
    allowed.add(`https://${forwardedHost}`);
    allowed.add(`http://${forwardedHost}`);
  }
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    try {
      allowed.add(new URL(process.env.NEXT_PUBLIC_SITE_URL).origin);
    } catch {
      /* ignore */
    }
  }
  if (process.env.VERCEL_URL) {
    allowed.add(`https://${process.env.VERCEL_URL}`);
  }
  if (!allowed.has(origin)) throw new ToolError("This request came from an unexpected origin.");
}
