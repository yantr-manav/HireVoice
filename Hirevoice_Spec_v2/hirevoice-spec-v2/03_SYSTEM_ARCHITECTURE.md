# 03. System Architecture

## 1. Overview

```mermaid
flowchart LR
  subgraph Browser
    C[Candidate Booth<br/>mic + captions + optional local recording]
    R[Recruiter Desk]
  end
  subgraph ManagedDemo[Managed demo: Vercel + Supabase]
    API[Next.js route handlers]
    ORCH[Deterministic orchestrator + rules engine]
    DB[(Supabase Postgres / Auth / Storage / Realtime)]
  end
  subgraph GoogleCloud[Google APIs] 
    LIVE[Gemini Live API]
    GEN[Gemini scoring / parsing]
    WS[Workspace APIs: Calendar, Gmail, Drive, Sheets, Forms]
  end
  subgraph OptionalPrivate[Optional private service]
    PRIV[Regex + Gemma PII service]
  end
  C -- short-lived ephemeral token --> API
  C <-- direct audio WebSocket --> LIVE
  LIVE -- transcript events --> C
  C -- transcript segments --> API
  C -- optional consented recording --> DB
  API --> DB
  API --> PRIV
  API --> GEN
  ORCH --> WS
  ORCH --> DB
  R <-- scoped realtime --> DB
  R --> API
```

**Important data boundary:** in the low-latency Live API design, the browser streams candidate audio directly to Google's Live API. Vercel, Supabase and a local Gemma service do not sit in front of that audio stream. The browser receives transcription events and sends transcript segments to the application. If audio playback is enabled, the browser separately uploads a recording to private storage after the candidate has explicitly consented. Transcript redaction cannot anonymise a voice recording.

**Design principles**
1. **Rules engine decides, models advise.** The LLM produces structured assessments; deterministic code applies the playbook. It never hires, rejects or sends external actions on its own.
2. **Minimise identity exposure.** Redact transcript identifiers before scoring; separate candidate identity from the scoring view. Redaction is best-effort, not perfect anonymisation.
3. **Ground evidence, do not overclaim.** Quote matching proves that a phrase exists in the stored transcript; it does not prove the interpretation is correct, the transcript is accurate, or the assessment is fair.
4. **Permissioned side effects.** External writes default to `ask`; every action is idempotent and audited.
5. **Candidate consent and human control.** No audio recording without a separate explicit consent choice. No automated rejection or final hiring decision.
6. **Fail visibly.** Any failed step shows an error and fallback, never a silent drop.

## 2. Deployment topology

There are two different product targets. Do not describe the hackathon deployment as self-hosted.

### A. Hackathon demo (the build target)

| Component | Where | Notes |
|---|---|---|
| Web app + API | Vercel (Next.js) | Short request/response routes only; no long-running in-process worker dependency |
| Database, Auth, Storage, Realtime | Hosted Supabase | RLS on every tenant table; private audio bucket; service-role key on server only |
| Live voice | Gemini Live API | Browser connects directly using a short-lived token issued by the server |
| Scoring | Gemini API | Triggered after transcript completion; bounded request or a durable queue if needed |
| PII service | Optional Cloud Run/VM | Gemma via Ollama only if benchmarked; regex redaction is the fallback |
| Workspace | Google APIs | Separate user OAuth connection; ask for only required scopes |

### B. Customer-controlled cloud (future BYOC profile)

- Run the Next.js app/API in the customer's Google Cloud project (for example Cloud Run, GKE or a VM/container platform).
- Use Cloud SQL/Postgres, Cloud Storage and Secret Manager, or a fully tested self-managed Supabase deployment. Do not imply that hosted Supabase magically moves into the customer's VPC.
- Run the optional Gemma service behind private ingress in the customer's environment.
- Use the customer's Google OAuth configuration and Gemini credentials.
- **Gemini Live still sends live audio to Google's API.** Customer-owned credentials/project do not mean the voice model runs locally. A strict local-only voice mode would require a separate speech stack and is not part of this build.

### C. Fully self-hosted / air-gapped

Not supported by the hackathon build. It would require replacing Gemini Live and any cloud inference with local speech recognition, local LLM, local TTS, local storage and a separate Workspace/network access design. Keep this as a clearly labelled future architecture.

**Pitch line:** "The demo runs on Vercel and Supabase. Our planned BYOC edition will move the application data and privacy service into a customer's Google Cloud environment; Gemini Live voice processing remains a Google API call unless the customer selects a local voice stack."

Do not make a `docker-compose.yml` the headline differentiator. A Compose file with the app, Postgres and Ollama is a developer preview, not a production-grade enterprise self-host product.

## 3. Live interview pipeline (Gemini Live)

### 3.1 Connection pattern
1. Candidate opens `/i/[token]`. Server validates the invite (unguessable token hash, expiry, usage limit and consent state).
2. Browser calls `POST /api/interviews/start`. The server creates the `interviews` row and returns only the minimum session configuration plus an **ephemeral Live API token**. Never return the long-lived Gemini API key.
3. Browser connects directly to Gemini Live over WebSocket using `@google/genai`. Candidate audio is sent to Google Live; the app server does not proxy the raw stream.
4. For Google AI Studio / Gemini API, the current official token guide uses `v1beta` and documents `liveConnectConstraints` to lock the model and allowed Live configuration. As checked on 19 Nov 2026, the current generally available recommended Live model is `gemini-3.8-live`. Pin the tested `@google/genai` version and keep model IDs in environment variables.
5. Ephemeral token creation is documented as preview. Set a short `newSessionExpireTime` and `expireTime`, `uses: 1`, and `sessionResumption` only if tested. Test a disconnect and reconnect on the actual venue network; do not assume resumption works simply because token creation succeeds.

### 3.2 Audio
- Capture: `getUserMedia` then **AudioWorklet** to 16-bit PCM at 16 kHz mono. Send in ~100 ms chunks.
- Playback: receive 24 kHz PCM. Queue into an `AudioContext` buffer with gapless scheduling. Support **barge-in**: if the candidate starts speaking, clear the playback queue.
- Audio recording is optional and requires a separate, explicit consent toggle. If consent is absent, store transcript-only evidence and hide audio playback controls. If enabled, record locally with `MediaRecorder`, upload on finish to a private bucket via a short-lived signed URL, and display the retention period in the consent screen. Voice is identifying biometric-like data; transcript PII redaction does not remove identity from audio.

### 3.3 Config (conceptual)
```ts
{
  model: process.env.GEMINI_LIVE_MODEL,
  config: {
    responseModalities: ['AUDIO'],
    systemInstruction: interviewerPrompt,      // from playbook, see file 05
    inputAudioTranscription: {},               // candidate transcript
    outputAudioTranscription: {},              // Vaani transcript
    tools: [{ functionDeclarations: [nextQuestion, repeatQuestion, endInterview] }],
    // session resumption + context window compression: enable per docs
  }
}
```
- **Function calling drives structure.** The model calls `next_question(index)` and `end_interview(reason)`. The browser handles the call, updates the UI progress, and returns the tool response. This keeps the interview on script and gives the UI exact question boundaries.
- **Language policy** in the prompt: reply in the candidate's language, accept Hinglish, never comment on accent, never reveal scores or the rubric.
- **Time cap:** hard cap per playbook (for example 5 minutes). Browser enforces and calls `end_interview`.
- **Resumption:** implement only after a real end-to-end test. The browser stores the current question index in application state; the model does not choose arbitrary next questions. On a reconnect, restore the session handle if supported, otherwise restart from the last completed question with a clear candidate-facing message.

### 3.4 Transcript persistence
- The browser batches transcription events into **segments** `{seq, speaker, text, t_start_ms, t_end_ms, lang}` and POSTs every 5 seconds and on end (`POST /api/interviews/:id/segments`, idempotent by `(interview_id, seq)`).
- Run redaction before persisting the scoring copy. Prefer storing only redacted transcript text. If raw text must be retained for a short operational reason, encrypt it at the application layer, restrict it to service-role access, and delete it on a short, configured TTL.
- **ASR quality check:** flag segments with very low text-to-duration ratio or long silence in the Flags lane.

### 3.5 Fallback if Live is unreliable (decide tonight)
`Record full audio → upload → Gemini audio understanding for transcript + diarisation → same scoring pipeline.` The Booth shows a standard recorder UI with the same questions read aloud via text-to-speech (browser `speechSynthesis`). Less magical but demo-safe. Also keep **Replay mode** (a recorded interview) for the pitch.

## 4. Privacy pipeline (Gemma + vault)

```
raw segments ─► [1] regex scrub ─► [2] Gemma NER (names, orgs, addresses) ─► redacted text
                       │                         │
                       └──────► pii_vault (token ↔ original), service-role only
```
1. **Regex scrub (deterministic):** phone numbers (Indian formats), emails, Aadhaar-like 12-digit, PAN, URLs, long numeric IDs. Fast and reliable.
2. **Gemma pass (local):** find person names, institutions, employers, addresses the regex missed. Prompt returns JSON spans only (never rewrites text). The code replaces spans with tokens such as `[NAME_1]`.
3. Store `text_redacted` on each segment. Store the mapping in `pii_vault`.
4. **Latency note:** a small Gemma model on CPU can be slow. Run regex first (instant), then Gemma asynchronously. The UI shows "redacting…" with a shimmer. Scoring waits for both.
5. **Never claim perfect redaction.** Say "removes personal identifiers before scoring" and show a redaction report (counts by type).

**Other Gemma jobs (private work):** resume field extraction, language detection, prompt-injection screening (Shield).

## 5. Scoring pipeline (anti-hallucination design)

1. **Input:** redacted transcript (candidate turns with segment ids), rubric from the playbook, role context.
2. **Pass A. Score:** Gemini scoring model with **JSON schema output**. For each skill: `score (1 to 5)`, `reasoning`, and `evidence[] {segment_seq, quote}`. Temperature low.
3. **Pass B. Verify (code, not LLM):**
   - Each `quote` must appear in the cited segment's `text_redacted` (normalised whitespace, case-insensitive, Devanagari-safe). Unverified quotes are marked.
   - A skill with zero verified evidence is capped at "insufficient evidence" and routed to review.
4. **Optional consistency check:** if latency and budget allow, score a small labelled sample twice and compare score stability. Do not run a second model pass for every event candidate unless it is needed.
5. **Aggregate (code):** calculate a weighted rubric summary only when required skills have sufficient verified evidence. Show per-skill scores and missing evidence; never present one number as a final hiring decision.
6. **Evidence quality signal (code):** do not use model-reported confidence as a calibrated probability. Build a transparent heuristic from verified quote coverage, transcript coverage/audio quality, rubric coverage and (when available) independent-run disagreement. Label it **evidence quality**, not a probability that the candidate is good or that the score is correct. Calibrate it against human-reviewed examples before displaying a numeric percentage.
7. **Route (rules engine):** apply the playbook's decision rules (see file 05) to `overall` and `evidence_quality`. Outputs: `shortlist_suggested`, `needs_review`, `feedback_suggested`. **No auto-reject.**
8. **Instruction-boundary handling:** candidate speech is always untrusted content, never system or tool instructions. The interviewer has no access to recruiter tools. An optional classifier may flag instruction-like phrases for review, but do not silently delete candidate words from the transcript or penalise a candidate merely for saying them.

## 6. Agent orchestration

### 6.1 Concepts
- **Event:** `interview.completed`, `score.ready`, `candidate.shortlisted`, `drive.file_added`, `form.response_added`, `approval.decided`, `schedule.tick`.
- **Playbook trigger:** a compiled rule `on <event> if <condition> then <actions>`.
- **Run:** one execution of one agent for one event. Contains **steps** (tool calls).
- **Tool:** typed function with a zod schema, required scopes, a side-effect class (`read`, `write_internal`, `write_external`), and an approval default.
- **Autonomy level per (agent, tool):** `suggest` (shows a proposal, nothing executes), `ask` (creates an approval), `auto` (executes). The org can change it in the matrix. Some tools are capped (`reject_candidate`, `delete_*` can never be `auto`).

### 6.2 Orchestrator loop (TypeScript, P0)
```
onEvent(e):
  rules = compiled_playbook.triggers.filter(t => t.event == e.type && eval(t.if, e.context))
  for rule in rules:
    run = createRun(agent=rule.agent, event=e)
    for action in rule.actions:
      tool = registry[action.tool]
      level = autonomy(org, rule.agent, tool)
      step = recordStep(run, tool, args, level)
      if level == suggest: step.status = proposed; continue
      if level == ask:     createApproval(step); step.status = awaiting; continue
      result = await runWithRetry(tool, args)       // timeout 15s, 2 retries
      step.status = ok|failed; step.result = redact(result)
  emit realtime updates (Supabase inserts)
```
- Approvals resume the step via `POST /api/approvals/:id/decide`.
- **Idempotency:** each step has an `idempotency_key` (`run_id + tool + hash(args)`) so retries never send two emails.
- **The LLM is used inside tools** (for example, "draft email text"), not for choosing control flow.

### 6.3 Scaling the Crew to "other Google stuff"
A new capability = (1) a tool file `lib/agents/tools/<name>.ts`, (2) an `agents/<name>.skill.md`, (3) a playbook action keyword. No other code changes. Examples to show on the roadmap slide: Docs (offer letters), Meet transcripts (post-interview notes), Chat/Slack notifications, Tasks.

## 7. Google Workspace integration

### 7.1 OAuth flow (do not use Supabase sign-in scopes for this)
- Sign-in uses Supabase Auth with Google (basic profile only).
- **Connecting Workspace is a separate OAuth flow** in your own route handlers: `/api/integrations/google/start` → Google consent (`access_type=offline`, `prompt=consent`, `include_granted_scopes=true`) → `/api/integrations/google/callback`.
- Store the refresh token **encrypted** (AES-256-GCM with `TOKEN_ENC_KEY`) in `connections`. Never expose tokens to the client.
- Request scopes **per connector** (incremental authorisation), so the Integrations screen can show what each toggle means.

### 7.2 Scopes by connector
| Connector | Scope | Notes |
|---|---|---|
| Gmail (send) | `gmail.send` | Enough for invites and digests |
| Calendar + Meet | `calendar.events` | Create events; Meet link via `conferenceData.createRequest` with `conferenceDataVersion=1` |
| Drive | `drive.file` for files created by or explicitly selected/opened with the app | Do not request broad Drive read access for the demo |
| Sheets | `spreadsheets` | P1 only; request when the recruiter enables export |
| Forms | relevant `forms.body` / `forms.responses.readonly` scopes | P2 only; not needed for the first demo |
| Docs (P2) | `documents` | Offer letters, reports |

Some user-data scopes are sensitive or restricted. Public production apps may need OAuth verification and, for restricted scopes, additional security review. For the event, use Testing mode with explicitly added test users and the smallest scope set possible. A test-mode OAuth setup is not production approval.

### 7.3 Key API calls
- **Send email:** `gmail.users.messages.send` with a base64url RFC 2822 message (HTML + text parts).
- **Interview + Meet:** `calendar.events.insert` with `attendees`, `conferenceData: { createRequest: { requestId, conferenceSolutionKey: { type: 'hangoutsMeet' } } }`, `conferenceDataVersion: 1`, `sendUpdates: 'all'`. Check availability first with `freebusy.query`.
- **Sheets:** `spreadsheets.values.append` (valueInputOption `USER_ENTERED`). Create the "Hiring Tracker" with a header row on first connect.
- **Drive intake:** `files.list` (parent folder, modified since last sync) → `files.get(alt=media)` → Gemini document understanding for parsing → redact → store. Poll via pg_cron or the "Sync now" button.
- **Forms:** `forms.create` then `forms.batchUpdate` to add questions. `forms.responses.list` for answers (poll).
- **Rate limits and quotas:** wrap every call in retry with exponential backoff. Surface quota errors in the UI.

## 8. Security and compliance

- **Multi-tenancy:** every table has `org_id` with RLS using `is_org_member(org_id)`. Server uses the service role only in route handlers, never in the client.
- **Candidate access:** public pages use signed invite tokens (HMAC-SHA256, random 128-bit id, stored hashed, expiry, single-use for interviews). No Supabase session for candidates.
- **Secrets:** env only. Tokens encrypted at rest. Rotate `TOKEN_ENC_KEY` by versioned keys (`kid` column).
- **Audit log:** append-only `audit_log` (no update/delete grants). Logs PII reveals, overrides, approvals, connector changes, exports, deletes.
- **Rate limiting:** by IP and token on public endpoints (Supabase table counter or Upstash Redis).
- **Input safety:** zod validation on every route. Max body sizes. Content-type checks on uploads.
- **Browser:** strict CSP, `Permissions-Policy` for microphone only on Booth routes.
- **Consent and retention:** store separate consent flags and text versions for (a) Gemini Live voice processing and (b) audio recording/playback. Audio recording is off by default. Retention is configurable and visible before the interview; deletion should cover audio, raw transcript, redaction vault and derived records according to policy. Provide a candidate deletion/request channel.
- **Fairness:** do not score accent, dialect, perceived identity, age, gender or background. Define each rubric dimension with observable, job-related anchors. For communication skills, measure comprehension, task-relevant clarity and response relevance; do not equate accent or grammar with ability. Show the human reviewer the evidence and allow overrides with reasons.
- **Regulatory note for the pitch:** say the product is being designed around consent, data minimisation, access controls and deletion. Do not claim legal compliance or certification; obtain a qualified review before real hiring use.

## 9. Observability
- Structured logs with `run_id` and `interview_id` on every line.
- `agent_runs` and `agent_steps` double as the product's trace UI.
- Basic metrics: interview completion rate, time to score, verifier failure rate, token use per interview, cost per interview (shown in Analytics for the business-model slide).

## 10. Self-host bundle (P1)
```yaml
# docker-compose.yml (sketch)
services:
  app:      { build: ., env_file: .env, depends_on: [db, privacy], ports: ["3000:3000"] }
  db:       { image: supabase/postgres (or postgres:16), volumes: [pgdata:/var/lib/postgresql/data] }
  privacy:  { build: ./services/privacy, # Ollama + Gemma + a tiny HTTP wrapper
              volumes: [ollama:/root/.ollama], environment: [GEMMA_MODEL=${GEMMA_MODEL}] }
volumes: { pgdata: {}, ollama: {} }
```
This is a developer preview only. The production BYOC profile needs a tested identity provider, durable job runner, object storage, secrets management, backups, upgrades and an operational security guide. Plain Postgres is not a drop-in replacement for all Supabase Auth/Storage/Realtime behaviour. Until those components are implemented and tested, label self-hosting as roadmap. The demo runs on hosted Vercel + Supabase.
