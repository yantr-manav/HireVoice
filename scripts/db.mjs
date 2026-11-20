#!/usr/bin/env node
/**
 * Minimal database utility for the Supabase Postgres project.
 *
 *   npm run db:check      connection + table count
 *   npm run db:migrate    apply supabase/migrations/*.sql once, in order
 *   npm run db:tables     list public tables
 *
 * Uses DATABASE_URL (session pooler) or SUPABASE_DB_URL (direct connection).
 * Both are percent-encoded in .env. asyncpg is a Python driver; this project is
 * Node/TypeScript, so it uses `pg` (node-postgres) with the same URL shape.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function url() {
  const value = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || process.env.POSTGRES_URL;
  if (!value) throw new Error("Set DATABASE_URL or SUPABASE_DB_URL.");
  return value;
}

async function withClient(fn) {
  const client = new Client({
    connectionString: url(),
    ssl: /sslmode=(require|verify-ca|verify-full)/.test(url()) ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function check() {
  await withClient(async (client) => {
    const version = await client.query("select version()");
    const tables = await client.query(
      "select count(*)::int as count from information_schema.tables where table_schema = 'public'",
    );
    console.log(`connected: ${String(version.rows[0].version).split(" on ")[0]}`);
    console.log(`public tables: ${tables.rows[0].count}`);
  });
}

async function tables() {
  await withClient(async (client) => {
    const rows = await client.query(
      "select table_name from information_schema.tables where table_schema = 'public' order by table_name",
    );
    for (const row of rows.rows) console.log(row.table_name);
  });
}

async function migrate() {
  const dir = path.join(root, "supabase", "migrations");
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort();

  await withClient(async (client) => {
    await client.query(`
      create table if not exists _migrations (
        name text primary key,
        applied_at timestamptz not null default now()
      )
    `);
    const applied = new Set((await client.query("select name from _migrations")).rows.map((row) => row.name));

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`skip  ${file}`);
        continue;
      }
      const sql = readFileSync(path.join(dir, file), "utf8");
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("insert into _migrations (name) values ($1)", [file]);
        await client.query("commit");
        console.log(`apply ${file}`);
      } catch (error) {
        await client.query("rollback");
        console.error(`fail  ${file}`);
        throw error;
      }
    }
  });
}

const command = process.argv[2] ?? "check";
const actions = { check, migrate, tables };
const action = actions[command];
if (!action) {
  console.error(`Unknown command: ${command}. Use check, migrate or tables.`);
  process.exit(1);
}
action().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
