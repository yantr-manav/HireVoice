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
