import { cache } from "react";
import { cookies } from "next/headers";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { initials } from "@/lib/utils";

export const DEMO_COOKIE = "hv_demo";

export type Viewer =
  | {
      kind: "demo";
      userId: null;
      name: string;
      email: string;
      initials: string;
      role: string;
    }
  | {
      kind: "user";
      userId: string;
      name: string;
      email: string;
      initials: string;
      role: string;
    }
  | {
      kind: "anon";
      userId: null;
      name: string;
      email: string;
      initials: string;
      role: string;
    };

const demoProfile = {
  name: "Meera Raghavan",
  email: "meera@northstar.example",
  initials: "MR",
  role: "Talent lead",
};

export const getViewer = cache(async (): Promise<Viewer> => {
  const cookieStore = await cookies();
  if (cookieStore.get(DEMO_COOKIE)?.value === "1") {
    return { kind: "demo", userId: null, ...demoProfile };
  }

  if (!isSupabaseConfigured()) {
    return { kind: "anon", userId: null, ...demoProfile };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { kind: "anon", userId: null, ...demoProfile };

    const name =
      (user.user_metadata?.full_name as string | undefined) ??
      (user.user_metadata?.name as string | undefined) ??
      user.email?.split("@")[0] ??
      "Recruiter";

    return {
      kind: "user",
      userId: user.id,
      name,
      email: user.email ?? "",
      initials: initials(name),
      role: "Recruiter",
    };
  } catch {
    return { kind: "anon", userId: null, ...demoProfile };
  }
});

export async function requireViewer() {
  const viewer = await getViewer();
  if (viewer.kind === "anon") return null;
  return viewer;
}

/** Connector + agent data is scoped to the signed-in user, or the demo owner. */
export function ownerFor(viewer: Viewer): string {
  return viewer.kind === "user" ? viewer.userId : "demo";
}
