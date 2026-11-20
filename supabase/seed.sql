-- Hirevoice · seed for local development and the Cloud Run pilot.
-- Run after 0001_init.sql: supabase db reset, or paste into the SQL editor.

insert into agents (id, name, model, skill_path, tier) values
  ('scoring',   'Scoring agent',   'gemini-2.5-flash', 'agents/scoring.skill.md',   'P0'),
  ('verifier',  'Quote verifier',  null,                'agents/verifier.skill.md',  'P0'),
  ('router',    'Decision router', null,                'agents/router.skill.md',    'P0'),
  ('scheduler', 'Scheduler',       'gemini-2.5-flash', 'agents/scheduler.skill.md', 'P1'),
  ('comms',     'Candidate comms', 'gemini-2.5-flash', 'agents/comms.skill.md',     'P1')
on conflict (id) do nothing;

-- Creates a demo organisation for the first auth user in the project.
-- Sign up once in the app, then run this block. Safe to skip for production.
do $$
declare
  uid uuid;
  org uuid;
  pb uuid;
  rl uuid;
begin
  select id into uid from auth.users order by created_at limit 1;
  if uid is null then
    raise notice 'No auth user found. Sign up in the app first, then re-run this block.';
    return;
  end if;

  select m.org_id into org from org_members m where m.user_id = uid limit 1;
  if org is null then
    insert into organizations (name, settings)
    values ('Demo BPO', '{"retention_days": 14, "anonymised_default": true}'::jsonb)
    returning id into org;
    insert into org_members (org_id, user_id, role) values (org, uid, 'owner');
  end if;

  insert into playbooks (org_id, name, current_version)
  values (org, 'Support executive', 1)
  returning id into pb;

  insert into playbook_versions (playbook_id, version, markdown, published, created_by)
  values (pb, 1,
    '# Support executive' || chr(10) ||
    'Four minutes, three questions, one role-play.' || chr(10) ||
    'Skills: clarity, empathy, listening, problem solving.' || chr(10) ||
    'Shortlist rule: overall >= 3.8 and evidence quality >= 70%.' || chr(10) ||
    'Auto-reject: never.',
    true, uid);

  insert into roles (org_id, playbook_id, playbook_version, title, languages, status, public_slug)
  values (org, pb, 1, 'Customer Support Executive · voice', '{hi,en,hinglish}', 'open', 'support-exec')
  returning id into rl;

  insert into agent_permissions (org_id, agent_id, tool, level) values
    (org, 'scoring',   'score.interview',        'ask'),
    (org, 'verifier',  'transcript.verify_quote', 'auto'),
    (org, 'router',    'candidate.route',        'auto'),
    (org, 'scheduler', 'calendar.create_event',  'ask'),
    (org, 'scheduler', 'email.send_invite',      'ask'),
    (org, 'comms',     'email.send_feedback',    'ask')
  on conflict (org_id, agent_id, tool) do nothing;

  raise notice 'Seeded org % with role %.', org, rl;
end $$;
