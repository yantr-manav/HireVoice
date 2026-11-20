# Hirevoice — Build Spec v2 (start here)

**Product:** Hirevoice is a voice-first screening assistant for BPOs and staffing agencies. Candidates complete a short, structured interview in a supported language. Hirevoice turns the conversation into an explainable evidence record, routes uncertain cases to a recruiter, and can execute approved follow-up actions in Google Workspace.

**Core promise:** *A candidate proves spoken communication in a few minutes; the recruiter sees the evidence, not just an AI score.*

> **Important correction:** the current hackathon demo architecture (Next.js on Vercel + hosted Supabase + Google APIs) is a managed-cloud deployment. It is **not self-hosted**. A customer-controlled deployment is a separate deployment profile and remains a roadmap item until it is packaged, deployed and tested. Gemini Live sends the candidate's live audio to Google's API; transcript redaction after the Live session does not make the audio stay on the customer's server.

## The three differentiators to protect

1. **Evidence Timeline:** every skill assessment links to one or more transcript excerpts and, only when the candidate consented to recording, the corresponding audio moment.
2. **Playbook Studio:** a recruiter edits a versioned `playbook.md`; Hirevoice validates it, previews the consequences, and only then publishes it. The playbook is configuration, not arbitrary executable code.
3. **Permissioned agent actions:** the agent crew is a set of small capabilities coordinated by a deterministic orchestrator. Read-only work can run automatically; external side effects require approval by default. No automated rejection or hiring decision.

## Build order — solo founder, city buildathon 20–21 Nov 2026

**Do not attempt the entire platform in two days.** The existing screen catalog and schema are a product vision. For the event, ship one complete, reliable path.

### P0 — required end-to-end demo

- Recruiter creates one BPO role from a supplied sample playbook.
- Candidate opens a mobile link, sees consent and microphone checks, and completes 3 questions plus one customer role-play.
- Gemini Live handles the voice conversation. Persist transcript segments with timestamps.
- Gemini scores a small fixed rubric and returns structured scores plus exact transcript quotes.
- Deterministic code verifies every quote against the cited segment. An evidence item that fails verification is visibly marked unverified; it must not count as verified support.
- Recruiter sees the candidate, the skill breakdown, transcript and Evidence Timeline; recruiter can approve or send to human review.
- Playbook Studio can edit one threshold, validate it, simulate the effect on seeded data, and publish a new version.
- One real Workspace action only, chosen after it has been tested end-to-end: **Calendar event with Meet link OR Gmail draft/send**. The action starts in `ask` mode and runs only after the recruiter approves it.
- A replay/demo route exists as a fallback if venue Wi-Fi, microphone permissions or Live API fail.

### P1 — only after P0 is stable

- Gemma-based local transcript PII detection, running as a separate privacy service; regex redaction remains the deterministic baseline.
- Candidate coaching summary (not a hiring verdict).
- Sheets export, the second Workspace action, and a small approvals inbox.
- Agent run trace and audit timeline.

### P2 — roadmap, not event commitments

- Drive resume intake, Forms, Gmail inbox ingestion, Docs, Slack/Jira, multi-role analytics, multi-region deployment, full Docker/BYOC installer, self-hosted database/auth/storage, local-only voice stack.

**Cut line:** if the live interview → transcript → score → verified evidence → recruiter review path is unstable, stop adding integrations. A working 1-path demo is better than six half-connected services.

## Architecture decisions (source of truth)

| Concern | Hackathon demo | Later customer deployment |
|---|---|---|
| Web app | Next.js App Router on Vercel | Container on the customer's Cloud Run, GKE or VM environment |
| Database/auth/storage | Hosted Supabase (Postgres, Auth, Storage, Realtime) | Cloud SQL/Postgres + chosen auth/storage, or a separately tested self-hosted Supabase stack |
| Live voice | Browser connects to Gemini Live using a short-lived, server-issued ephemeral token | Still a Google-hosted API unless a separate local speech stack is built |
| Scoring | Gemini API through a server route/job | Customer's own Google project and credentials |
| PII detection | Regex first; optional Gemma service if it is actually running | Gemma inside customer-controlled network, if deployment supports it |
| Workspace | User-consented OAuth connection | Same Google OAuth model; admin approval and production verification may be required |

Do not say “fully private”, “nothing leaves your server”, “zero hallucinations”, “bias-free”, or “DPDP compliant”. Accurate wording: **“We minimise and redact transcript identifiers before scoring, keep recruiter actions permissioned, and show the evidence behind each assessment. Gemini Live processes the live voice stream through Google's API.”**

## Google AI implementation notes (checked 19 Nov 2026)

- The current Google Gemini Live API overview lists **`gemini-3.8-live`** as a generally available recommended low-latency voice model. The current Live language documentation includes Hindi (`hi-IN`) and Marathi (`mr-IN`). Test real accents, code-switching, device audio and latency with your actual prompt before promising language coverage.
- The Google AI Studio ephemeral-token guide shows a server-created token with `liveConnectConstraints`, and the client connects using the token. The current guide uses `v1beta`; do not copy older `v1alpha` snippets without checking the SDK version you install. Ephemeral-token support is documented as preview; pin the SDK version and test reconnection.
- Use the model as an interviewer, not as the decision-maker. Keep question order, interview duration, scoring thresholds, approvals and stage changes in application code.
- Gemma is an open model that can run locally, for example through Ollama. Treat local PII detection as an optional service until you benchmark the selected model on your hardware. It is not a substitute for deterministic regex, access controls or a privacy review.

## Tech stack

- **Frontend/API:** Next.js App Router, TypeScript strict mode, Tailwind.
- **UI:** shadcn/ui for accessible primitives; 21st.dev for selected composition references; React Bits sparingly (one or two effects, not every screen); Motion for restrained interaction.
- **Data:** Supabase Postgres/Auth/Storage/Realtime; Zod at API boundaries.
- **AI:** `@google/genai`; Gemini Live for voice; Gemini for structured scoring and draft generation; Gemma via a separately deployed Ollama service only when verified.
- **Workspace:** `googleapis` for Calendar, Gmail and later Drive/Sheets/Forms.
- **Runtime:** deterministic TypeScript state machine + tool registry. Do not build a swarm of autonomous agents for the demo.

## Repository layout

```text
hirevoice/
  AGENTS.md
  docs/00_README_START_HERE.md ... docs/08_BUILDATHON_JUDGE_AND_VALIDATION.md
  app/
    (marketing)/page.tsx
    demo/page.tsx
    i/[token]/page.tsx
    app/(desk)/page.tsx
    app/(desk)/roles/[roleId]/...
    app/(desk)/review/page.tsx
    app/(desk)/playbooks/[id]/page.tsx
    api/interviews/...
    api/pipeline/...
    api/integrations/google/...
  components/hv/ (Booth, EvidenceTimeline, ReviewPanel, PlaybookEditor)
  lib/ai/ (live.ts, scoring.ts, verify.ts, privacy.ts, playbook.ts)
  lib/agents/ (orchestrator.ts, registry.ts, tools/)
  lib/google/ (oauth.ts, calendar.ts, gmail.ts)
  lib/security/ (crypto.ts, invite.ts, rate-limit.ts)
  supabase/migrations/
  services/privacy/ (optional Gemma wrapper)
  playbooks/
  seed/
```

## Environment variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=       # server only
GEMINI_API_KEY=                  # server only; never NEXT_PUBLIC_
GEMINI_LIVE_MODEL=gemini-3.8-live
GEMINI_SCORING_MODEL=            # choose and test in AI Studio
GEMINI_FAST_MODEL=               # choose and test in AI Studio
GEMMA_SERVICE_URL=               # optional private service
GEMMA_SERVICE_TOKEN=             # service-to-service auth
GEMMA_MODEL=                     # pin the Ollama tag after testing
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI=
TOKEN_ENC_KEY=                   # 32 bytes; encrypt Workspace refresh tokens
INVITE_HMAC_SECRET=
APP_URL=
DEMO_MODE=true
```

## Before implementation

1. Confirm the organisers' rules on pre-written code and reuse of NexHire/AgentBay. Do not hide reused code; disclose it if asked.
2. Pin a tested `@google/genai` version and verify the `v1beta` ephemeral-token flow end-to-end.
3. Test Hindi + English + Hinglish with headphones and a phone. Add Marathi only after a real test.
4. Create the Google OAuth app and add your own account as a test user. Ask for only the scopes needed for the selected demo action.
5. Run the full candidate journey on a phone before spending time on the recruiter analytics or agent-crew animations.
6. Get at least one recruiter conversation. Candidate usage alone validates usability, not whether a BPO will pay.

## Read order

1. This file — scope and architecture decisions.
2. `01_PRODUCT_AND_FEATURES.md` — workflows and agent capabilities.
3. `02_UI_UX_DESIGN.md` — screen design.
4. `03_SYSTEM_ARCHITECTURE.md` — data flow, Live API, privacy, security.
5. `04_DATABASE_SCHEMA.md` — schema; apply only the tables needed for P0.
6. `05_BACKEND_AND_AGENTS.md` — routes, scoring, playbook, tool registry.
7. `06_IMPLEMENTATION_PLAN.md` — realistic 2-day build sequence.
8. `07_AI_BUILD_PROMPTS.md` — prompts and project rules.
9. `08_BUILDATHON_JUDGE_AND_VALIDATION.md` — validation, metrics and pitch proof.
