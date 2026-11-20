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

