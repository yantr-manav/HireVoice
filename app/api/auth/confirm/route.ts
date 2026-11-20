import { NextResponse } from "next/server";
import { assertSameOrigin, jsonError, readJson } from "@/lib/api/http";
import { supabaseCredentials } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

/**
 * Confirms a freshly created test account without requiring SMTP.
 *
 * The pilot project has email confirmation enabled but no custom mail server,
 * so a new tester would otherwise be stuck waiting for a message. The client
 * calls this with the user id returned by its own signUp response; the id is a
 * random UUID and is never exposed to other users. Existing (already confirmed)
 * accounts are left untouched.
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { userId } = await readJson<{ userId?: string }>(request);
    if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) {
      return NextResponse.json({ error: "A valid new user id is required." }, { status: 400 });
    }

    const { url } = supabaseCredentials();
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      return NextResponse.json(
        { error: "Account confirmation is not configured on this server." },
        { status: 503 },
      );
    }

    const response = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
      method: "PUT",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email_confirm: true }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json(
        { error: `The account could not be confirmed (${response.status}). ${detail.slice(0, 160)}` },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}
