-- ---------------------------------------------------------------------------
-- 0004 · Live completed interviews, drive queue tokens & commitment tracking
-- ---------------------------------------------------------------------------

create table if not exists live_candidates (
  id text primary key,
  org_id uuid references organizations(id) on delete cascade,
  role_id text not null,
  source text not null default 'invite',
  drive_token text,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists live_candidates_created_idx on live_candidates (created_at desc);
create index if not exists live_candidates_role_idx on live_candidates (role_id);

alter table live_candidates enable row level security;
