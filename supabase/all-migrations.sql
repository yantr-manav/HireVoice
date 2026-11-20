-- Hirevoice ? combined schema for the Supabase SQL editor
-- Generated from supabase/migrations. Prefer `npm run db:migrate` when you
-- have the database password; paste this file when you do not.

-- ===== 0001_init.sql =====
-- Hirevoice · initial schema
-- Run in the Supabase SQL editor, or: supabase db push
-- Matches Hirevoice_Spec_v2/04_DATABASE_SCHEMA.md.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. Enums and helpers
-- ---------------------------------------------------------------------------

do $$ begin
  create type member_role      as enum ('owner','admin','recruiter','viewer');
  create type candidate_stage  as enum ('invited','interviewed','in_review','shortlisted','scheduled','closed');
  create type interview_status as enum ('created','live','uploaded','redacting','scoring','scored','failed');
  create type run_status       as enum ('queued','running','awaiting_approval','succeeded','failed','cancelled');
  create type step_status      as enum ('proposed','awaiting','running','ok','failed','skipped');
  create type autonomy_level   as enum ('suggest','ask','auto');
  create type decision_kind    as enum ('shortlist_suggested','needs_review','feedback_suggested');
  create type approval_status  as enum ('pending','approved','rejected','edited');
exception
  when duplicate_object then null;
end $$;

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

-- ---------------------------------------------------------------------------
-- 2. Tenancy
-- ---------------------------------------------------------------------------

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists org_members (
  org_id uuid references organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role member_role not null default 'recruiter',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create or replace function public.is_org_member(_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from org_members m where m.org_id = _org and m.user_id = auth.uid())
$$;

create or replace function public.is_org_admin(_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from org_members m
                 where m.org_id = _org and m.user_id = auth.uid() and m.role in ('owner','admin'))
$$;

-- ---------------------------------------------------------------------------
-- 3. Integrations
-- ---------------------------------------------------------------------------

create table if not exists connections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  provider text not null default 'google',
  service text not null check (service in ('gmail','calendar','drive','sheets','forms','docs')),
  account_email text,
  scopes text[] not null default '{}',
  enc_refresh_token text not null,
  key_id text not null default 'v1',
  config jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active','revoked','error')),
  last_checked_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (org_id, service)
);

create or replace view connections_public with (security_invoker = true) as
  select id, org_id, provider, service, account_email, scopes, config, status, last_checked_at, created_at
  from connections;

-- ---------------------------------------------------------------------------
-- 4. Playbooks, roles, candidates
-- ---------------------------------------------------------------------------

create table if not exists playbooks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  current_version int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists playbook_versions (
  id uuid primary key default gen_random_uuid(),
  playbook_id uuid not null references playbooks(id) on delete cascade,
  version int not null,
  markdown text not null,
  compiled jsonb,
  warnings jsonb not null default '[]'::jsonb,
  published boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (playbook_id, version)
);

create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  playbook_id uuid not null references playbooks(id),
  playbook_version int,
  title text not null,
  languages text[] not null default '{hi,en}',
  status text not null default 'open' check (status in ('draft','open','paused','closed')),
  public_slug text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists candidates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  role_id uuid not null references roles(id) on delete cascade,
  alias text not null,
  source text not null default 'invite' check (source in ('invite','drive','form','practice','manual')),
  stage candidate_stage not null default 'invited',
  language text,
  consent_at timestamptz,
  consent_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists candidates_org_role_stage_idx on candidates (org_id, role_id, stage);

create table if not exists invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  role_id uuid not null references roles(id) on delete cascade,
  candidate_id uuid references candidates(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists resumes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  candidate_id uuid references candidates(id) on delete cascade,
  drive_file_id text,
  storage_path text,
  text_redacted text,
  parsed jsonb,
  match_score numeric(4,2),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 5. Interviews, transcripts, PII vault
-- ---------------------------------------------------------------------------

create table if not exists interviews (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  candidate_id uuid not null references candidates(id) on delete cascade,
  role_id uuid not null references roles(id) on delete cascade,
  mode text not null default 'live' check (mode in ('live','fallback','practice','replay')),
  language text,
  status interview_status not null default 'created',
  playbook_version int,
  audio_path text,
  live_processing_consent_at timestamptz,
  live_processing_consent_version text,
  audio_recording_consent_at timestamptz,
  audio_recording_consent_version text,
  started_at timestamptz,
  ended_at timestamptz,
  duration_ms int,
  quality jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now()
);

create table if not exists transcript_segments (
  interview_id uuid not null references interviews(id) on delete cascade,
  seq int not null,
  speaker text not null check (speaker in ('interviewer','candidate')),
  text_original_enc bytea,
  text_redacted text not null,
  t_start_ms int not null,
  t_end_ms int,
  lang text,
  flags text[] not null default '{}',
  primary key (interview_id, seq)
);

create table if not exists pii_vault (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  candidate_id uuid not null references candidates(id) on delete cascade,
  token text not null,
  kind text not null,
  value_enc text not null,
  unique (candidate_id, token)
);

create or replace view transcript_view with (security_invoker = true) as
  select interview_id, seq, speaker, text_redacted, t_start_ms, t_end_ms, lang, flags
  from transcript_segments;

-- ---------------------------------------------------------------------------
-- 6. Scores, items, reviews
-- ---------------------------------------------------------------------------

create table if not exists scores (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  interview_id uuid not null references interviews(id) on delete cascade,
  candidate_id uuid not null references candidates(id) on delete cascade,
  model text not null,
  prompt_version text not null,
  overall numeric(3,2),
  confidence numeric(3,2),
  confidence_parts jsonb,
  decision decision_kind,
  summary text,
  is_current boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists scores_candidate_current_idx on scores (candidate_id, is_current);

create table if not exists score_items (
  id uuid primary key default gen_random_uuid(),
  score_id uuid not null references scores(id) on delete cascade,
  skill text not null,
  value numeric(2,1) not null check (value between 1 and 5),
  weight numeric(3,2) not null default 1,
  reasoning text,
  evidence jsonb not null default '[]'::jsonb,
  insufficient_evidence boolean not null default false
);

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  score_id uuid not null references scores(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id),
  action text not null check (action in ('approve','reject','override','skip')),
  skill text,
  old_value numeric(2,1),
  new_value numeric(2,1),
  reason text,
  created_at timestamptz not null default now()
);

create or replace view calibration_stats with (security_invoker = true) as
  select s.org_id,
         count(*) filter (where r.action in ('approve','reject','override')) as reviewed,
         count(*) filter (where r.action = 'approve') as agreed
  from reviews r join scores s on s.id = r.score_id
  group by s.org_id;

-- ---------------------------------------------------------------------------
-- 7. Agents, runs, steps, approvals
-- ---------------------------------------------------------------------------

create table if not exists agents (
  id text primary key,
  name text not null,
  model text,
  skill_path text,
  tier text not null default 'P0'
);

create table if not exists agent_permissions (
  org_id uuid not null references organizations(id) on delete cascade,
  agent_id text not null references agents(id),
  tool text not null,
  level autonomy_level not null default 'ask',
  primary key (org_id, agent_id, tool)
);

create table if not exists agent_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  agent_id text not null references agents(id),
  event_id uuid,
  candidate_id uuid references candidates(id) on delete set null,
  status run_status not null default 'queued',
  trigger text,
  tokens_in int,
  tokens_out int,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists agent_runs_org_created_idx on agent_runs (org_id, created_at desc);

create table if not exists agent_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references agent_runs(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  seq int not null,
  tool text not null,
  args jsonb,
  result jsonb,
  level autonomy_level not null,
  status step_status not null default 'proposed',
  idempotency_key text unique,
  error text,
  duration_ms int,
  created_at timestamptz not null default now()
);

create table if not exists approvals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  step_id uuid not null references agent_steps(id) on delete cascade,
  status approval_status not null default 'pending',
  proposal jsonb not null,
  edited jsonb,
  decided_by uuid references auth.users(id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 8. Outputs, events, audit, practice
-- ---------------------------------------------------------------------------

create table if not exists meetings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  candidate_id uuid not null references candidates(id) on delete cascade,
  calendar_event_id text,
  meet_url text,
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'proposed' check (status in ('proposed','scheduled','cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists outbox (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  candidate_id uuid references candidates(id) on delete set null,
  kind text not null check (kind in ('invite','feedback','digest','other')),
  to_hash text,
  subject text,
  body_preview text,
  gmail_message_id text,
  status text not null default 'draft' check (status in ('draft','sent','failed')),
  created_at timestamptz not null default now()
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists audit_log (
  id bigint generated always as identity primary key,
  org_id uuid not null,
  actor_id uuid,
  actor_kind text not null check (actor_kind in ('user','agent','candidate','system')),
  action text not null,
  target_type text,
  target_id text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
revoke update, delete, truncate on audit_log from public, anon, authenticated;

create table if not exists practice_sessions (
  id uuid primary key default gen_random_uuid(),
  language text,
  duration_ms int,
  rubric_version text,
  feedback jsonb,
  email_hash text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 9. updated_at triggers
-- ---------------------------------------------------------------------------

drop trigger if exists playbooks_touch on playbooks;
create trigger playbooks_touch before update on playbooks
  for each row execute function public.touch_updated_at();

drop trigger if exists roles_touch on roles;
create trigger roles_touch before update on roles
  for each row execute function public.touch_updated_at();

drop trigger if exists candidates_touch on candidates;
create trigger candidates_touch before update on candidates
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 10. Row-level security
-- ---------------------------------------------------------------------------

do $$ declare t text; begin
  for t in select unnest(array[
    'organizations','org_members','connections','playbooks','playbook_versions','roles','candidates',
    'invites','resumes','interviews','transcript_segments','pii_vault','scores','score_items','reviews',
    'agent_permissions','agent_runs','agent_steps','approvals','meetings','outbox','events','audit_log','practice_sessions'])
  loop execute format('alter table %I enable row level security', t); end loop; end $$;

do $$ begin
  -- Drop-and-create keeps this migration re-runnable.
  drop policy if exists org_read on roles;
  drop policy if exists org_write on roles;
  drop policy if exists org_read on candidates;
  drop policy if exists org_write on candidates;
  drop policy if exists org_read on interviews;
  drop policy if exists org_read on scores;
  drop policy if exists org_read on agent_runs;
  drop policy if exists org_read on agent_steps;
  drop policy if exists org_read on approvals;
  drop policy if exists org_read on audit_log;
  drop policy if exists org_read on playbooks;
  drop policy if exists org_write on playbooks;
  drop policy if exists org_read on meetings;
  drop policy if exists org_read on outbox;
  drop policy if exists items_read on score_items;
  drop policy if exists pv_read on playbook_versions;
  drop policy if exists pv_write on playbook_versions;
  drop policy if exists members_read on org_members;
  drop policy if exists org_self_read on organizations;
exception when others then null;
end $$;

create policy org_read  on roles       for select using (is_org_member(org_id));
create policy org_write on roles       for all    using (is_org_member(org_id)) with check (is_org_member(org_id));
create policy org_read  on candidates  for select using (is_org_member(org_id));
create policy org_write on candidates  for all    using (is_org_member(org_id)) with check (is_org_member(org_id));
create policy org_read  on interviews  for select using (is_org_member(org_id));
create policy org_read  on scores      for select using (is_org_member(org_id));
create policy org_read  on agent_runs  for select using (is_org_member(org_id));
create policy org_read  on agent_steps for select using (is_org_member(org_id));
create policy org_read  on approvals   for select using (is_org_member(org_id));
create policy org_read  on audit_log   for select using (is_org_admin(org_id));
create policy org_read  on playbooks   for select using (is_org_member(org_id));
create policy org_write on playbooks   for all    using (is_org_member(org_id)) with check (is_org_member(org_id));
create policy org_read  on meetings    for select using (is_org_member(org_id));
create policy org_read  on outbox      for select using (is_org_member(org_id));

create policy items_read on score_items for select using (
  exists (select 1 from scores s where s.id = score_id and is_org_member(s.org_id)));
create policy pv_read on playbook_versions for select using (
  exists (select 1 from playbooks p where p.id = playbook_id and is_org_member(p.org_id)));
create policy pv_write on playbook_versions for all using (
  exists (select 1 from playbooks p where p.id = playbook_id and is_org_member(p.org_id)))
  with check (exists (select 1 from playbooks p where p.id = playbook_id and is_org_member(p.org_id)));

create policy members_read on org_members for select using (user_id = auth.uid() or is_org_admin(org_id));
create policy org_self_read on organizations for select using (is_org_member(id));

-- Clients read sensitive tables only through the views below; the service role
-- handles transcript originals, PII reveal, invites and scoring writes.
grant select on connections_public, transcript_view, calibration_stats to authenticated;

-- ---------------------------------------------------------------------------
-- 11. Append-only audit log
-- ---------------------------------------------------------------------------

create or replace function public.audit_log_block_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'audit_log is append-only';
end $$;

drop trigger if exists audit_log_no_update on audit_log;
create trigger audit_log_no_update before update or delete on audit_log
  for each row execute function public.audit_log_block_mutation();

-- ---------------------------------------------------------------------------
-- 12. Storage buckets
-- ---------------------------------------------------------------------------
-- Create these in Dashboard > Storage (private), or with the service role:
--   interview-audio  ({org_id}/{interview_id}.webm)
--   resumes
--   posters
-- Access is via 60-second signed URLs generated server-side after a membership check.

-- ===== 0002_agent_actions.sql =====
-- ---------------------------------------------------------------------------
-- 0002 · Runtime tables for the agent, Google connectors and local fallbacks
--
-- These mirror the SQLite tables used by lib/db today. When SUPABASE_URL and
-- the service role key are configured, lib/db/repo.ts is the single swap point.
-- RLS is enabled with no permissive policies: only the service role and
-- security-definer functions may touch these tables from the server.
-- ---------------------------------------------------------------------------

create table if not exists oauth_accounts (
  owner text not null,
  provider text not null,
  email text,
  tokens text not null,
  scopes text not null,
  expiry bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner, provider)
);

create table if not exists agent_actions (
  id text primary key,
  org_id uuid references organizations(id) on delete cascade,
  transcript text,
  intent text not null,
  tool text not null,
  args jsonb not null default '{}'::jsonb,
  status text not null check (status in ('proposed', 'approved', 'executed', 'rejected', 'failed')),
  mutating boolean not null default true,
  summary text not null,
  result jsonb,
  error text,
  actor text not null,
  source text not null check (source in ('gemini', 'gemma', 'fallback', 'ui')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_actions_created_idx on agent_actions (created_at desc);
create index if not exists agent_actions_status_idx on agent_actions (status);

create table if not exists audit_events (
  id text primary key,
  org_id uuid references organizations(id) on delete cascade,
  actor text not null,
  action text not null,
  target text,
  detail text,
  surface text not null,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_created_idx on audit_events (created_at desc);

create table if not exists decisions (
  id text primary key,
  org_id uuid references organizations(id) on delete cascade,
  candidate_id text not null,
  role_id text not null,
  action text not null check (action in ('shortlist', 'close', 'skip', 'review')),
  reason text,
  note text,
  actor text not null,
  created_at timestamptz not null default now()
);

create index if not exists decisions_candidate_idx on decisions (candidate_id, created_at desc);

create table if not exists local_events (
  id text primary key,
  org_id uuid references organizations(id) on delete cascade,
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  attendees jsonb not null default '[]'::jsonb,
  meet_link text,
  location text,
  status text not null default 'confirmed',
  kind text not null default 'interview',
  candidate_id text,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists local_events_start_idx on local_events (starts_at);

create table if not exists workspace_files (
  id text primary key,
  org_id uuid references organizations(id) on delete cascade,
  name text not null,
  kind text not null,
  url text not null,
  created_at timestamptz not null default now()
);

create table if not exists model_usage (
  id bigserial primary key,
  key_ref text not null,
  provider text not null,
  model text not null,
  status text not null,
  latency_ms integer,
  input_chars integer,
  output_chars integer,
  created_at timestamptz not null default now()
);

create index if not exists model_usage_created_idx on model_usage (created_at desc);

create table if not exists key_cooldowns (
  key_ref text primary key,
  cooldown_until bigint not null,
  reason text,
  updated_at timestamptz not null default now()
);

alter table oauth_accounts enable row level security;
alter table agent_actions enable row level security;
alter table audit_events enable row level security;
alter table decisions enable row level security;
alter table local_events enable row level security;
alter table workspace_files enable row level security;
alter table model_usage enable row level security;
alter table key_cooldowns enable row level security;

-- No anon/authenticated policies on purpose. These rows are written by server
-- routes with the service role, and read through views that check org_members.
-- Rotate the encryption key in Secret Manager; tokens are AES-256-GCM sealed
-- before they reach this table.

-- ===== 0003_meta.sql =====
-- ---------------------------------------------------------------------------
-- 0003 · Small key/value table used by the app (demo entry, onboarding, prefs)
--
-- Mirrors the SQLite `meta` table. RLS is on with no policies; only the service
-- role connection writes here.
-- ---------------------------------------------------------------------------

create table if not exists meta (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table meta enable row level security;

-- The SQLite store uses "manual" for actions executed by a recruiter directly.
-- Keep the Postgres check constraint in step with the app's source union.
alter table agent_actions drop constraint if exists agent_actions_source_check;
alter table agent_actions
  add constraint agent_actions_source_check
  check (source in ('gemini', 'gemma', 'fallback', 'manual', 'ui'));
