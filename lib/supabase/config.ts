/**
 * Shared Supabase settings. Kept free of next/headers so the proxy (Next 16
 * middleware) can import it without pulling in server-component APIs.
 */
export function supabaseCredentials() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY;
  return { url, key };
}

export function isSupabaseConfigured() {
  const { url, key } = supabaseCredentials();
  return Boolean(url && key);
}
