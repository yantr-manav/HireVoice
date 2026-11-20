# 04. Database Schema (Supabase / Postgres)

Run the SQL blocks in order in the Supabase SQL editor. Put them in `supabase/migrations/0001_init.sql`.

## Table map

| Group | Tables |
|---|---|
| Tenancy | `organizations`, `org_members` |
| Integrations | `connections` |
| Playbooks | `playbooks`, `playbook_versions` |
| Hiring | `roles`, `candidates`, `invites`, `resumes` |
| Interviews | `interviews`, `transcript_segments`, `pii_vault` |
| Scoring | `scores`, `score_items`, `reviews` |
| Agents | `agents`, `agent_permissions`, `agent_runs`, `agent_steps`, `approvals` |
| Outputs | `meetings`, `outbox` |
| Governance | `audit_log`, `events` |
| Practice | `practice_sessions` |

## 1. Extensions, helpers, enums

```sql
create extension if not exists "pgcrypto";

create type member_role      as enum ('owner','admin','recruiter','viewer');
create type candidate_stage  as enum ('invited','interviewed','in_review','shortlisted','scheduled','closed');
create type interview_status as enum ('created','live','uploaded','redacting','scoring','scored','failed');
create type run_status       as enum ('queued','running','awaiting_approval','succeeded','failed','cancelled');
create type step_status      as enum ('proposed','awaiting','running','ok','failed','skipped');
create type autonomy_level   as enum ('suggest','ask','auto');
create type decision_kind    as enum ('shortlist_suggested','needs_review','feedback_suggested');
create type approval_status  as enum ('pending','approved','rejected','edited');

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
```

## 2. Tenancy

```sql
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  settings jsonb not null default '{}'::jsonb,   -- retention_days, anonymised_default, consent_text_version
  created_at timestamptz not null default now()
);

create table org_members (
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
```

## 3. Integrations

```sql
create table connections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  provider text not null default 'google',
  service text not null check (service in ('gmail','calendar','drive','sheets','forms','docs')),
  account_email text,
  scopes text[] not null default '{}',
  enc_refresh_token text not null,        -- AES-256-GCM, base64; never selectable by clients
  key_id text not null default 'v1',
  config jsonb not null default '{}'::jsonb,  -- {drive_folder_id, sheet_id, calendar_id}
  status text not null default 'active' check (status in ('active','revoked','error')),
  last_checked_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (org_id, service)
);
```
RLS note: members can read non-secret columns through a view `connections_public` (below). Direct `select` on `connections` is not granted to `authenticated`.

```sql
create view connections_public with (security_invoker = true) as
  select id, org_id, provider, service, account_email, scopes, config, status, last_checked_at, created_at
  from connections;
```

## 4. Playbooks, roles, candidates

```sql
create table playbooks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  current_version int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table playbook_versions (
  id uuid primary key default gen_random_uuid(),
  playbook_id uuid not null references playbooks(id) on delete cascade,
  version int not null,
  markdown text not null,
  compiled jsonb,                       -- PlaybookSpec (file 05)
  warnings jsonb not null default '[]'::jsonb,
  published boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (playbook_id, version)
);

create table roles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  playbook_id uuid not null references playbooks(id),
  playbook_version int,                 -- pinned when published
  title text not null,
  languages text[] not null default '{hi,en}',
  status text not null default 'open' check (status in ('draft','open','paused','closed')),
  public_slug text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table candidates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  role_id uuid not null references roles(id) on delete cascade,
  alias text not null,                  -- e.g. 'Candidate 4F2A'
  source text not null default 'invite' check (source in ('invite','drive','form','practice','manual')),
  stage candidate_stage not null default 'invited',
  language text,
  consent_at timestamptz,
  consent_version text,
  -- identity fields live in pii_vault, not here
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on candidates (org_id, role_id, stage);

create table invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  role_id uuid not null references roles(id) on delete cascade,
  candidate_id uuid references candidates(id) on delete cascade,
  token_hash text not null unique,      -- sha256 of the random token
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table resumes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  candidate_id uuid references candidates(id) on delete cascade,
  drive_file_id text,
  storage_path text,
  text_redacted text,
  parsed jsonb,                         -- skills, experience (redacted)
  match_score numeric(4,2),
  created_at timestamptz not null default now()
);
```

## 5. Interviews, transcripts, PII vault

```sql
create table interviews (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  candidate_id uuid not null references candidates(id) on delete cascade,
  role_id uuid not null references roles(id) on delete cascade,
  mode text not null default 'live' check (mode in ('live','fallback','practice','replay')),
  language text,
  status interview_status not null default 'created',
  playbook_version int,
  audio_path text,                      -- null unless audio-recording consent was granted
  live_processing_consent_at timestamptz,
  live_processing_consent_version text,
  audio_recording_consent_at timestamptz,
  audio_recording_consent_version text,
  started_at timestamptz,
  ended_at timestamptz,
  duration_ms int,
  quality jsonb not null default '{}'::jsonb,   -- {silence_ratio, asr_flags, reconnects}
  error text,
  created_at timestamptz not null default now()
);

create table transcript_segments (
  interview_id uuid not null references interviews(id) on delete cascade,
  seq int not null,
  speaker text not null check (speaker in ('interviewer','candidate')),
  text_original_enc bytea,              -- optional AES-GCM ciphertext; service-role only; delete on TTL
  text_redacted text not null,          -- only transcript supplied to scoring/recruiter views
  t_start_ms int not null,
  t_end_ms int,
  lang text,
  flags text[] not null default '{}',   -- 'injection','low_audio','long_silence'
  primary key (interview_id, seq)
);

create table pii_vault (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  candidate_id uuid not null references candidates(id) on delete cascade,
  token text not null,                  -- e.g. NAME_1
  kind text not null,                   -- name | phone | email | address | id | employer
  value_enc text not null,              -- encrypted
  unique (candidate_id, token)
);
-- Full identity (name, phone, email) is also stored as encrypted vault entries with token 'IDENTITY'.
-- Keep original transcript text only when operationally necessary; otherwise set text_original_enc=NULL after redaction.
```
Access rule: `transcript_segments.text_original_enc` and `pii_vault` are **never granted to `authenticated`**. The app reads them only in server route handlers using the service role after checking membership and writing an audit event. Expose redacted text through a view:

```sql
create view transcript_view with (security_invoker = true) as
  select interview_id, seq, speaker, text_redacted, t_start_ms, t_end_ms, lang, flags
  from transcript_segments;
```

## 6. Scores, items, reviews

```sql
create table scores (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  interview_id uuid not null references interviews(id) on delete cascade,
  candidate_id uuid not null references candidates(id) on delete cascade,
  model text not null,
  prompt_version text not null,
  overall numeric(3,2),
  confidence numeric(3,2),              -- evidence-quality heuristic, not probability of candidate quality
  confidence_parts jsonb,               -- {verified_ratio, consistency, rubric_coverage, transcript_quality}; heuristic only
  decision decision_kind,
  summary text,
  is_current boolean not null default true,
  created_at timestamptz not null default now()
);
create index on scores (candidate_id, is_current);

create table score_items (
  id uuid primary key default gen_random_uuid(),
  score_id uuid not null references scores(id) on delete cascade,
  skill text not null,
  value numeric(2,1) not null check (value between 1 and 5),
  weight numeric(3,2) not null default 1,
  reasoning text,
  evidence jsonb not null default '[]'::jsonb,
    -- [{segment_seq, quote, t_start_ms, t_end_ms, verified: bool}]
  insufficient_evidence boolean not null default false
);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  score_id uuid not null references scores(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id),
  action text not null check (action in ('approve','reject','override','skip')),
  skill text,                           -- when overriding one skill
  old_value numeric(2,1),
  new_value numeric(2,1),
  reason text,
  created_at timestamptz not null default now()
);

create view calibration_stats with (security_invoker = true) as
  select s.org_id,
         count(*) filter (where r.action in ('approve','reject','override')) as reviewed,
         count(*) filter (where r.action = 'approve') as agreed
  from reviews r join scores s on s.id = r.score_id
  group by s.org_id;
```

## 7. Agents, runs, steps, approvals

```sql
create table agents (
  id text primary key,                  -- 'scoring','scheduler','comms',...
  name text not null,
  model text,
  skill_path text,                      -- 'agents/scheduler.skill.md'
  tier text not null default 'P0'
);

create table agent_permissions (
  org_id uuid not null references organizations(id) on delete cascade,
  agent_id text not null references agents(id),
  tool text not null,
  level autonomy_level not null default 'ask',
  primary key (org_id, agent_id, tool)
);

create table agent_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  agent_id text not null references agents(id),
  event_id uuid,
  candidate_id uuid references candidates(id) on delete set null,
  status run_status not null default 'queued',
  trigger text,
  tokens_in int, tokens_out int,
  started_at timestamptz, ended_at timestamptz,
  created_at timestamptz not null default now()
);
create index on agent_runs (org_id, created_at desc);

create table agent_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references agent_runs(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  seq int not null,
  tool text not null,
  args jsonb,                           -- redacted
  result jsonb,                         -- redacted
  level autonomy_level not null,
  status step_status not null default 'proposed',
  idempotency_key text unique,
  error text,
  duration_ms int,
  created_at timestamptz not null default now()
);

create table approvals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  step_id uuid not null references agent_steps(id) on delete cascade,
  status approval_status not null default 'pending',
  proposal jsonb not null,              -- what will happen (email text, event, row)
  edited jsonb,
  decided_by uuid references auth.users(id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
```

## 8. Outputs, events, audit, practice

```sql
create table meetings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  candidate_id uuid not null references candidates(id) on delete cascade,
  calendar_event_id text, meet_url text,
  starts_at timestamptz, ends_at timestamptz,
  status text not null default 'proposed' check (status in ('proposed','scheduled','cancelled')),
  created_at timestamptz not null default now()
);

create table outbox (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  candidate_id uuid references candidates(id) on delete set null,
  kind text not null check (kind in ('invite','feedback','digest','other')),
  to_hash text,                         -- hash only; address stays in vault
  subject text, body_preview text,
  gmail_message_id text,
  status text not null default 'draft' check (status in ('draft','sent','failed')),
  created_at timestamptz not null default now()
);

create table events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create table audit_log (
  id bigint generated always as identity primary key,
  org_id uuid not null,
  actor_id uuid,
  actor_kind text not null check (actor_kind in ('user','agent','candidate','system')),
  action text not null,                 -- 'pii.reveal','score.override','approval.decide','connector.revoke'
  target_type text, target_id text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
revoke update, delete, truncate on audit_log from public, anon, authenticated;

create table practice_sessions (
  id uuid primary key default gen_random_uuid(),
  language text, duration_ms int,
  rubric_version text,
  feedback jsonb,                       -- generic feedback, no identity
  email_hash text,                      -- only if user opted in to receive the report
  created_at timestamptz not null default now()
);
```

## 9. Row-level security

```sql
-- Enable RLS everywhere
do $$ declare t text; begin
  for t in select unnest(array[
    'organizations','org_members','connections','playbooks','playbook_versions','roles','candidates',
    'invites','resumes','interviews','transcript_segments','pii_vault','scores','score_items','reviews',
    'agent_permissions','agent_runs','agent_steps','approvals','meetings','outbox','events','audit_log','practice_sessions'])
  loop execute format('alter table %I enable row level security', t); end loop; end $$;

-- Standard org-scoped policy pattern (repeat for tables with org_id):
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
-- score_items: join through scores
create policy items_read on score_items for select using (
  exists (select 1 from scores s where s.id = score_id and is_org_member(s.org_id)));
-- playbook_versions: join through playbooks
create policy pv_read on playbook_versions for select using (
  exists (select 1 from playbooks p where p.id = playbook_id and is_org_member(p.org_id)));
create policy pv_write on playbook_versions for all using (
  exists (select 1 from playbooks p where p.id = playbook_id and is_org_member(p.org_id)))
  with check (exists (select 1 from playbooks p where p.id = playbook_id and is_org_member(p.org_id)));
-- org membership
create policy members_read on org_members for select using (user_id = auth.uid() or is_org_admin(org_id));
create policy org_self_read on organizations for select using (is_org_member(id));

-- NO policies (service role only): connections, pii_vault, transcript_segments, invites, events, practice_sessions.
-- Grant clients only the views: connections_public, transcript_view, calibration_stats.
grant select on connections_public, transcript_view, calibration_stats to authenticated;
```
Writes to `scores`, `score_items`, `agent_*`, `approvals`, `reviews`, `audit_log` happen **only from server route handlers** (service role) so the client cannot forge a score or a log. Reviews and approvals are created through API routes that verify membership first.

## 10. Storage buckets
- `interview-audio` (private). Path: `{org_id}/{interview_id}.webm`. Access via signed URLs (60 seconds) generated server-side after membership check.
- `resumes` (private). `posters` (private, signed URLs).

## 11. Realtime
Enable Realtime on `agent_runs`, `agent_steps`, `approvals`, `scores`, `candidates` (stage). The client subscribes filtered by `org_id`. RLS applies to realtime.

## 12. Seed data (`seed/seed.sql` or a script)
- 1 org ("Demo BPO"), 1 recruiter, 1 playbook (v1 published), 1 role.
- 12 candidates with transcripts, scores, evidence, and audio for 3 of them.
- Edge cases: one low-confidence, one with an unverified quote, one with an injection attempt, one Hinglish.
- Agents table rows and default `agent_permissions`.
- A "Reset demo" server action that truncates demo-org rows and re-seeds.

## 13. Retention job
`pg_cron` daily: delete audio objects and `transcript_segments.text_original_enc` older than `organizations.settings->>'retention_days'` days, keep redacted text and scores. Write an audit event with counts.
