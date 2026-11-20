import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { DEMO_COOKIE, GOOGLE_SESSION_COOKIE } from "@/lib/viewer";

export async function POST(request: Request) {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      await supabase.auth.signOut();
    } catch {
      // A failed remote sign-out still clears local access below.
    }
  }
  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.delete(DEMO_COOKIE);
  response.cookies.delete(GOOGLE_SESSION_COOKIE);
  return response;
}
