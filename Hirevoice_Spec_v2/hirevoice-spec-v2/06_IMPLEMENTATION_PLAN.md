# 06. Implementation Plan — Solo Founder, 20–21 Nov 2026

**Current context:** today is Thu 19 Nov 2026; the city buildathon is Fri 20 and Sat 21 Nov. This is a one-person build. Treat the original 8-file product spec as the long-term blueprint, not a checklist to finish in 48 hours.

## Hard product scope

### Must work by the end of Day 1

1. Recruiter signs in and opens one seeded role.
2. Candidate opens an invite on a phone, reads the consent notice, passes mic check and completes a short interview.
3. Browser connects to Gemini Live using a server-issued ephemeral token. Transcript segments are persisted.
4. A server pipeline redacts identifiers, scores the transcript using Gemini structured output, verifies evidence quotes in code, and stores a result.
5. Recruiter opens the candidate and can inspect skills, transcript, and evidence. If audio recording consent was not granted, this is transcript-only evidence.

If this flow does not work, do not build agents, Workspace connectors or a workflow graph.

### Add only after the full path is stable

- Playbook editor with a small safe schema: languages, questions, skill anchors, score threshold and review threshold.
- Simulate a threshold change on seeded results, then publish a version.
- One real Workspace action (Calendar event + Meet OR Gmail draft/send). External action defaults to approval.
- Gemma private redaction service, only if it is running reliably. Regex remains the baseline.

### Explicitly defer

Drive ingestion, Gmail inbox reading, Sheets sync, Forms, Docs, Slack/Jira, multi-agent autonomy, Docker installer, full self-hosting, Analytics charts beyond three metrics, multi-role kanban and decorative React Bits effects.

## Thu 19 Nov — preparation (remaining time today)

- [ ] Check event rules on prewritten code and reuse. Write down the organiser's answer.
- [ ] Create or verify one Google Cloud project, enable only the APIs for the one planned Workspace action, set OAuth consent to Testing, add your own account as a test user.
- [ ] Create a Gemini API key and run the official ephemeral-token flow using the currently documented `v1beta` SDK setup. Keep the model configurable; current docs list `gemini-3.8-live` as the recommended GA Live model.
- [ ] Test a 60-second Hindi, English and Hinglish Live conversation from a real phone/headset. Test reconnect and microphone permissions.
- [ ] Create Supabase tables needed for P0 only. Do not apply every optional table unless you use it.
- [ ] Send recruiter interview requests to existing LinCXO/Smiligners contacts and local BPO/staffing recruiters. Ask for a 10-minute problem interview, not a sales call.
- [ ] Prepare 6–8 clearly labelled synthetic candidate transcripts for deterministic demo/replay; never pass them off as real users.

## Fri 20 Nov — ship the core workflow

**Block 1: skeleton**
- Next.js App Router, TypeScript strict, Tailwind, shadcn/ui, Supabase Auth, recruiter layout.
- Candidate route `/i/[token]`; create and validate one-use invite token.

**Block 2: Candidate Booth**
- Consent notice, mic check, connection state, live transcript, progress, repeat/end controls.
- Live audio through the tested Gemini Live model. Store candidate transcript segments with timestamps.
- Implement a recorder only when the candidate separately consents to audio storage. Otherwise show transcript-only evidence.

**Block 3: score pipeline**
- Use one fixed BPO support rubric with 3–4 observable skills.
- Gemini returns strict JSON: score, short rationale, evidence segment references and exact quotes.
- Code verifies the quote against the cited redacted segment. Unverified quotes are visibly marked.
- Compute rubric summary and evidence-quality flags in code. Do not use model self-confidence as a calibrated probability.
- Persist the score and show errors/retry state on failure.

**Block 4: Evidence Timeline**
- Candidate detail: skill rows → evidence chips → selected transcript segment. Audio playback is enabled only when consented audio exists.
- Reviewer can mark `shortlist`, `needs_review` or `not_progressing` with a reason. The model never takes that action.

**End-of-day checkpoint:** a real candidate can complete the interview and a recruiter can inspect its evidence. If not, stop all other work and fix this path.

## Sat 21 Nov — product magic, validation, pitch

**First: Playbook Studio**
- Load one `playbook.md` template.
- Edit one numeric threshold.
- Validate schema and show warnings.
- Simulate the old and new threshold against seeded scores; label this as simulation, not live hiring impact.
- Publish a new version. Do not allow arbitrary code or arbitrary tool names in Markdown.

**Second: one Workspace action**
- Choose the connector you tested before the event.
- Calendar path: create one real event with a Meet link. Gmail path: create a draft first; only send after approval.
- Show the exact permission and approval screen. If OAuth fails, use a labelled simulated action and disclose it; do not fake a real send.

**Third: get user proof**
- Invite event attendees and job seekers to complete the candidate flow, with consent.
- Speak to at least 3 recruiters or staffing agency owners. Ask about current screening volume, call duration, drop-off, and what evidence they would need to trust a tool.
- Count only completed candidate sessions as product usage. Count recruiter conversations separately as discovery. Do not treat a candidate's mock interview as paid-customer validation.

**Final block: freeze and rehearse**
- Test on phone and laptop; test bad network; ensure replay mode works offline.
- Record one full backup video of the exact build.
- Freeze features. Rehearse the 3-minute pitch at least five times.

## The 3-minute pitch

| Time | What to say | What to show |
|---|---|---|
| 0:00–0:20 | “A resume cannot prove how someone handles a customer. Hirevoice lets them show it in a short voice interaction.” | Candidate Booth start |
| 0:20–1:05 | Invite a judge or play a real, consented test session. | Live interview / live captions |
| 1:05–1:35 | “This is not a black-box score. Every skill is linked to the exact transcript evidence; unverified quotes are flagged.” | Evidence Timeline and transcript |
| 1:35–2:05 | “The recruiter owns the process. Change one rule, preview the impact, publish it.” | Playbook Studio threshold change and simulation |
| 2:05–2:30 | “The agent can prepare the next step, but a person approves external actions.” | Approval screen and real Calendar/Gmail action if genuinely connected |
| 2:30–3:00 | Share actual usage and recruiter discovery numbers; explain next pilot. | Small metrics panel, then founder story |

## Numbers to collect (define them precisely)

- **Completed interviews:** number of unique sessions whose status is `scored` (exclude replay/demo seeds).
- **Completion rate:** completed genuine sessions ÷ genuine sessions started.
- **Median time to result:** median end-of-interview timestamp to score-ready timestamp.
- **Evidence verification rate:** verified quotes ÷ total quotes returned by the model.
- **Human agreement:** only calculate for the subset independently scored by a recruiter using the same rubric; report sample size and the agreement method. With fewer than 10 double-scored interviews, show raw examples instead of a percentage.
- **Recruiter discovery:** number of recruiter conversations, current process pain, and whether they requested a follow-up/pilot. Do not call a verbal compliment a customer or LOI.

## Fallback matrix

| Failure | Fallback |
|---|---|
| Live API or venue Wi-Fi fails | Replay a clearly labelled recorded demo session; narrate what is live and what is replayed |
| Hindi quality is weak | Offer English/Hinglish as the tested launch experience; don't claim broader coverage |
| Mic blocked | Use a second phone or the text accessibility path |
| Gemma service is slow/down | Use deterministic regex redaction and show a visible “local model unavailable” state |
| OAuth fails | Show the prepared approval preview; clearly label the action as not executed |
| Scoring output invalid | Retry once with validation; otherwise route to human review with “scoring failed” |
| Candidate recording not consented | Display transcript-only evidence; never upload audio anyway |

## Pitch questions to be ready for

**How do you stop hallucinations?** We do not claim zero hallucinations. The model must cite transcript segments; code checks the quoted text exists. That only verifies grounding, not whether the judgement is correct, so uncertain cases go to a person.

**How do you handle bias?** Job-related, observable rubric anchors; no accent, dialect, demographic or identity scoring; identity redaction where possible; human decision and override trail. We still need recruiter-led fairness evaluation before production use.

**Is it private?** The app can redact transcript identifiers before scoring and limit stored data. In the Live path, candidate audio is processed by Google's Gemini Live API. We explain that and request consent; we do not claim the audio stays local.

**Is it self-hosted?** The event demo is Vercel + Supabase. BYOC is a planned deployment mode; fully local/air-gapped voice is not implemented.

**Why use Google AI?** Gemini Live provides the low-latency voice interface; Gemini produces structured rubric assessments; Gemma can run as a separate open-model service for local transcript PII detection. Show only the pieces that actually run in the demo.

**What is novel?** Not “AI interviewer” alone. The wedge is evidence-linked multilingual voice screening plus a recruiter-owned Markdown playbook and permissioned Workspace actions.
