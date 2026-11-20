import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { supabaseCredentials } from "@/lib/supabase/config";

export { isSupabaseConfigured, supabaseCredentials } from "@/lib/supabase/config";

export async function createClient() {
  const cookieStore = await cookies();
  const { url, key } = supabaseCredentials();
  if (!url || !key) {
    throw new Error("Supabase is not configured");
  }

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot write cookies. The callback route and actions can.
        }
      },
    },
  });
}

export function createServiceClient() {
  const { url } = supabaseCredentials();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
