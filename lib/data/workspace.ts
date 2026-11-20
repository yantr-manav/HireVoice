import { cache } from "react";
import { workspace } from "@/lib/demo/data";
import type { Candidate, Connection, FeedItem, Workspace } from "@/lib/types";
import { getViewer, ownerFor, type Viewer } from "@/lib/viewer";
import { isSupabaseConfigured, createClient } from "@/lib/supabase/server";
import { googleConnection } from "@/lib/google/auth";
import { listActions, listAudit, listLatestDecisions, listLiveCandidates } from "@/lib/db/repo";
import { buildWhatsappReminderUrl, evaluateRoleFits } from "@/lib/scoring/verify";

/**
 * Deduplicated per request with React `cache()` so AppLayout + child page share
 * a single workspace load instead of running every DB query twice.
 */
export const getWorkspace = cache(async (): Promise<Workspace> => {
  const viewer = await getViewer();
  return buildWorkspace(viewer);
});

function applyDecisions(
  candidates: Candidate[],
  decisions: Awaited<ReturnType<typeof listLatestDecisions>>,
): Candidate[] {
  return candidates.map((candidate) => {
    const decision = decisions.get(candidate.id);
    const enriched: Candidate = {
      ...candidate,
      roleFits:
        candidate.roleFits ??
        evaluateRoleFits({
          primaryRoleId: candidate.roleId,
          score: candidate.score,
          language: candidate.language,
          logistics: candidate.logistics,
        }),
      commitment: candidate.commitment ?? {
        status: candidate.stage === "scheduled" ? "confirmed" : "pending",
        whatsappUrl: buildWhatsappReminderUrl({
          phone: candidate.phone,
          candidateName: candidate.name,
          roleTitle: candidate.roleTitle,
        }),
      },
    };
    if (!decision) return enriched;
    if (decision.action === "shortlist") return { ...enriched, stage: "shortlisted" as const };
    if (decision.action === "scheduled") return { ...enriched, stage: "scheduled" as const };
    if (decision.action === "review") return { ...enriched, stage: "in_review" as const };
    if (decision.action === "close") return { ...enriched, stage: "closed" as const };
    return enriched;
  });
}

function connectionWithGoogle(
  connection: Connection,
  connected: boolean,
  email: string | null,
): Connection {
  if (connection.service === "slack" || connection.service === "jira") return connection;
  if (connected) {
    return {
      ...connection,
      status: "connected",
      account: email ?? connection.account,
      lastChecked: new Date().toISOString(),
    };
  }
  return {
    ...connection,
    status: "not_connected",
    account: undefined,
    lastChecked: undefined,
  };
}

async function buildWorkspace(viewer: Viewer): Promise<Workspace> {
  const owner = ownerFor(viewer);
  // Run all independent DB/Supabase reads in parallel instead of sequentially.
  const [orgName, google, liveCandidates, decisions, audit, agentActions] = await Promise.all([
    resolveOrgName(viewer),
    googleConnection(owner),
    listLiveCandidates(60),
    listLatestDecisions(),
    listAudit(12),
    listActions(16),
  ]);
  const liveIds = new Set(liveCandidates.map((c) => c.id));
  const mergedRaw = [...liveCandidates, ...workspace.candidates.filter((c) => !liveIds.has(c.id))];
  const candidates = applyDecisions(mergedRaw, decisions);

  // Strictly separate real (non-seeded) metrics for honest buildathon reporting.
  const realLatencies = liveCandidates
    .map((c) => c.latencyMs ?? 0)
    .filter((ms) => ms > 0)
    .sort((a, b) => a - b);
  const medianLatencyMs =
    realLatencies.length > 0 ? realLatencies[Math.floor(realLatencies.length / 2)] : 0;
  const realQuotes = liveCandidates.flatMap((c) => c.score.items.flatMap((i) => i.evidence));
  const realVerifiedQuotes = realQuotes.filter((q) => q.verified).length;

  const allQuotes = candidates.flatMap((c) => c.score.items.flatMap((i) => i.evidence));
  const totalVerified = allQuotes.filter((q) => q.verified).length;
  const metrics = {
    ...workspace.metrics,
    completed: workspace.metrics.completed + liveCandidates.length,
    inReview: candidates.filter((c) => c.stage === "in_review").length,
    shortlisted: candidates.filter((c) => c.stage === "shortlisted").length,
    scheduled: candidates.filter((c) => c.stage === "scheduled").length,
    verifiedQuotes: totalVerified,
    totalQuotes: allQuotes.length,
    medianResultSeconds:
      medianLatencyMs > 0 ? Math.max(1, Math.round(medianLatencyMs / 1000)) : workspace.metrics.medianResultSeconds,
  };
  const realMetrics = {
    completed: liveCandidates.length,
    medianLatencyMs,
    verifiedQuotes: realVerifiedQuotes,
    totalQuotes: realQuotes.length,
    driveCount: liveCandidates.filter((c) => c.source === "drive" || Boolean(c.driveToken)).length,
    uploadedCalls: liveCandidates.filter((c) => c.source === "manual").length,
  };

  const actionFeed: FeedItem[] = audit.slice(0, 6).map((event) => ({
    id: event.id,
    time: event.createdAt,
    agent: event.surface === "voice" ? "Vaani" : event.actor,
    message: `${event.action.replace(/_/g, " ")} · ${event.target ?? event.detail ?? "workspace"}`,
    tone:
      event.action.includes("failed") || event.action.includes("close")
        ? "onair"
        : event.action.includes("verified")
          ? "verified"
          : event.action.includes("sent") || event.action.includes("scheduled")
            ? "verified"
            : "neutral",
  }));

  const updatedRoles = workspace.roles.map((role) => {
    const extra = liveCandidates.filter((c) => c.roleId === role.id);
    if (extra.length === 0) return role;
    return {
      ...role,
      interviewed: role.interviewed + extra.length,
      inReview: role.inReview + extra.filter((c) => c.stage === "in_review").length,
      shortlisted: role.shortlisted + extra.filter((c) => c.stage === "shortlisted").length,
      scheduled: role.scheduled + extra.filter((c) => c.stage === "scheduled").length,
    };
  });

  return {
    ...workspace,
    roles: updatedRoles,
    org: {
      ...workspace.org,
      name: orgName ?? workspace.org.name,
    },
    user: {
      ...workspace.user,
      name: viewer.kind === "demo" ? workspace.user.name : viewer.name,
      email: viewer.kind === "demo" ? workspace.user.email : viewer.email,
      initials: viewer.kind === "demo" ? workspace.user.initials : viewer.initials,
      role: viewer.kind === "demo" ? workspace.user.role : viewer.role,
    },
    candidates,
    connections: workspace.connections.map((connection) => connectionWithGoogle(connection, google.connected, google.email)),
    feed: [...actionFeed, ...workspace.feed],
    agentActions,
    audit,
    google,
    metrics,
    realMetrics,
    isDemo: viewer.kind === "demo",
    sampleData: liveCandidates.length === 0,
  };
}

async function resolveOrgName(viewer: Viewer): Promise<string | null> {
  if (viewer.kind !== "user" || !isSupabaseConfigured()) return null;
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("org_members")
      .select("organizations(name)")
      .eq("user_id", viewer.userId)
      .limit(1)
      .maybeSingle();
    const org = data?.organizations as { name?: string } | null | undefined;
    return org?.name ?? null;
  } catch {
    return null;
  }
}
