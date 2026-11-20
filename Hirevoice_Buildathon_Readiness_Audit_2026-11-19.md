# Hirevoice — City Buildathon Readiness Audit

**Prepared:** 19 November 2026  
**Purpose:** Decision guide for the 20–21 November Startup Buildathon India city round.  
**Scope reviewed:** Hirevoice v2 specification (product, UI/UX, architecture, database, backend/agents, implementation, and judge/validation), plus the new ideas in the latest project notes.

> This is an audit of the design and evidence shared in the conversation. It is not a code review. No repository, deployed application, production logs, recruiter interview notes, or completed Hirevoice user sessions were available to verify implementation status.

## 1. Executive decision

**Keep Hirevoice focused on BPO voice screening and evidence-backed recruiter decisions.** Make the recruiter voice-command interface the memorable operational layer, but limit the buildathon to one actual Workspace action. Treat uploaded-call intelligence as a useful adoption path for a later pilot, not as a second core product to finish this weekend.

The product statement:

> Hirevoice helps BPO recruiters see how a candidate handles a real customer conversation, understand the evidence behind an assessment, and take the next recruiting action without leaving their workflow.

The core demo should show:

1. A candidate completes a short, consented customer-support voice screen on mobile.
2. Hirevoice produces a rubric assessment with transcript-linked evidence.
3. The recruiter clicks evidence and inspects the relevant transcript/audio moment where recording consent exists.
4. The recruiter asks Hirevoice to schedule the shortlisted candidate.
5. Hirevoice previews the action, receives approval, and creates one real Calendar event with a Meet link (or one other real Workspace action if that is the integration already tested).

Do not build a generic AI employee for every department during this event.

## 2. Rubric diagnosis and probability caveat

The official programme describes five evaluation areas: founder profile, product potential, market viability, technical architecture, and depth of Google AI/Cloud use. The following are diagnostic scores based on the information reviewed, not official scores.

| Criterion | Current diagnostic score | What supports it | What is missing |
|---|---:|---|---|
| Founder profile | 16/20 | Prior recruitment automation and multilingual AI evaluation experience | A crisp founder story and direct connection to the buyer problem |
| Product potential | 15/20 | Clear BPO voice-screening workflow; evidence timeline and playbook | A tighter differentiator and proof that recruiters value the workflow |
| Market viability | 8/20 | Reachable local BPO/staffing-agency segment | Verified buyer interviews, willingness to pilot/pay, baseline workflow numbers |
| Technical architecture | 14/20 | Sensible v2 architecture, consent gates, evidence verification, deterministic actions | Working deployment, mobile reliability, measured latency, error handling |
| Google AI/Cloud use | 15/20 | Gemini Live, Gemini structured assessment, optional transcription, Google Workspace, Cloud Run path | Actual live traces and a real Google Cloud deployment rather than a diagram |
| **Total** | **68/100** | Strong concept and founder fit | Execution and customer evidence are the bottlenecks |

Do not treat a percentage chance as an empirical forecast. The organiser has not published the number of city teams or a per-city advancement quota. Previous estimates such as 35–45% or 60% were not based on competition data. The only honest conclusion is that the project has a credible concept but its chance depends heavily on a working demo and buyer evidence.

For planning only, a reliable end-to-end demo plus 3–5 genuine recruiter conversations, 10–20 consented candidate sessions, and one explicit request for a pilot would materially improve the case. Candidate completions prove usability; they do not prove that an agency will pay.

## 3. Scope lock: what to build now

### P0 — protect these

- One seeded BPO Customer Support role and one short playbook.
- Candidate consent screen and mic check.
- Three structured questions and one customer-handling role-play.
- Gemini Live interview with visible captions/transcript.
- Structured scoring on 3–4 observable job-related skills.
- Quote-to-transcript verification in deterministic application code.
- Recruiter candidate detail with transcript and evidence timeline.
- Human-controlled shortlist / needs-review action.
- One voice command with a deterministic tool and approval: preferably schedule a candidate for the next round.
- One real Workspace connector action: Calendar event + Meet, or Gmail draft if that is what is already tested.
- Replay mode, seeded edge cases, and a full backup recording of the demo.

### P1 — only after P0 is reliable

- Candidate intake by voice for practical details (preferred locality, shift availability, qualification, experience, notice period, salary expectation). Candidate confirms the extracted details before they are saved.
- Upload an existing mobile screening recording, only with permission from the people recorded; use a transcription model with speaker diarization and timestamps, then apply the same role rubric.
- Sheets append or a small exception queue (missing information, duplicate contact, no-show, incomplete interview).
- A basic recruiter command history showing what was requested, what was approved, and what happened.

### P2 — do not implement during the event

- All Google Workspace connectors at once.
- WhatsApp Business API, telephony integrations, multiple autonomous agents, Slack/Jira.
- Aadhaar/PAN authenticity verification or a broad KYC product.
- Full self-hosting / BYOC installer, GKE, Cloud SQL migration, local-only voice stack.
- General purpose AI employee workflows outside hiring.
- A complete call-recording mobile application.

## 4. Critical product and fairness corrections

The later brainstorm contains several ideas that should **not** be copied into the product as scoring criteria:

- Do not score accent, MTI (mother-tongue influence), dialect, perceived confidence, gender, age, vocal pitch, or personality.
- Do not infer cheating from long pauses or the presence of another voice. Those signals are unreliable and could penalise disability, environment, or normal behaviour. Audio-quality problems may be shown as technical flags, not candidate-quality scores.
- Do not use word-per-minute as a standalone quality score. Assess whether the candidate communicates the task-relevant information clearly and understandably.
- Do not auto-reject candidates. The recruiter owns the decision and must be able to inspect and override evidence.
- Do not call Gemini document extraction “authenticity verification.” It can flag illegible pages, missing fields, and inconsistencies for a human to inspect. Do not collect Aadhaar/PAN or other high-risk identity documents for a buildathon demo.
- Do not ask for exact home address or age in a generic first-stage voice intake. Ask only what is needed for the role, such as preferred work location, shift preference, and availability. Collect legally required fields only when necessary and explain why.
- A quote verifier proves that a quote exists in a transcript segment. It does not prove that the score or reasoning is correct.

## 5. Google Cloud deployment decision

The official programme says teams should build a new product with Google AI and deploy it on Google Cloud. Your v2 spec currently says the web application is on Vercel, Supabase handles data/auth/storage, and Google APIs power AI/Workspace. That is a managed-cloud architecture, but it does not show the primary application deployed on Google Cloud.

### Recommended architecture for the city round

| Layer | Recommended choice | Why |
|---|---|---|
| Primary web app + API | **Cloud Run, Mumbai (`asia-south1`)** | A real Google Cloud deployment that can run a Next.js container and API routes |
| AI | Gemini Live + Gemini structured assessment through the tested API path | Avoid a last-minute model/provider migration |
| Database and auth | Keep existing Supabase Postgres/Auth for this buildathon | Avoid an unnecessary database migration |
| File storage | Keep Supabase private Storage if already working; consider GCS only if it is already integrated | Do not build two storage systems under deadline |
| Secrets | Secret Manager for server-side API/OAuth secrets | Avoid secrets in source code and client bundles |
| Background work | A simple server-side job first; Cloud Tasks only if scoring or follow-ups need durable retries | Reliable retries without introducing a large queue architecture |
| Observability | Cloud Logging + basic application event timings | Show actual errors and latency, not decorative agent animations |
| Fallback | Keep the Vercel deployment available as a fallback while validating Cloud Run | Don't destroy a stable live demo to chase deployment purity |

**Practical decision:** If the Next.js app can be deployed to Cloud Run from source or a Dockerfile without major changes, make the Cloud Run URL the primary demo and retain Vercel as backup. If the app is currently fragile, deploy the actual orchestration/scoring service to Cloud Run and show the real request trace, but be honest that the frontend is still on Vercel. Do not claim the entire product runs on Google Cloud in that case.

Do not migrate Supabase to Cloud SQL tonight. Cloud SQL introduces a continuously running database cost and migration risk. Cloud Run can scale to zero with request-based billing when minimum instances are zero. Cloud Run supports Next.js deployment and WebSockets, but the v2 architecture can avoid hosting the candidate's Live WebSocket on your own server: mint a short-lived token on the server, then connect the browser directly to Gemini Live.

Suggested region for the Google Cloud application service: `asia-south1` (Mumbai), subject to model/service availability and where your Supabase project is hosted.

## 6. Cost overview — planning estimates, not a quote

Current public prices checked on 19 November 2026. Prices are USD before applicable taxes; region, traffic, configuration, and account eligibility can change the final bill.

| Service | Lean prototype approach | Published price / caveat |
|---|---|---|
| Vercel | Keep as a fallback | Hobby is $0 but restricted to non-commercial personal use; Pro is $20/month with $20 usage credit |
| Supabase | Free for demo data; Pro if production reliability/storage is needed | Free: 500 MB database, 1 GB file storage, 5 GB egress; free projects can pause after one week of inactivity. Pro starts at $25/month |
| Cloud Run | Request-based, minimum instances 0 | Free tier includes 2 million requests, 180,000 vCPU-seconds and 360,000 GiB-seconds per month; regional rates still matter |
| Cloud SQL | **Do not add yet** | Example shared-core `db-f1-micro` list price shown as $0.0105/hour (~$7.67/month compute alone), with storage, backups, and networking extra; this shared-core tier has no Cloud SQL SLA |
| Gemini 3.8 Live | Paid tier for real candidate data | Current listed audio rates: $0.005/min input audio and $0.018/min output audio |
| Gemini 3.5 Transcribe | For uploaded calls, later | Current estimated blended rate about $0.005/min for audio-to-transcript processing |
| Cloud Storage | Only if needed for consented recordings | Storage, operations, and network costs depend on region and usage; avoid storing audio indefinitely |

**Illustrative Gemini Live cost:** assume a 3-minute conversation contains 2 minutes of candidate input audio and 1 minute of generated model audio. At the listed rates, the audio component is about **$0.028 per interview**, or about **$2.80 for 100 interviews**, before text tokens, post-interview scoring, retries, and any other model calls. Measure actual usage in the API billing dashboard.

**Important data-use warning:** the Gemini Developer API pricing page says free-tier content may be used to improve Google's products, while paid-tier content is not used for that purpose. Do not send real candidate audio or identifiable recruitment data through a free-tier setup for a real pilot. Use synthetic data for free-tier experimentation; use a suitable paid/enterprise arrangement and clear candidate notice/consent for real data.

**Important credit warning:** as of the current Google Cloud Free Trial documentation, the $300 Welcome credit cannot pay for Gemini API in AI Studio, and for free-trial signups or paid-account upgrades on/after 16 November 2026 it cannot pay for Gemini platform / Vertex AI services. Do not assume the standard $300 credit pays your Live model bill. Ask Hack2skill whether any separate buildathon credits have different terms.

## 7. UI/UX upgrades with the highest return

### A. Keep the existing visual concept

The v2 “Desk and Booth” direction is distinctive and should be preserved:

- Candidate Booth: calm, dark-blue, mobile-first, one clear live voice focus.
- Recruiter Desk: light, precise, pane-based workspace.
- Evidence Timeline: the signature interaction, not another generic analytics chart.

Do not add neon dashboards, constant particle backgrounds, or a grid of 12 animated agent cards.

### B. Evidence Timeline implementation

Use the timeline design already in the v2 document:

1. Waveform lane.
2. One lane per assessment skill (Listening, Resolution Clarity, Empathy, etc.).
3. Flags lane for low recording quality, missing answer, or evidence that needs review.
4. Solid marker = quote passed deterministic transcript verification.
5. Hollow marker = quote was not found in its cited transcript segment; it cannot count as verified support.
6. Click a marker to select the transcript excerpt and, if recorded audio exists with consent, seek playback to a little before the evidence.
7. Click a transcript excerpt to highlight its marker on the timeline.
8. Add playback controls: play/pause, 0.75x / 1x / 1.25x / 1.5x, current time, total duration, and keyboard navigation.

Use `wavesurfer.js` with its Regions/Timeline plugins or a small custom peaks canvas. For this weekend, use WaveSurfer rather than hand-building a full audio editor. Generate a reduced waveform/peaks array from the consented audio; don't send the full recording to the client merely to draw the waveform.

**Timestamp truth:** if the live interview only stores transcript chunks with client receive times, those are approximate turn times, not exact word-level timestamps. Label them accordingly. For precise seek-to-quote positions on uploaded recordings, use a transcription output that provides speaker labels and word-level timestamps. If no audio recording consent was given, show transcript-linked evidence without audio playback or a fabricated waveform.

### C. Candidate Booth refinements

- One large responsive voice orb/wave that reacts to actual microphone amplitude, not a decorative animation.
- State labels: `Ready`, `Listening`, `Thinking`, `Speaking`, `Reconnecting`, `Finished`.
- Live captions in the candidate's selected language.
- Show question progress and a visible end/leave control.
- Mic permission and audio device check before the session.
- Provide a text/accessibility alternative.
- Request separate consent for live AI processing and optional audio recording.

### D. Recruiter voice-command dock

Build one persistent `Ask Hirevoice` control with push-to-talk and text fallback. It should have an explicit state machine:

`idle → listening → transcribing → interpreting → plan_preview → awaiting_approval → executing → succeeded / partially_succeeded / failed`.

Example:

> “Schedule Manoj for the BPO role tomorrow at 10 AM.”

The UI should show:

- Identified candidate: Manoj (with a disambiguation prompt if there are multiple Manojs).
- Role and interview round.
- Date, time, timezone and duration.
- Calendar availability result.
- Exact action: create Calendar event and Meet link.
- The account/calendar where the event will be created.
- `Approve and create` and `Edit request` actions.

Never silently execute an ambiguous or external action. Show a small execution trace: `Intent understood → Candidate resolved → Availability checked → Awaiting approval → Event created`.

### E. Recruiter home screen

Prioritise three areas rather than a large dashboard:

- **Needs your attention:** low-quality recording, missing candidate information, uncertain evidence, no-show, duplicate candidate.
- **Interview queue:** today's candidates and completion states.
- **Recent activity:** approved actions and failures.

This is more operationally useful than a wall of analytics cards.

## 8. Technical tips that will prevent demo failures

### Live voice and audio

- Never expose the long-lived Gemini API key in `NEXT_PUBLIC_*` or browser JavaScript.
- Mint a short-lived ephemeral token on a server route, with the allowed model/configuration locked server-side.
- Initialize/resume `AudioContext` from the user's explicit Start Interview click; browsers can block audio started outside a gesture.
- Gemini Live uses 16 kHz PCM input and 24 kHz PCM output in the documented raw-audio protocol. Confirm sample rate and encoding in the SDK you pin. Handle resampling deliberately; do not just relabel 48 kHz microphone data as 16 kHz.
- Use headphones at the venue to avoid the model hearing its own output from the laptop speakers.
- Implement a reconnect state and a maximum interview duration.
- Test on Android Chrome and iPhone Safari; detect supported `MediaRecorder` MIME types rather than assuming `audio/webm`.
- Keep the candidate experience working on phone data/5G, not just laptop Wi-Fi.

### Scoring and evidence

- Do not ask the Live model to score while it is conducting the interview. Finish the conversation first, then run one scoring pass over the transcript.
- Use a fixed rubric and strict structured JSON output; validate it with Zod on the server.
- Every evidence item must contain a `segment_id`, exact quote, skill key, and timestamp provenance.
- Verify the quote against the cited segment in deterministic code. Normalise only safe formatting differences; preserve the raw source quote for display.
- If a quote fails verification, show it as unverified and remove it from the evidence summary.
- If JSON validation fails, retry once; if it still fails, route to human review.
- Call the score `Evidence quality` or `Evidence coverage`, not a calibrated probability that the candidate will perform well.

### Voice commands and tool safety

- Do not turn speech into arbitrary shell commands or execute generated Google Workspace CLI strings.
- Use an allowlisted tool registry with typed argument schemas: `calendar.checkAvailability`, `calendar.createEvent`, `gmail.createDraft`, etc.
- The language model may propose an action; deterministic code validates the tool name, candidate/role ownership, arguments, time zone, and user permissions.
- Read-only queries can usually run immediately. Sending mail, creating meetings, moving a candidate stage, or modifying a form should show a preview and request approval.
- Add an idempotency key so a retry does not create duplicate Calendar events or send duplicate emails.
- Log user request, parsed intent, tool, arguments, approver, result, and failure reason. Redact secrets and unnecessary personal data from logs.

### Security and deployment

- Supabase service-role key and Google OAuth refresh tokens must remain server-side; encrypt refresh tokens at rest.
- Apply tenant/org checks on every candidate and role query; don't trust `company_id` sent by the browser without verifying membership.
- Use signed, short-lived URLs for private audio. Restrict file types and size; validate content server-side.
- Set a recording retention window and deletion process. Only keep audio when separate recording consent exists.
- Add a per-organisation request limit and a small maximum Cloud Run instance count to prevent runaway model usage.
- Configure a billing budget and alert. A budget alert is not a hard spending cap.
- Keep a one-click demo reset, but protect it so it is inaccessible to normal recruiters.

## 9. What to say about Google AI

Use Google technology because each component has a clear task—not to tick every product in the event list.

| Google capability | Real product use | What to show |
|---|---|---|
| Gemini Live | Conduct candidate voice interview | Real turn-taking conversation and transcript |
| Gemini structured output | Map transcript evidence to a fixed role rubric | Validated JSON and a visible result |
| Gemini 3.5 Transcribe | Process consented uploaded phone calls later | Speaker labels and timestamps |
| Gemma | Optional PII processing service only if actually running and measured | Real service trace; otherwise mark roadmap |
| Google Cloud Run | Deploy the app or substantive orchestration service | Live `run.app` URL, deployment region and request log |
| Secret Manager | Hold server-side secrets | Deployment configuration, not a decorative badge |
| Cloud Tasks | Durable retries for long-running scoring/actions, only if needed | Actual queued/retried task trace |
| Calendar / Meet | Schedule next interview | Actual approved event and Meet link |
| Sheets | Append candidate status after P0 is stable | Real row append |
| Forms / Drive / Docs | Later application and document workflow | Roadmap or one tested integration only |

Nano Banana can be a later job-poster generation feature. Lyria has no compelling role in the core hiring journey. Do not add either to the live demo just to name more Google models.

## 10. Candidate call uploads and document handling

### Existing phone call uploads

This can help agencies adopt Hirevoice without changing their current call process. It is a useful later import path, but upload-and-summary is not unique by itself.

Flow:

`Consent check → private upload → format/duration validation → transcription + diarization + timestamps → recruiter confirms candidate speaker → job rubric assessment → quote verification → human review`.

Do not upload recordings unless the people recorded have been informed and permitted the processing. Treat original recordings as sensitive. Give the recruiter an option to delete them after processing, and retain only what is necessary.

### Document checks

If added later, describe it as **document completeness and consistency review**, not official identity or authenticity verification. It can flag a blurry page, missing page, unreadable field, or disagreement between a candidate-entered value and a document. A human verifies the document. Do not collect Aadhaar/PAN in the city-round prototype.

## 11. 48-hour execution plan

### Tonight — 19 November

1. Confirm event rules about pre-built code and reuse.
2. Test one complete Gemini Live interview on a real phone with headphones.
3. Verify ephemeral token issuance; make sure the API key is not in browser code.
4. Verify transcript persistence and one valid score JSON result.
5. Test quote verification on one valid and one intentionally invalid quote.
6. Create/verify Google Cloud project, Cloud Run deployment path, OAuth test user, and only the API needed for the one Workspace action.
7. Speak to at least three recruiters if reachable; record exact workflow answers, not invented statistics.

### Day 1 — 20 November

1. Deploy a stable app/API on Cloud Run in `asia-south1` if this can be done without breaking the existing app.
2. Complete candidate consent → interview → transcript → score → evidence review.
3. Test on two phones and one laptop.
4. Fix the two most serious bugs; do not add connectors before the core path passes.

### Day 2 — 21 November

1. Add the voice-command dock for one specific command.
2. Add one real approval-gated Calendar/Meet or Gmail action.
3. Add the timeline polish and replay fallback.
4. Invite candidates/attendees to run the consented practice flow.
5. Speak to recruiters and ask for a pilot test, not a compliment.
6. Freeze scope and rehearse the three-minute pitch five times.

## 12. Three-minute pitch structure

**0:00–0:20 — Hook**  
“A resume can show where someone worked. It cannot show how they'll handle a customer who says, ‘My refund is missing and I've called three times.’ BPO recruiters have to discover that skill through repeated phone screens.”

**0:20–1:05 — Candidate experience**  
Invite a judge or volunteer to complete a short voice role-play. Show the live transcript and the question flow.

**1:05–1:35 — Trust moment**  
Show a skill assessment, click the quote, and show the exact supporting transcript/audio moment. Explain that failed quotes are marked unverified and people make the hiring decision.

**1:35–2:15 — Operational moment**  
Say: “Schedule Manoj for the next round tomorrow at 10 AM.” Show the action preview, approval, and the real Calendar/Meet result. Do not fake an execution.

**2:15–2:45 — Proof**  
Report actual candidate completions, recruiter conversations, result latency, and pilot requests. Distinguish candidates from paying buyers. Never invent savings or agreement percentages.

**2:45–3:00 — Founder fit and vision**  
“I've worked on recruitment automation and multilingual AI evaluation. I saw the repetitive work on both sides. Hirevoice starts with voice screening for BPOs; the longer-term goal is to automate the administrative work around that hiring journey, while keeping recruiters in control.”

## 13. Metrics worth putting on the screen

- Completed real interviews (excluding seeded/replay sessions).
- Interview completion rate with numerator and denominator.
- Median time from interview end to result ready.
- Evidence quotes verified / total evidence quotes.
- Recruiter discovery conversations and the number requesting a pilot.
- Human/AI agreement only when independent recruiters score the same interviews using the same rubric. If sample size is small, show examples and disagreements instead of a percentage.

## 14. Official references checked 19 November 2026

- Buildathon programme, dates, evaluation criteria, Google AI list, and deployment instruction: https://startupbuildathon.com/
- Cloud Run pricing: https://cloud.google.com/run/pricing
- Next.js on Cloud Run quickstart: https://docs.cloud.google.com/run/docs/quickstarts/frameworks/deploy-nextjs-service
- Cloud Run WebSockets: https://docs.cloud.google.com/run/docs/triggering/websockets
- Cloud Run billing settings: https://docs.cloud.google.com/run/docs/configuring/billing-settings
- Supabase pricing: https://supabase.com/pricing
- Vercel pricing: https://vercel.com/pricing
- Vercel Hobby plan policy: https://vercel.com/docs/plans/hobby
- Cloud SQL pricing: https://cloud.google.com/sql/pricing
- Gemini Developer API pricing and data-use distinction: https://ai.google.dev/gemini-api/docs/pricing
- Gemini Live API overview: https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/live-api
- Gemini 3.5 Transcribe pricing/features: https://ai.google.dev/gemini-api/docs/pricing
- Google Cloud Free Trial restrictions: https://docs.cloud.google.com/free/docs/free-cloud-features

---

**Final decision:** Do not rebuild Hirevoice from scratch. Preserve v2's Desk/Booth UI and evidence-verification architecture. Add a small command dock, deploy the product workload to Cloud Run, and prove one recruiter workflow with real users. Defer the rest until a recruiter asks for it and agrees to pilot it.
