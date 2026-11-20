# 08. Buildathon Validation, Differentiation and Judge Pack

## 1. The exact wedge

**Hirevoice is not “an AI recruiter for every company.”** It starts with one specific job: first-round spoken-communication screening for BPO customer-support roles.

**Problem:** the resume cannot show whether a candidate can understand a customer, explain a resolution, or stay clear under a simple role-play. Recruiters repeat similar phone screens and have to write notes after each call.

**Solution:** a short, structured voice screen with a job-specific rubric, evidence-linked transcript, uncertainty routing and recruiter-controlled follow-up.

**Vision:** once the same playbook and permission engine works reliably, extend it to onboarding checks, training assessments and quality-audit workflows. These are future products, not current features.

## 2. The “magic” demo moment

The memorable sequence should be:

1. A judge or volunteer completes a 45–60 second customer-support role-play.
2. Hirevoice shows a result with three rubric dimensions (for example: listening, resolution clarity, empathy) and exact transcript excerpts.
3. Click an excerpt to jump to its audio timestamp only if audio recording consent was granted; otherwise the transcript highlight still works.
4. An unverified quote is visibly marked; the reviewer sees why the evidence is insufficient.
5. Change one playbook threshold, press **Simulate**, see how the rule would route the seeded candidates, then publish a new version.
6. Approve one external action and show a real Workspace effect if the integration is genuinely connected.

Do not spend the live demo on a dashboard tour, 12 agent cards or decorative animations.

## 3. Why a recruiter may care

Measure the baseline before claiming value. Ask recruiters:

- How many first-round screens do you run in a typical week for support roles?
- How many minutes does one screen plus note-taking take?
- How many candidates do you fail to reach or lose while waiting?
- Which language combinations are common in your applicant pool?
- What must be visible before you trust an AI-generated assessment?
- Would you test 10–20 consenting candidates in a controlled pilot? Who needs to approve it?

The strongest near-term customer is a small BPO, contact centre or staffing agency that recruits support agents every month and already uses Google Workspace. Do not claim that every BPO has the same workflow.

## 4. Validation plan

| Group | Target before/at event | What it proves | Evidence to save |
|---|---:|---|---|
| Recruiters / staffing owners | 3–5 conversations | Problem urgency, current workflow, trust criteria | Notes, role/title only with permission, follow-up request |
| Candidates / job seekers | 10–20 completed sessions | Booth usability, language experience, completion friction | Consent-based session counts, feedback form |
| Human-scored interviews | 10+ if feasible | Whether rubric outputs are directionally useful | Recruiter score sheet, same rubric version, disagreement notes |
| Pilot interest | 1–2 genuine requests to test | Early buyer pull | Explicit email/message confirmation; don't label as LOI unless signed |

Separate candidate validation from buyer validation. A candidate completing a free mock interview is not evidence that an employer will pay.

## 5. Metrics and claims policy

- Publish only numbers that the database can reproduce.
- Exclude seeded/replay sessions from user metrics.
- Always include sample sizes.
- Do not claim “85% accuracy” for a new Hirevoice model unless it was measured on a relevant, independently labelled Hirevoice dataset with a documented metric.
- Do not claim “60% less recruiter time” based on the old LinCXO project as if it were a Hirevoice result. State it only as prior work, with project attribution and correct context.
- Avoid a single “candidate quality probability”. Show skill dimensions, exact evidence, transcript quality and review status.
- Do not call quote matching “hallucination-free”. It is an evidence-grounding check.

Recommended event panel:

- completed candidate sessions: `N`
- completion rate: `X/Y`
- median result latency: `N seconds`
- quote verification: `V/T quotes`
- recruiter discovery calls: `N`
- requested pilot follow-ups: `N`

## 6. Candidate-first safety and trust

- Obtain consent to Gemini Live voice processing before opening the microphone.
- Ask separately for audio recording/playback consent. If not granted, do not record or upload audio.
- Tell the candidate who can view the transcript and the retention period.
- Offer a text-based accessibility alternative or human-led alternative where practical.
- Never assess accent, dialect, gender, age, name, caste, religion, disability or background.
- Define the role rubric around observable work behaviours. Do not use vague traits like “culture fit”, “confidence”, “native fluency” or “personality”.
- AI cannot reject or make the final hiring decision. A recruiter reviews and owns the outcome.
- Provide a way to request correction/deletion and a support contact.
- Before using this for real hiring, get a qualified legal/privacy review and run a fairness evaluation with recruiters and candidate representatives.

## 7. Product architecture truth table

| Statement | Accurate now? | How to say it |
|---|---|---|
| Candidate audio is processed locally | No, not in the Gemini Live path | Browser sends Live audio to Google's API; transcript identifiers can be redacted afterwards |
| Transcript evidence is verified | Yes, as text matching | Code checks whether the cited quote appears in the cited transcript segment |
| The score is guaranteed correct | No | It is an AI-assisted assessment with evidence and human review |
| Gemma runs privately | Only if the separate Gemma service is deployed and tested | Show the running service and request/response trace; otherwise label it planned |
| The hackathon demo is self-hosted | No | It is hosted on Vercel + Supabase |
| Workspace integrations are production-approved | Not by default | Testing-mode OAuth is for test users; production can require verification/review |

## 8. Competitor positioning

Avoid blanket statements such as “HireVue is English-only” or “all ATS tools are resume-first”; competitors change. Describe the product's chosen wedge rather than making unsupported claims:

- voice-first candidate experience for a specific BPO support role;
- configurable job-related rubric;
- transcript-linked evidence and visible uncertainty;
- recruiter-owned decisions and approval-gated actions;
- Google Workspace connection as an operational layer, not a replacement ATS.

In the pitch, say: **“We are not replacing an ATS. We are adding a structured voice-screening and evidence layer before a recruiter decides who moves forward.”**

## 9. One-paragraph pitch

“BPO resumes do not tell a recruiter how a candidate will handle a customer on a call. Hirevoice gives candidates a short, structured voice screen in the language they are comfortable using. Gemini conducts the conversation and helps assess a small, job-specific rubric. We ground every assessment in transcript excerpts, flag weak evidence, and leave the decision with the recruiter. Recruiters configure the workflow in a versioned Markdown playbook and can approve follow-up actions in Google Workspace. We are starting with customer-support hiring, validating with recruiters and candidates, and expanding only after the first workflow earns trust.”

## 10. Technical references checked 19 Nov 2026

- Gemini Live API overview and current supported models: https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/live-api
- Gemini Live API language and voice configuration: https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/live-api/configure-language-voice
- Google AI Studio ephemeral token guide (current `v1beta` usage and configuration locking): https://aistudio.google.com/docs/live-api/ephemeral-tokens
- Google OAuth scope list and notes about sensitive/restricted scopes and verification: https://developers.google.com/identity/protocols/oauth2/scopes
- Gemma with Ollama deployment guide: https://github.com/google-gemma/docs/blob/main/docs/deployment/ollama.md

Always re-check the official docs and API reference on the day you deploy; model names, previews, quotas and SDK behaviour can change.
