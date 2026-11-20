import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Pool } from "pg";

/**
 * A small, real database for the parts of Hirevoice that must survive a
 * reload: connector tokens, recruiter decisions, agent actions, audit events,
 * local calendar events and model key health.
 *
 * When DATABASE_URL (or SUPABASE_DB_URL) is set, those tables live in Supabase
 * Postgres. Otherwise the same shapes are kept in a local SQLite file so the
 * app stays fully functional before credentials are added. The SQLite file is
 * still used for device-local secrets and model key cooldowns, which are
 * intentionally per-instance.
 */

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS oauth_accounts (
  owner TEXT NOT NULL,
  provider TEXT NOT NULL,
  email TEXT,
  tokens TEXT NOT NULL,
  scopes TEXT NOT NULL,
  expiry INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (owner, provider)
);

CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  action TEXT NOT NULL,
  reason TEXT,
  note TEXT,
  actor TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS decisions_candidate_idx ON decisions (candidate_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT,
  detail TEXT,
  surface TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS audit_created_idx ON audit_events (created_at DESC);

CREATE TABLE IF NOT EXISTS agent_actions (
  id TEXT PRIMARY KEY,
  transcript TEXT,
  intent TEXT NOT NULL,
  tool TEXT NOT NULL,
  args TEXT NOT NULL,
  status TEXT NOT NULL,
  mutating INTEGER NOT NULL,
  summary TEXT NOT NULL,
  result TEXT,
  error TEXT,
  actor TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS actions_created_idx ON agent_actions (created_at DESC);
CREATE INDEX IF NOT EXISTS actions_status_idx ON agent_actions (status);

CREATE TABLE IF NOT EXISTS local_events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  attendees TEXT,
  meet_link TEXT,
  location TEXT,
  status TEXT NOT NULL,
  kind TEXT NOT NULL,
  candidate_id TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS events_start_idx ON local_events (starts_at);

CREATE TABLE IF NOT EXISTS model_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key_ref TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  status TEXT NOT NULL,
  latency_ms INTEGER,
  input_chars INTEGER,
  output_chars INTEGER,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS usage_created_idx ON model_usage (created_at DESC);

CREATE TABLE IF NOT EXISTS key_cooldowns (
  key_ref TEXT PRIMARY KEY,
  cooldown_until INTEGER NOT NULL,
  reason TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workspace_files (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS live_candidates (
  id TEXT PRIMARY KEY,
  role_id TEXT NOT NULL,
  source TEXT NOT NULL,
  drive_token TEXT,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS live_candidates_created_idx ON live_candidates (created_at DESC);
`;

type GlobalWithDb = typeof globalThis & { __hvDb?: DatabaseSync };

function resolveDirectory() {
  if (process.env.HIREVOICE_DB === ":memory:") return ":memory:";
  // Keep the database outside the project tree. SQLite in WAL mode touches the
  // -shm file on every read, which a dev file watcher would treat as a source
  // change and reload the page in a loop. /tmp is also the writable path on
  // Cloud Run and other read-only container filesystems.
  const dir = process.env.HIREVOICE_DATA_DIR || path.join(os.tmpdir(), "hirevoice-data");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "hirevoice.db");
}

export function getDb(): DatabaseSync {
  const globalRef = globalThis as GlobalWithDb;
  if (globalRef.__hvDb) return globalRef.__hvDb;

  const location = resolveDirectory();
  if (location !== ":memory:") {
    const dir = path.dirname(location);
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new DatabaseSync(location);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA busy_timeout = 4000;");
  db.exec(SCHEMA);
  globalRef.__hvDb = db;
  return db;
}

export function dbAll<T>(sql: string, ...params: (string | number | null)[]): T[] {
  const rows = getDb().prepare(sql).all(...params);
  return rows as unknown as T[];
}

export function dbGet<T>(sql: string, ...params: (string | number | null)[]): T | null {
  const row = getDb().prepare(sql).get(...params);
  return (row as unknown as T | undefined) ?? null;
}

export function dbRun(sql: string, ...params: (string | number | null)[]) {
  return getDb().prepare(sql).run(...params);
}

export function nowIso() {
  return new Date().toISOString();
}

export function newId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

export function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value !== "string") return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/* ---------------------------------------------------------------------------
 * Postgres (Supabase)
 *
 * Server routes and server components run on the Node runtime, so a small
 * connection pool is enough. Writes go through the direct Postgres connection
 * (never the browser) and RLS stays enabled with no permissive policies.
 * ------------------------------------------------------------------------- */

const globalForPool = globalThis as typeof globalThis & { __hvPgPool?: Pool };

export function databaseUrl(): string {
  return (
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.POSTGRES_URL ||
    ""
  );
}

export function usingPostgres(): boolean {
  return Boolean(databaseUrl());
}

export async function pgPool(): Promise<Pool> {
  if (globalForPool.__hvPgPool) return globalForPool.__hvPgPool;
  const connectionString = databaseUrl();
  if (!connectionString) throw new Error("DATABASE_URL is not configured");

  const { Pool: PgPool } = await import("pg");
  const needsSsl = /sslmode=(require|verify-ca|verify-full)/.test(connectionString);
  const pool = new PgPool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 8_000,
    ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  });
  // A dropped idle client must not take the server process down.
  pool.on("error", (error) => {
    console.warn(`[db] idle Postgres client error: ${error.message}`);
  });
  globalForPool.__hvPgPool = pool;
  return pool;
}

export async function pgQuery<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const pool = await pgPool();
  const result = await pool.query(sql, params);
  return result.rows as T[];
}

/** Postgres hands back Date objects; the app stores ISO strings. */
export function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value ?? "");
}

