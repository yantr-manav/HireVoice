import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Headphones } from "lucide-react";
import { Logo } from "@/components/logo";
import { SignInForm } from "@/components/auth/sign-in-form";
import { VoiceOrb } from "@/components/voice/voice-orb";
import { getViewer } from "@/lib/viewer";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { supabaseCredentials } from "@/lib/supabase/config";
import { googleConfigured } from "@/lib/config";

/** Supabase reports which external providers are enabled for this project. */
async function googleProviderEnabled(): Promise<boolean> {
  const { url, key } = supabaseCredentials();
  if (!url || !key) return false;
  try {
    const response = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: key },
      next: { revalidate: 300 },
    });
    if (!response.ok) return false;
    const settings = (await response.json()) as { external?: { google?: boolean } };
    return Boolean(settings.external?.google);
  } catch {
    return false;
  }
}

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to the Hirevoice recruiter desk.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const viewer = await getViewer();
  // Only redirect real signed-in users; demo visitors must still be able to open /sign-in to log in with Google.
  if (viewer.kind === "user") redirect("/app");

  const params = await searchParams;
  const next = params.next?.startsWith("/") ? params.next : "/app";
  const configured = isSupabaseConfigured();
  const googleEnabled = configured ? await googleProviderEnabled() : false;

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.03fr_0.97fr]">
      <div className="booth-theme relative hidden min-h-dvh overflow-hidden bg-booth lg:flex lg:flex-col">
        <div className="booth-grid pointer-events-none absolute inset-0 opacity-60" />
        <div className="relative z-10 flex h-14 items-center justify-between px-8">
          <Logo href="/" tone="dark" />
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-mist/40">
            Recruiter desk
          </span>
        </div>

        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-10">
          <VoiceOrb size="lg" progress={0.42} label="Vaani" sublabel="Ready" />
          <div className="mt-10 max-w-[400px] text-center">
            <p className="font-display text-[34px] font-medium leading-[1.08] tracking-[-0.04em] text-mist">
              The evidence, not a black box.
            </p>
            <p className="mt-3 text-[13px] leading-relaxed text-mist/55">
              Every skill assessment is tied to a exact transcript moment. Failed quotes are marked
              unverified. A recruiter owns the decision.
            </p>
          </div>
        </div>

        <div className="relative z-10 border-t border-white/10 px-8 py-5">
          <div className="flex items-center justify-between text-[10.5px] text-mist/40">
            <span className="flex items-center gap-2">
              <Headphones className="h-3.5 w-3.5" />
              Built for call-centre teams
            </span>
            <span className="font-mono">asia-south1 · Cloud Run</span>
          </div>
        </div>
      </div>

      <div className="relative flex min-h-dvh flex-col bg-chalk">
        <div className="flex h-14 items-center justify-between px-5 lg:hidden">
          <Logo href="/" />
          <Link href="/" className="flex items-center gap-1.5 text-[11.5px] text-slate">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center px-5 pb-12 pt-6 sm:px-10">
          <SignInForm
            configured={configured}
            googleEnabled={googleEnabled}
            googleDirectEnabled={googleConfigured}
            next={next}
          />
        </div>
        <div className="hidden items-center justify-between border-t border-rule px-6 py-3 text-[10px] text-slate lg:flex">
          <span>© 2026 Hirevoice</span>
          <span className="flex items-center gap-3">
            <Link href="/" className="hover:text-ink">Product</Link>
            <span className="text-rule">·</span>
            <span>Privacy</span>
            <span className="text-rule">·</span>
            <span>Human decisions only</span>
          </span>
        </div>
      </div>
    </div>
  );
}
