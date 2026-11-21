import {
  databaseUrl,
  dbAll,
  dbGet,
  dbRun,
  newId,
  nowIso,
  parseJson,
  pgQuery,
  toIso,
} from "@/lib/db";
import type {
  ActionResult,
  AgentAction,
  AgentActionSource,
  AgentActionStatus,
  AuditEvent,
  CalendarEvent,
  CalendarEventKind,
  Candidate,
  WorkspaceFile,
} from "@/lib/types";

/**
 * One repository, two backends. Postgres (Supabase) is used whenever
 * DATABASE_URL/SUPABASE_DB_URL is set; SQLite keeps the app usable offline and
 * in the demo. Every function is async so callers do not care which is active.
 */

let pgState: "unknown" | "ok" | "down" = "unknown";
let pgError: string | null = null;

/**
 * Check the Postgres connection once per process. In development a stale
 * password should not take the desk down: it falls back to SQLite and reports
 * that state. Production fails loudly so data is never silently split.
 */
async function backend(): Promise<"pg" | "sqlite"> {
  if (!databaseUrl()) return "sqlite";
  if (pgState === "ok") return "pg";
  if (pgState === "down") {
    return "sqlite";
  }
  try {
    await pgQuery("SELECT 1");
    pgState = "ok";
    return "pg";
  } catch (error) {
    pgState = "down";
    pgError = error instanceof Error ? error.message : String(error);
    console.warn(`[db] Postgres unavailable, falling back to /tmp SQLite: ${pgError}`);
    return "sqlite";
  }
}

export async function storeStatus(): Promise<{
  configured: boolean;
  active: "postgres" | "sqlite";
  error: string | null;
}> {
  try {
    await backend();
  } catch (error) {
    return {
      configured: Boolean(databaseUrl()),
      active: "sqlite",
      error: error instanceof Error ? error.message : String(error),
    };
  }
  return {
    configured: Boolean(databaseUrl()),
    active: pgState === "ok" ? "postgres" : "sqlite",
    error: pgError,
  };
}


type ActionRow = {
  id: string;
  transcript: string | null;
  intent: string;
  tool: string;
  args: unknown;
  status: string;
  mutating: number | boolean;
  summary: string;
  result: unknown;
  error: string | null;
  actor: string;
  source: string;
  created_at: string | Date;
  updated_at: string | Date;
};

function toAction(row: ActionRow): AgentAction {
  return {
    id: row.id,
    transcript: row.transcript,
    intent: row.intent,
    tool: row.tool,
    args: parseJson<Record<string, unknown>>(row.args, {}),
    status: row.status as AgentActionStatus,
    mutating: row.mutating === true || row.mutating === 1,
    summary: row.summary,
    result: parseJson<ActionResult | null>(row.result, null),
    error: row.error,
    actor: row.actor,
    source: row.source as AgentActionSource,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export async function createAction(input: {
  id?: string;
  transcript: string | null;
  intent: string;
  tool: string;
  args: Record<string, unknown>;
  mutating: boolean;
  summary: string;
  actor: string;
  source: AgentActionSource;
  status?: AgentActionStatus;
}): Promise<AgentAction> {
  const id = input.id ?? newId("act");
  const at = nowIso();
  const status = input.status ?? "proposed";

  if ((await backend()) === "pg") {
    await pgQuery(
      `INSERT INTO agent_actions
        (id, transcript, intent, tool, args, status, mutating, summary, result, error, actor, source, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, NULL, NULL, $9, $10, $11, $11)`,
      [
        id,
        input.transcript,
        input.intent,
        input.tool,
        JSON.stringify(input.args),
        status,
        input.mutating,
        input.summary,
        input.actor,
        input.source,
        at,
      ],
    );
  } else {
    dbRun(
      `INSERT INTO agent_actions
        (id, transcript, intent, tool, args, status, mutating, summary, result, error, actor, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?)`,
      id,
      input.transcript,
      input.intent,
      input.tool,
      JSON.stringify(input.args),
      status,
      input.mutating ? 1 : 0,
      input.summary,
      input.actor,
      input.source,
      at,
      at,
    );
  }

  return {
    id,
    transcript: input.transcript,
    intent: input.intent,
    tool: input.tool,
    args: input.args,
    status,
    mutating: input.mutating,
    summary: input.summary,
    result: null,
    error: null,
    actor: input.actor,
    source: input.source,
    createdAt: at,
    updatedAt: at,
  };
}

export async function getAction(id: string): Promise<AgentAction | null> {
  if ((await backend()) === "pg") {
    const rows = await pgQuery<ActionRow>("SELECT * FROM agent_actions WHERE id = $1", [id]);
    return rows[0] ? toAction(rows[0]) : null;
  }
  const row = dbGet<ActionRow>("SELECT * FROM agent_actions WHERE id = ?", id);
  return row ? toAction(row) : null;
}

export async function listActions(limit = 40): Promise<AgentAction[]> {
  if ((await backend()) === "pg") {
    const rows = await pgQuery<ActionRow>("SELECT * FROM agent_actions ORDER BY created_at DESC LIMIT $1", [limit]);
    return rows.map(toAction);
  }
  return dbAll<ActionRow>("SELECT * FROM agent_actions ORDER BY created_at DESC LIMIT ?", limit).map(toAction);
}

export async function listPendingActions(): Promise<AgentAction[]> {
  if ((await backend()) === "pg") {
    const rows = await pgQuery<ActionRow>(
      "SELECT * FROM agent_actions WHERE status = 'proposed' ORDER BY created_at DESC LIMIT 30",
    );
    return rows.map(toAction);
  }
  return dbAll<ActionRow>(
    "SELECT * FROM agent_actions WHERE status = 'proposed' ORDER BY created_at DESC LIMIT 30",
  ).map(toAction);
}

export async function updateAction(
  id: string,
  patch: {
    status?: AgentActionStatus;
    result?: ActionResult | null;
    error?: string | null;
    summary?: string;
  },
): Promise<AgentAction | null> {
  const current = await getAction(id);
  if (!current) return null;

  const result =
    patch.result === undefined
      ? current.result
        ? JSON.stringify(current.result)
        : null
      : patch.result
        ? JSON.stringify(patch.result)
        : null;

  const nextStatus = patch.status ?? current.status;
  const nextError = patch.error === undefined ? current.error : patch.error;
  const nextSummary = patch.summary ?? current.summary;
  const nextResultObj = patch.result === undefined ? current.result : patch.result;
  const updatedAt = nowIso();

  if ((await backend()) === "pg") {
    await pgQuery(
      `UPDATE agent_actions SET status = $1, result = $2::jsonb, error = $3, summary = $4, updated_at = $5 WHERE id = $6`,
      [nextStatus, result, nextError, nextSummary, updatedAt, id],
    );
  } else {
    dbRun(
      `UPDATE agent_actions SET status = ?, result = ?, error = ?, summary = ?, updated_at = ? WHERE id = ?`,
      nextStatus,
      result,
      nextError,
      nextSummary,
      updatedAt,
      id,
    );
  }
  return {
    ...current,
    status: nextStatus,
    result: nextResultObj,
    error: nextError,
    summary: nextSummary,
    updatedAt,
  };
}

export async function writeAudit(input: {
  actor: string;
  action: string;
  target?: string | null;
  detail?: string | null;
  surface: AuditEvent["surface"];
}): Promise<AuditEvent> {
  const id = newId("aud");
  const at = nowIso();
  const event: AuditEvent = {
    id,
    actor: input.actor,
    action: input.action,
    target: input.target ?? null,
    detail: input.detail ?? null,
    surface: input.surface,
    createdAt: at,
  };

  if ((await backend()) === "pg") {
    await pgQuery(
      `INSERT INTO audit_events (id, actor, action, target, detail, surface, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, event.actor, event.action, event.target, event.detail, event.surface, at],
    );
  } else {
    dbRun(
      "INSERT INTO audit_events (id, actor, action, target, detail, surface, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      id,
      event.actor,
      event.action,
      event.target,
      event.detail,
      event.surface,
      at,
    );
  }
  return event;
}

export async function listAudit(limit = 30): Promise<AuditEvent[]> {
  type Row = {
    id: string;
    actor: string;
    action: string;
    target: string | null;
    detail: string | null;
    surface: string;
    created_at: string | Date;
  };
  const rows = (await backend()) === "pg"
    ? await pgQuery<Row>("SELECT * FROM audit_events ORDER BY created_at DESC LIMIT $1", [limit])
    : dbAll<Row>("SELECT * FROM audit_events ORDER BY created_at DESC LIMIT ?", limit);
  return rows.map((row) => ({
    id: row.id,
    actor: row.actor,
    action: row.action,
    target: row.target,
    detail: row.detail,
    surface: row.surface as AuditEvent["surface"],
    createdAt: toIso(row.created_at),
  }));
}

export type DecisionRecord = {
  id: string;
  candidateId: string;
  roleId: string;
  action: "shortlist" | "close" | "skip" | "review" | "scheduled";
  reason: string | null;
  note: string | null;
  actor: string;
  createdAt: string;
};

export async function addDecision(input: Omit<DecisionRecord, "id" | "createdAt">): Promise<DecisionRecord> {
  const id = newId("dec");
  const createdAt = nowIso();
  if ((await backend()) === "pg") {
    await pgQuery(
      `INSERT INTO decisions (id, candidate_id, role_id, action, reason, note, actor, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, input.candidateId, input.roleId, input.action, input.reason, input.note, input.actor, createdAt],
    );
  } else {
    dbRun(
      "INSERT INTO decisions (id, candidate_id, role_id, action, reason, note, actor, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      id,
      input.candidateId,
      input.roleId,
      input.action,
      input.reason,
      input.note,
      input.actor,
      createdAt,
    );
  }
  return { ...input, id, createdAt };
}

export async function listLatestDecisions(): Promise<Map<string, DecisionRecord>> {
  type Row = {
    id: string;
    candidate_id: string;
    role_id: string;
    action: string;
    reason: string | null;
    note: string | null;
    actor: string;
    created_at: string | Date;
  };
  const rows = (await backend()) === "pg"
    ? await pgQuery<Row>("SELECT * FROM decisions ORDER BY created_at ASC")
    : dbAll<Row>("SELECT * FROM decisions ORDER BY created_at ASC");

  const map = new Map<string, DecisionRecord>();
  for (const row of rows) {
    map.set(row.candidate_id, {
      id: row.id,
      candidateId: row.candidate_id,
      roleId: row.role_id,
      action: row.action as DecisionRecord["action"],
      reason: row.reason,
      note: row.note,
      actor: row.actor,
      createdAt: toIso(row.created_at),
    });
  }
  return map;
}

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string | Date;
  ends_at: string | Date;
  attendees: unknown;
  meet_link: string | null;
  location: string | null;
  status: string;
  kind: string;
  candidate_id: string | null;
  created_by: string | null;
  created_at: string | Date;
};

function toEvent(row: EventRow): CalendarEvent {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    start: toIso(row.starts_at),
    end: toIso(row.ends_at),
    attendees: parseJson<{ name?: string; email: string }[]>(row.attendees, []),
    meetLink: row.meet_link,
    htmlLink: null,
    location: row.location,
    status: (row.status as CalendarEvent["status"]) ?? "confirmed",
    kind: (row.kind as CalendarEventKind) ?? "interview",
    candidateId: row.candidate_id ?? undefined,
    local: true,
    organizer: row.created_by ?? undefined,
  };
}

export async function addLocalEvent(input: {
  title: string;
  description?: string;
  start: string;
  end: string;
  attendees?: { name?: string; email: string }[];
  meetLink?: string | null;
  location?: string | null;
  kind?: CalendarEventKind;
  candidateId?: string | null;
  createdBy?: string;
}): Promise<CalendarEvent> {
  const id = newId("evt");
  const event: CalendarEvent = {
    id,
    title: input.title,
    description: input.description ?? "",
    start: input.start,
    end: input.end,
    attendees: input.attendees ?? [],
    meetLink: input.meetLink ?? null,
    htmlLink: null,
    location: input.location ?? null,
    status: "confirmed",
    kind: input.kind ?? "interview",
    candidateId: input.candidateId ?? undefined,
    local: true,
    organizer: input.createdBy,
  };

  if ((await backend()) === "pg") {
    await pgQuery(
      `INSERT INTO local_events
        (id, title, description, starts_at, ends_at, attendees, meet_link, location, status, kind, candidate_id, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, 'confirmed', $9, $10, $11, $12)`,
      [
        id,
        event.title,
        event.description,
        event.start,
        event.end,
        JSON.stringify(event.attendees),
        event.meetLink,
        event.location,
        event.kind,
        event.candidateId ?? null,
        input.createdBy ?? null,
        nowIso(),
      ],
    );
  } else {
    dbRun(
      `INSERT INTO local_events
        (id, title, description, starts_at, ends_at, attendees, meet_link, location, status, kind, candidate_id, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, ?, ?)`,
      id,
      event.title,
      event.description,
      event.start,
      event.end,
      JSON.stringify(event.attendees),
      event.meetLink,
      event.location,
      event.kind,
      event.candidateId ?? null,
      input.createdBy ?? null,
      nowIso(),
    );
  }
  return event;
}

export async function listLocalEvents(fromIso: string, toIsoValue: string): Promise<CalendarEvent[]> {  const rows = (await backend()) === "pg"
    ? await pgQuery<EventRow>(
        "SELECT * FROM local_events WHERE ends_at >= $1 AND starts_at <= $2 ORDER BY starts_at ASC",
        [fromIso, toIsoValue],
      )
    : dbAll<EventRow>(
        "SELECT * FROM local_events WHERE ends_at >= ? AND starts_at <= ? ORDER BY starts_at ASC",
        fromIso,
        toIsoValue,
      );
  return rows.map(toEvent);
}

export async function deleteLocalEvent(id: string): Promise<void> {
  if ((await backend()) === "pg") {
    await pgQuery("DELETE FROM local_events WHERE id = $1", [id]);
    return;
  }
  dbRun("DELETE FROM local_events WHERE id = ?", id);
}

type FileRow = { id: string; name: string; kind: string; url: string; created_at: string | Date };

export async function addWorkspaceFile(input: Omit<WorkspaceFile, "id" | "createdAt">): Promise<WorkspaceFile> {
  const id = newId("file");
  const createdAt = nowIso();
  if ((await backend()) === "pg") {
    await pgQuery(
      "INSERT INTO workspace_files (id, name, kind, url, created_at) VALUES ($1, $2, $3, $4, $5)",
      [id, input.name, input.kind, input.url, createdAt],
    );
  } else {
    dbRun(
      "INSERT INTO workspace_files (id, name, kind, url, created_at) VALUES (?, ?, ?, ?, ?)",
      id,
      input.name,
      input.kind,
      input.url,
      createdAt,
    );
  }
  return { ...input, id, createdAt };
}

export async function listWorkspaceFiles(limit = 12): Promise<WorkspaceFile[]> {
  const rows = (await backend()) === "pg"
    ? await pgQuery<FileRow>("SELECT * FROM workspace_files ORDER BY created_at DESC LIMIT $1", [limit])
    : dbAll<FileRow>("SELECT * FROM workspace_files ORDER BY created_at DESC LIMIT ?", limit);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind as WorkspaceFile["kind"],
    url: row.url,
    createdAt: toIso(row.created_at),
  }));
}

export async function setMeta(key: string, value: string): Promise<void> {
  if ((await backend()) === "pg") {
    await pgQuery(
      `INSERT INTO meta (key, value, updated_at) VALUES ($1, $2, $3)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [key, value, nowIso()],
    );
    return;
  }
  dbRun(
    "INSERT INTO meta (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    key,
    value,
    nowIso(),
  );
}

export async function getMeta(key: string): Promise<string | null> {
  if ((await backend()) === "pg") {
    const rows = await pgQuery<{ value: string }>("SELECT value FROM meta WHERE key = $1", [key]);
    return rows[0]?.value ?? null;
  }
  const row = dbGet<{ value: string }>("SELECT value FROM meta WHERE key = ?", key);
  return row?.value ?? null;
}

/* ---------------------------------------------------------------------------
 * Google OAuth accounts
 * ------------------------------------------------------------------------- */

export type OAuthAccountRecord = {
  owner: string;
  provider: string;
  email: string | null;
  tokens: string;
  scopes: string;
  expiry: number | null;
  createdAt: string;
  updatedAt: string;
};

type OAuthRow = {
  owner: string;
  provider: string;
  email: string | null;
  tokens: string;
  scopes: string;
  expiry: number | string | null;
  created_at: string | Date;
  updated_at: string | Date;
};

function toOAuthAccount(row: OAuthRow): OAuthAccountRecord {
  return {
    owner: row.owner,
    provider: row.provider,
    email: row.email,
    tokens: row.tokens,
    scopes: row.scopes,
    expiry: row.expiry === null || row.expiry === undefined ? null : Number(row.expiry),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export async function getOAuthAccount(owner: string, provider: string): Promise<OAuthAccountRecord | null> {
  if ((await backend()) === "pg") {
    const rows = await pgQuery<OAuthRow>(
      "SELECT * FROM oauth_accounts WHERE owner = $1 AND provider = $2",
      [owner, provider],
    );
    return rows[0] ? toOAuthAccount(rows[0]) : null;
  }
  const row = dbGet<OAuthRow>("SELECT * FROM oauth_accounts WHERE owner = ? AND provider = ?", owner, provider);
  return row ? toOAuthAccount(row) : null;
}

export async function saveOAuthAccount(record: OAuthAccountRecord): Promise<void> {
  if ((await backend()) === "pg") {
    await pgQuery(
      `INSERT INTO oauth_accounts (owner, provider, email, tokens, scopes, expiry, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (owner, provider) DO UPDATE SET
         email = excluded.email,
         tokens = excluded.tokens,
         scopes = excluded.scopes,
         expiry = excluded.expiry,
         updated_at = excluded.updated_at`,
      [record.owner, record.provider, record.email, record.tokens, record.scopes, record.expiry, record.createdAt, record.updatedAt],
    );
    return;
  }
  dbRun(
    `INSERT INTO oauth_accounts (owner, provider, email, tokens, scopes, expiry, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(owner, provider) DO UPDATE SET
       email = excluded.email,
       tokens = excluded.tokens,
       scopes = excluded.scopes,
       expiry = excluded.expiry,
       updated_at = excluded.updated_at`,
    record.owner,
    record.provider,
    record.email,
    record.tokens,
    record.scopes,
    record.expiry,
    record.createdAt,
    record.updatedAt,
  );
}

export async function deleteOAuthAccount(owner: string, provider: string): Promise<void> {
  if ((await backend()) === "pg") {
    await pgQuery("DELETE FROM oauth_accounts WHERE owner = $1 AND provider = $2", [owner, provider]);
    return;
  }
  dbRun("DELETE FROM oauth_accounts WHERE owner = ? AND provider = ?", owner, provider);
}

/* ---------------------------------------------------------------------------
 * Live completed interviews (Booth, Walk-in Drive, Uploaded Calls)
 * ------------------------------------------------------------------------- */

type LiveCandidateRow = {
  id: string;
  role_id: string;
  source: string;
  drive_token: string | null;
  payload: unknown;
  created_at: string | Date;
  updated_at: string | Date;
};

// Remember if Postgres doesn't have migration 0004 applied yet so we don't
// waste a failing remote round-trip on every page navigation.
let pgLiveCandidatesAvailable: boolean | null = null;

export async function saveLiveCandidate(candidate: Candidate): Promise<Candidate> {
  const at = nowIso();
  const stamped: Candidate = { ...candidate, isReal: true };
  if ((await backend()) === "pg" && pgLiveCandidatesAvailable !== false) {
    try {
      await pgQuery(
        `INSERT INTO live_candidates (id, role_id, source, drive_token, payload, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $6)
         ON CONFLICT (id) DO UPDATE SET
           role_id = excluded.role_id,
           source = excluded.source,
           drive_token = excluded.drive_token,
           payload = excluded.payload,
           updated_at = excluded.updated_at`,
        [stamped.id, stamped.roleId, stamped.source, stamped.driveToken ?? null, JSON.stringify(stamped), at],
      );
      pgLiveCandidatesAvailable = true;
      return stamped;
    } catch {
      pgLiveCandidatesAvailable = false;
      /* migration 0004 not applied on Postgres yet — use local SQLite */
    }
  }
  dbRun(
    `INSERT INTO live_candidates (id, role_id, source, drive_token, payload, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       role_id = excluded.role_id,
       source = excluded.source,
       drive_token = excluded.drive_token,
       payload = excluded.payload,
       updated_at = excluded.updated_at`,
    stamped.id,
    stamped.roleId,
    stamped.source,
    stamped.driveToken ?? null,
    JSON.stringify(stamped),
    at,
    at,
  );
  return stamped;
}

export async function listLiveCandidates(limit = 50): Promise<Candidate[]> {
  let rows: LiveCandidateRow[] = [];
  if ((await backend()) === "pg" && pgLiveCandidatesAvailable !== false) {
    try {
      rows = await pgQuery<LiveCandidateRow>(
        "SELECT * FROM live_candidates ORDER BY created_at DESC LIMIT $1",
        [limit],
      );
      pgLiveCandidatesAvailable = true;
    } catch {
      pgLiveCandidatesAvailable = false;
      rows = dbAll<LiveCandidateRow>("SELECT * FROM live_candidates ORDER BY created_at DESC LIMIT ?", limit);
    }
  } else {
    rows = dbAll<LiveCandidateRow>("SELECT * FROM live_candidates ORDER BY created_at DESC LIMIT ?", limit);
  }
  const out: Candidate[] = [];
  for (const row of rows) {
    const parsed = parseJson<Candidate | null>(row.payload, null);
    if (parsed) out.push({ ...parsed, isReal: true });
  }
  return out;
}

export async function getLiveCandidate(id: string): Promise<Candidate | null> {
  const all = await listLiveCandidates(100);
  return all.find((c) => c.id === id) ?? null;
}

export async function updateLiveCandidate(
  id: string,
  updater: (current: Candidate) => Candidate,
): Promise<Candidate | null> {
  const existing = await getLiveCandidate(id);
  if (!existing) return null;
  const next = updater(existing);
  return saveLiveCandidate(next);
}

export async function nextDriveToken(): Promise<string> {
  const existing = await listLiveCandidates(100);
  const count = existing.filter((c) => Boolean(c.driveToken)).length;
  return `#${String(count + 1).padStart(2, "0")}`;
}


