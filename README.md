# Hirevoice

Voice-first screening for BPO and staffing teams. A candidate speaks for four minutes. A recruiter sees a rubric score tied to the exact transcript moment behind it — and makes the call.

Built with Next.js App Router, TypeScript, Tailwind CSS v4 and Supabase. Deployable to **Google Cloud Run (`asia-south1`)**.

---

## Start here

```bash
npm install
cp .env.example .env.local     # optional: the demo runs without credentials
npm run dev
```

Open <http://localhost:3000>.

### Demo path (no account)

1. **Open demo** on the landing page → `/api/demo/enter` sets a signed demo cookie and opens `/app`.
2. **`/app/roles/role-support/candidates/cand-sana`** — clean evidence: 7/7 quotes verified.
3. **`/app/roles/role-support/candidates/cand-rahul`** — one failed quote, low evidence quality, routed to human review.
4. **`/app/voice`** — say or type “schedule Sana tomorrow at 3 with Meet”; approve the one write. Or press `⌘J` / `Ctrl+J` anywhere.
5. **`/app/mail`** and **`/app/calendar`** — labelled demo inbox and calendar until Google is connected.
6. **`/app/crew?tab=approvals`** — inspect a payload before approving it.
7. **`/app/playbooks/support-exec`** — change a threshold, simulate against stored scores.
8. **`/practice`** — the candidate booth, mobile-first, with a mic check and a private self-review.

The judge-oriented walkthrough lives at **`/demo`**.

---

## What is real vs seeded

| Area | State |
|---|---|
| UI, routing, responsive layouts, keyboard shortcuts | Working |
| Supabase email/password + magic-link auth, SSR session, callback, sign-out | Working when env keys are set |
| Demo workspace | Seeded `lib/demo/data.ts`; clearly labelled in the UI |
| Candidate booth | Browser mic level + Web Speech transcript where supported; questions are fixed |
| Voice commands (Vaani) | Browser speech-to-text or typing → server plan → read steps run, writes wait for approval |
| Gmail, Calendar + Meet, Drive, Docs, Sheets | Real Google APIs once an OAuth client is configured and an account is connected; otherwise labelled demo data |
| Agent actions, decisions, audit | Persisted in SQLite locally; every write is `proposed → approved → executed/rejected/failed` |
| Gemini / Gemma routing | Multi-key rotation and model fallback when keys are set; deterministic local parser when they are not |
| Gemini Live interviewer | Token route is wired; not connected in this build |
| Scoring, quote verification, agents | Represented by the seeded model; pipeline routes are the next step |
| Database schema, RLS, views | `supabase/migrations/0001_init.sql` + `0002_agent_actions.sql` |
| Cloud Run container + Cloud Build config | Complete; deploy steps in `docs/deploy-cloud-run.md` — not deployed from this workspace |

No screen claims the product is live on Gemini, fully deployed, or free of bias. The copy names the limits on purpose.

---

## Stack

- **Next.js 16** (App Router, standalone output, server components)
- **React 19**, **TypeScript** strict
- **Tailwind CSS v4** with design tokens in `app/globals.css`
- **Supabase** — Auth, Postgres, RLS, Storage (production target)
- **SQLite** (`node:sqlite`) — working local store for connector tokens, decisions, agent actions, audit, local events and model key health; same table shapes as the Postgres migrations
- **Radix UI** primitives, **cmdk**, **CodeMirror**, **qrcode.react**, **sonner**, **Zod**
- **Fonts** — Bricolage Grotesque (display), Geist (UI), Geist Mono (timestamps), Noto Sans Devanagari

### Design language

Two rooms, one loop:

- **The desk** — light, dense, audited. Chalk `#EEF1F5`, paper `#FAFBFC`, ink `#101A2C`, ultramarine `#3347F5`.
- **The booth** — dark, single-purpose. Booth `#0B1030`, raised `#141B47`, glow `#8FA0FF`, mist `#C9D0F0`.
- Verified quotes are green with a filled marker. Unverified quotes are dashed and hollow — never hidden in a tooltip.

---

## Routes

| Route | Purpose |
|---|---|
| `/` | Product landing page |
| `/sign-in` | Supabase auth |
| `/auth/callback` | OAuth / magic-link exchange |
| `/api/demo/enter` | Enter the seeded demo workspace |
| `/app` | Recruiter desk: today, queue, live feed |
| `/app/voice` | **Vaani voice desk** — speak a command, review the plan, approve writes |
| `/app/mail` | Gmail inbox, reading pane, reply, compose, AI draft |
| `/app/calendar` | Month, week and agenda in IST; schedule interviews with Meet |
| `/app/onboarding` | Four-step role creation |
| `/app/roles` | Roles list |
| `/app/roles/[roleId]` | Pipeline, playbook, invite, settings |
| `/app/roles/[roleId]/candidates/[candidateId]` | **Evidence timeline** (signature screen) |
| `/app/review` | Review queue with keyboard shortcuts |
| `/app/playbooks` · `/app/playbooks/[playbookId]` | Playbook Studio |
| `/app/crew` | Agents, approvals, runs, **agent actions**, permissions |
| `/app/connections` | Google Workspace connection, scopes and health |
| `/app/analytics` | Funnel, distribution, evidence quality |
| `/app/settings` | Profile, workspace, retention, data controls |
| `/app/ask` | Read-only workspace search |
| `/i/[token]` | Candidate invite booth |
| `/practice` | Private practice booth |
| `/r/[token]` | Candidate-facing interview report |
| `/demo` | Judge guide and known limits |

---

## Environment

Copy `.env.example` to `.env.local`. All values are optional for the demo.

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # legacy JWT, optional
SUPABASE_SERVICE_ROLE_KEY=      # server only
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Postgres for the runtime tables (agent actions, audit, tokens, events).
# Percent-encode the password. Use the session pooler on serverless.
DATABASE_URL=
SUPABASE_DB_URL=                # optional direct fallback

# Google Workspace (Gmail, Calendar + Meet, Drive, Docs, Sheets)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/google/callback
CONNECTOR_ENCRYPTION_KEY=       # 32-byte base64; AES-256-GCM

# Gemini / Gemma. One key is enough; add more to spread quota.
GEMINI_API_KEY=
GEMINI_API_KEYS=                # comma separated
GEMMA_API_KEYS=
GOOGLE_AI_API_KEYS=
# AI_MODEL_FAST / DEEP / SMALL / GEMMA / COMMAND / LIVE override defaults.

HIREVOICE_TRACKER_SHEET_ID=     # optional "append to tracker" sheet
CRON_SECRET=
```

`NEXT_PUBLIC_*` values are inlined into the browser bundle at build time. Rotating them requires a rebuild, not just an env change.

### What works without keys

- **No Google OAuth client** — Mail and Calendar show clearly labelled demo data. Send, invite and Meet actions are disabled or marked as local; nothing pretends to leave the app.
- **No Gemini/Gemma keys** — Voice commands are planned by a deterministic local parser; email drafts use built-in templates. `/api/ai/status` reports `configured: false`.
- **No Supabase** — the demo cookie opens the seeded workspace. With Supabase credentials, `proxy.ts` refreshes the session on every request and the normal auth flow is used.

---

## Database

Runtime data (encrypted Google tokens, recruiter decisions, agent actions and approvals, audit events, local calendar events, workspace files) is stored in **Supabase Postgres** when `DATABASE_URL` is set. `lib/db/repo.ts` is a single async repository with two backends; SQLite remains the automatic fallback for the demo and offline work.

```bash
npm run db:check      # connection + public table count
npm run db:migrate    # apply supabase/migrations/*.sql once, in order
npm run db:tables     # list public tables
```

If you do not have the database password, paste `supabase/all-migrations.sql` into the Supabase SQL editor once. It contains 0001, 0002 and 0003 in order.

Without a database URL, SQLite lives at `%TEMP%/hirevoice-data/hirevoice.db` (override with `HIREVOICE_DATA_DIR`, or set `HIREVOICE_DB=:memory:` for a throwaway run). It is intentionally outside the project tree so a dev file watcher does not reload the app every time WAL updates `-shm`. On Cloud Run, `/tmp` is the writable path, but local SQLite is per-instance: use Postgres for anything real.

The schema follows `Hirevoice_Spec_v2/04_DATABASE_SCHEMA.md`: tenancy, playbooks, roles, candidates, invites, interviews, redacted transcripts, an encrypted PII vault, scores and evidence, agents/runs/steps/approvals, audit log and practice sessions. RLS is enabled on every table; transcripts and PII are readable only through views, and the audit log is append-only. The runtime tables have RLS with no permissive policies, so the browser cannot read them directly; the server uses the direct Postgres connection.

`/api/integrations` reports `store.active: "postgres" | "sqlite"` and never claims Postgres when the connection failed. In development a failed connection falls back to SQLite with a server warning; in production it fails loudly rather than splitting data.

### Agent actions

A voice or UI command becomes an `AgentPlan`: a short list of tool calls. Read-only tools (`list_review_queue`, `mail_search`, `calendar_today`, …) execute immediately. Every write (`send_email`, `schedule_interview`, `shortlist_candidate`, `append_sheet`, …) is persisted as `proposed` and runs once, after a recruiter approves it. Rejection and failure are stored too. A model can never reject a candidate.

Google calls are server-side with refreshed OAuth tokens. If a Google API fails, the API returns demo data plus a `warning`, and the UI labels it as demo rather than claiming success.

---

## Scripts

```bash
npm run dev        # local dev
npm run typecheck  # tsc --noEmit
npm run build      # production build (standalone)
npm run start      # serve the production build
```

---

## Deploy

```bash
gcloud builds submit --config cloudbuild.yaml \
  --substitutions=_SUPABASE_URL="https://<ref>.supabase.co",_SUPABASE_ANON_KEY="<anon-key>",_SITE_URL="https://<service-url>"
```

Full setup — Supabase auth URLs, Artifact Registry, Secret Manager, sizing, rollback and troubleshooting — is in [`docs/deploy-cloud-run.md`](docs/deploy-cloud-run.md).

---

## Guardrails

- A score never rejects a candidate. The router can suggest shortlist or route to human review.
- External writes (email, calendar, sheet) show the payload and wait for one approval.
- Recording consent is separate from participation. Saying no keeps the interview available.
- Evidence quality is a heuristic over verified quotes, consistency, coverage and transcript quality. It is not a probability of job performance.
- Quote matching proves the words exist. It does not prove the rubric is fair.

The seeded candidates are fictional. The demo is safe to click through; nothing leaves the app.
