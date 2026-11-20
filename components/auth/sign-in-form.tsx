"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Lock, Mail, Play, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        d="M21.6 12.23c0-.71-.06-1.4-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.32 2.98-7.36Z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.7 0 4.96-.89 6.62-2.41l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.81-1.76-5.6-4.12H3.05v2.59A10 10 0 0 0 12 22Z"
        fill="#34A853"
      />
      <path
        d="M6.4 13.92A6 6 0 0 1 6.09 12c0-.67.11-1.32.31-1.92V7.49H3.05A10 10 0 0 0 2 12c0 1.61.39 3.14 1.05 4.51l3.35-2.59Z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.96c1.47 0 2.79.51 3.83 1.5l2.87-2.87A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.95 5.49l3.35 2.59C7.19 7.72 9.4 5.96 12 5.96Z"
        fill="#EA4335"
      />
    </svg>
  );
}

type Mode = "idle" | "google" | "email" | "password" | "sent";

export function SignInForm({
  configured,
  googleEnabled = false,
  next = "/app",
}: {
  configured: boolean;
  googleEnabled?: boolean;
  next?: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<Mode>("idle");
  const [error, setError] = useState<string | null>(null);

  const redirectTo = () => {
    if (typeof window === "undefined") return `/auth/callback?next=${encodeURIComponent(next)}`;
    return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
  };

  const google = async () => {
    setError(null);
    if (!configured) {
      setError("Add your Supabase URL and publishable key to .env to enable Google sign-in.");
      return;
    }
    setMode("google");
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectTo(),
          queryParams: { access_type: "offline", prompt: "consent" },
        },
      });
      if (authError) throw authError;
    } catch (caught) {
      setMode("idle");
      setError(caught instanceof Error ? caught.message : "Google sign-in could not start.");
    }
  };

  const passwordAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!configured) {
      setError("Add your Supabase URL and publishable key to .env to enable sign-in.");
      return;
    }
    if (!email.includes("@")) {
      setError("Enter a work email address.");
      return;
    }
    if (password.length < 8) {
      setError("Use at least 8 characters for the password.");
      return;
    }

    setMode("password");
    try {
      const supabase = createClient();
      if (tab === "signup") {
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name.trim() || email.split("@")[0] },
            emailRedirectTo: redirectTo(),
          },
        });
        if (authError) throw authError;

        if (data.session) {
          router.replace(next);
          router.refresh();
          return;
        }

        if (data.user) {
          // The pilot has no SMTP configured, so confirm the new test account
          // server-side and sign in immediately. Only this fresh user id is
          // accepted by the confirm route.
          const confirm = await fetch("/api/auth/confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: data.user.id }),
          });
          if (!confirm.ok) {
            const detail = (await confirm.json().catch(() => ({}))) as { error?: string };
            throw new Error(detail.error ?? "The account was created but could not be confirmed.");
          }
          const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
          if (signInError) throw signInError;
          router.replace(next);
          router.refresh();
          return;
        }
        throw new Error("The account could not be created.");
      }

      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
      router.replace(next);
      router.refresh();
    } catch (caught) {
      setMode("idle");
      const message = caught instanceof Error ? caught.message : "Sign-in failed.";
      setError(
        message === "Invalid login credentials"
          ? "That email and password do not match. If you are new, create an account."
          : message,
      );
    }
  };

  const magicLink = async () => {
    setError(null);
    if (!configured) {
      setError("Add your Supabase URL and publishable key to .env to enable email sign-in.");
      return;
    }
    if (!email.includes("@")) {
      setError("Enter a work email first.");
      return;
    }
    setMode("email");
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo() },
      });
      if (authError) throw authError;
      setMode("sent");
    } catch (caught) {
      setMode("idle");
      setError(caught instanceof Error ? caught.message : "The sign-in link could not be sent.");
    }
  };

  if (mode === "sent") {
    return (
      <div className="animate-rise">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-verified/25 bg-verified-soft">
          <Mail className="h-4 w-4 text-verified" />
        </div>
        <h1 className="mt-5 font-display text-[34px] font-medium leading-[1.02] tracking-[-0.045em] text-ink sm:text-[40px]">
          Check your inbox.
        </h1>
        <p className="mt-3 max-w-[380px] text-[13.5px] leading-relaxed text-slate">
          We sent a sign-in link to <span className="font-medium text-ink">{email}</span>. It expires in
          10 minutes. If it does not arrive, use a password instead.
        </p>
        <Button variant="outline" size="md" className="mt-6" onClick={() => setMode("idle")}>
          Use a different method
        </Button>
      </div>
    );
  }

  const busy = mode === "password" || mode === "email" || mode === "google";

  return (
    <div className="w-full max-w-[390px]">
      <p className="text-[11px] font-medium tracking-[0.02em] text-slate">Recruiter desk</p>
      <h1 className="mt-2 font-display text-[38px] font-medium leading-[1.02] tracking-[-0.045em] text-ink sm:text-[46px]">
        {tab === "signup" ? "Create your desk." : "Sign in to the desk."}
      </h1>
      <p className="mt-3 text-[13.5px] leading-relaxed text-slate">
        Review evidence, make the call, and keep every decision human-owned.
      </p>

      {googleEnabled ? (
        <>
          <div className="mt-7 space-y-2.5">
            <Button
              variant="outline"
              size="lg"
              className="w-full justify-start bg-white px-4"
              onClick={google}
              disabled={busy}
            >
              {mode === "google" ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleGlyph />}
              Continue with Google
              <ArrowRight className="ml-auto h-3.5 w-3.5 text-slate" />
            </Button>
          </div>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-rule" />
            <span className="text-[10.5px] text-slate">or use email</span>
            <span className="h-px flex-1 bg-rule" />
          </div>
        </>
      ) : (
        <div className="mt-7" />
      )}

      <div className="mb-4 grid grid-cols-2 gap-1 rounded-[7px] border border-rule bg-white/70 p-1">
        {(["signin", "signup"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setTab(value);
              setError(null);
            }}
            className={
              tab === value
                ? "rounded-[5px] bg-ink px-3 py-2 text-[11.5px] font-medium text-chalk"
                : "rounded-[5px] px-3 py-2 text-[11.5px] font-medium text-slate transition hover:text-ink"
            }
          >
            {value === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <form onSubmit={passwordAuth} className="space-y-2.5">
        {tab === "signup" ? (
          <>
            <label htmlFor="name" className="sr-only">
              Full name
            </label>
            <div className="flex h-11 items-center rounded-[7px] border border-rule bg-white px-3 focus-within:border-ink">
              <User className="h-4 w-4 text-slate/70" />
              <input
                id="name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
                className="h-full flex-1 bg-transparent px-2.5 text-[13px] text-ink outline-none placeholder:text-slate/60"
              />
            </div>
          </>
        ) : null}

        <label htmlFor="email" className="sr-only">
          Work email
        </label>
        <div className="flex h-11 items-center rounded-[7px] border border-rule bg-white px-3 focus-within:border-ink">
          <Mail className="h-4 w-4 text-slate/70" />
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
            className="h-full flex-1 bg-transparent px-2.5 text-[13px] text-ink outline-none placeholder:text-slate/60"
          />
        </div>

        <label htmlFor="password" className="sr-only">
          Password
        </label>
        <div className="flex h-11 items-center rounded-[7px] border border-rule bg-white px-3 focus-within:border-ink">
          <Lock className="h-4 w-4 text-slate/70" />
          <input
            id="password"
            type="password"
            autoComplete={tab === "signup" ? "new-password" : "current-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={tab === "signup" ? "Create a password (8+ characters)" : "Password"}
            className="h-full flex-1 bg-transparent px-2.5 text-[13px] text-ink outline-none placeholder:text-slate/60"
          />
        </div>

        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
          {mode === "password" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {tab === "signup" ? "Create account" : "Sign in"}
        </Button>
      </form>

      {error ? (
        <p role="alert" className="mt-3 rounded-[6px] border border-onair/20 bg-onair-soft px-3 py-2 text-[11.5px] leading-relaxed text-[#a61c3a]">
          {error}
        </p>
      ) : null}

      {tab === "signin" ? (
        <button
          type="button"
          onClick={magicLink}
          disabled={busy}
          className="mt-3 w-full text-center text-[11px] text-slate underline-offset-2 transition hover:text-ink hover:underline disabled:opacity-60"
        >
          Email me a sign-in link instead
        </button>
      ) : (
        <p className="mt-3 text-center text-[10.5px] leading-relaxed text-slate">
          New test accounts are confirmed automatically for the pilot. Add your Google Workspace
          after sign-in to send mail and create files.
        </p>
      )}

      <div className="mt-6 border-t border-rule pt-5">
        <a
          href="/api/demo/enter"
          className="group flex items-center justify-between rounded-[8px] border border-ink/10 bg-ink px-4 py-3 transition hover:bg-[#1b2942]"
        >
          <span className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-glow/25 bg-glow/10">
              <Play className="h-3 w-3 fill-glow text-glow" />
            </span>
            <span>
              <span className="block text-[12.5px] font-medium text-chalk">Open the demo workspace</span>
              <span className="mt-0.5 block text-[10.5px] text-mist/55">Seeded data · no account needed</span>
            </span>
          </span>
          <ArrowRight className="h-4 w-4 text-mist/60 transition-transform group-hover:translate-x-0.5" />
        </a>
      </div>

      {!configured ? (
        <p className="mt-4 text-[10.5px] leading-relaxed text-slate">
          Supabase is not configured in this environment. The demo workspace works without it; add
          <span className="mx-1 font-mono text-[10px] text-ink">NEXT_PUBLIC_SUPABASE_URL</span>
          and the publishable key to enable real sign-in.
        </p>
      ) : (
        <p className="mt-4 text-[10.5px] leading-relaxed text-slate">
          By continuing you agree to the pilot terms. When the live interview path is enabled,
          candidate audio is processed by Google Gemini Live; transcript identifiers are redacted
          before scoring.
        </p>
      )}
    </div>
  );
}
