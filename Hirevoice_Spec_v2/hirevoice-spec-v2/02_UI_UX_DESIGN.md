# 02. UI / UX Design

## 1. Design concept: "The Desk and The Booth"

Hirevoice is about **voice**, and its users live in the call-centre world: headsets, queues, broadcast lights, audio editing. The design borrows from **audio editing software and broadcast studios**, not from generic SaaS.

- **The Booth** (candidate): dark, quiet, intimate. One calm focal point. A small "on air" light shows the interview is live. Nothing else competes.
- **The Desk** (recruiter): light, clear, working surface. Dense where it helps. Built around **one memorable element: the Evidence Timeline**, an audio-editor-style view where every score is tied to quoted moments you can click and hear.

**Spend boldness in one place.** The Evidence Timeline is the signature. Everything else stays disciplined and quiet.

### Review against generic defaults (what I rejected and why)
- Rejected near-black + single acid accent for the whole app. The Desk is light, and the dark Booth uses a deep blue, not black, so each space has its own mood.
- Rejected cream + serif + terracotta (a very common generated look). Palette is cool chalk, ultramarine, and a broadcast pink-red.
- Rejected uniform rounded cards in grids. The Desk uses **panes, lanes and ruled lists**, with radius varying by role.
- Rejected all-caps eyebrows, middle-dot meta strings, trailing arrows on buttons, single accented words in headlines, mono for every small label.

## 2. Tokens

### Color (Desk, light)
| Token | Hex | Use |
|---|---|---|
| `chalk` | `#EEF1F5` | App background |
| `paper` | `#FAFBFC` | Panes, editor surfaces |
| `ink` | `#101A2C` | Primary text, strong borders |
| `slate` | `#5B6578` | Secondary text |
| `rule` | `#D5DBE5` | Hairlines, dividers |
| `ultramarine` | `#3347F5` | AI actions, links, selection, focus ring |
| `onair` | `#F0315A` | Live state, recording, destructive |
| `verified` | `#12A66B` | Evidence verified, success |
| `flag` | `#F2B705` | Low confidence, needs review |

### Color (Booth, dark)
| Token | Hex | Use |
|---|---|---|
| `booth` | `#0B1030` | Background (deep blue, not black) |
| `booth-2` | `#141B47` | Raised surface |
| `glow` | `#8FA0FF` | Voice ring, captions highlight |
| `onair` | `#F0315A` | On-air light |
| `mist` | `#C9D0F0` | Text |

Dark mode for the Desk is optional (P2). Derive it from the Booth tokens.

### Typography
- **Display:** *Bricolage Grotesque* (variable, optical size and width axes). Headlines, big numbers, the landing hero. Use tight tracking at large sizes.
- **UI and body:** *Geist* (or *Hanken Grotesk* if Geist is not available). Clearly different in feel from the display face.
- **Hindi and Marathi:** *Noto Sans Devanagari*, sized 1.08x larger than Latin text to match visual weight, line-height 1.6.
- **Mono:** *Geist Mono*, **only** for timestamps and quoted evidence snippets, never for generic labels.
- **Scale:** 12 / 14 / 16 / 20 / 28 / 44 / 72. Body line length under 75 characters.
- Sentence case everywhere. No all-caps labels.

### Shape, borders, depth
- Radius by role: **4px** data chips and timeline markers, **10px** panes, **20px** modals and sheets, **999px** only for live pills and the Orb.
- Hairline borders (`rule`) instead of shadows. A single crisp 1px `ink` outline for the focused pane. Depth through layering, not blur.
- Spacing grid: 4px base, panes padded 16 or 24.

### Motion (restrained)
- **One orchestrated moment per screen at most.** Landing: the hero waveform. Booth: the voice ring. Playbook Studio: the graph re-layout.
- Motion that answers an action: opening a sheet, a score settling in, an approval confirming.
- No scroll-triggered fade-ups on every section. No hover lifts on every card.
- Respect `prefers-reduced-motion`: replace motion with instant state changes.
- Springs for panes (stiffness 260, damping 28). 150ms ease-out for micro-interactions.

## 3. Component sourcing

**shadcn/ui (structure, install all that apply):** `button input textarea select switch checkbox radio-group tabs dialog sheet drawer popover dropdown-menu command tooltip badge avatar separator scroll-area resizable skeleton sonner table form accordion progress chart breadcrumb sidebar calendar`

**21st.dev (search, then adapt to tokens):** sidebar layouts, command palette, data tables with filters, kanban boards, stepper/onboarding, AI chat input, empty states, file/URL connect cards, toast patterns. Always re-style to the tokens above so the app doesn't look like a patchwork.

**React Bits (use at most four, and verify names exist in the library):**
- `Orb` or a custom canvas ring for the Booth voice indicator (drive it with real mic amplitude)
- `SplitText` or `BlurText` for the landing headline only
- `CountUp` for analytics numbers
- `AnimatedList` for the live agent feed
Skip decorative backgrounds (Aurora, Particles) in the Desk.

**Other libraries:** `motion` (framer-motion), `@xyflow/react` (playbook graph), `@dnd-kit/core` (kanban), `@uiw/react-codemirror` + markdown language (editor), `wavesurfer.js` or a custom canvas (waveform), `cmdk` (via shadcn command), `zustand`, `@tanstack/react-query`, `zod`, `next-themes`, `sonner`.

## 4. App shell (the Desk)

```
┌──────────────────────────────────────────────────────────────────┐
│ ▣ Hirevoice   Search or ask… ⌘K          ● Crew idle   Meera ▾  │ 48px top bar
├───────┬──────────────────────────────────────────────────────────┤
│ Home  │                                                          │
│ Roles │              page content (panes)                        │
│ Review│                                                          │
│ Studio│                                                          │
│ Crew  │                                                          │
│ Links │                                                          │
│ Stats │                                                          │
│ Prefs │                                                          │
└───────┴──────────────────────────────────────────────────────────┘
```
- Left nav is icon + label, 208px, collapsible to 56px. Active item has an `ink` left bar, not a filled pill.
- Top bar shows the **Crew status pill** (idle / working with count / needs approval with count). Click opens the Approvals sheet.
- Nav labels: Home, Roles, Review, Playbooks, Crew, Connections, Analytics, Settings.

## 5. Screens (each in detail)

### 5.1 Landing page `/`
**Job:** make a judge try it in 10 seconds.
**Layout:** left-aligned. Headline left, **live mic waveform demo** right.
```
┌────────────────────────────────────────────────────────┐
│  Hirevoice                         Try it   Sign in    │
│                                                        │
│  Hire by talking.                  ┌──────────────────┐│
│  Your playbook does the rest.      │  ~~~~~~~~~~~~~~  │ live waveform
│                                    │  Say hello in    │ from your mic
│  [ Interview me for 60 seconds ]   │  Hindi or English│
│  Watch a 90-second walkthrough     └──────────────────┘│
└────────────────────────────────────────────────────────┘
```
- Headline in Bricolage, 72px. Sub: one sentence, plain.
- The right panel is the page's single motion moment: the waveform reacts to the visitor's microphone (ask permission only after click). Before click it plays a gentle idle wave.
- Below the fold: three short blocks written as plain sentences: how a playbook works (a real snippet), how an interview score shows its evidence (a static Evidence Timeline image), how privacy works (what is redacted and where).
- No logo wall, no testimonials unless real.

### 5.2 Candidate Booth `/i/[token]`
**Theme:** Booth (dark blue). **Mobile first.** One column.

States and screens:
1. **Welcome:** role title, company name, estimated 4 minutes, language chips (Hindi, English, Hinglish). One primary button: "Start".
2. **Consent:** four short items with plain language. Checkbox "I understand". Link "Take this as a text conversation instead".
3. **Mic check:** large level meter that fills as they speak. Message changes: "I can't hear you yet" / "Good, I can hear you". Button enables only when level is detected.
4. **Interview:**
```
        ● on air                     question 2 of 5
   ┌───────────────────────────┐
   │        (voice ring)       │   ring radius follows mic level
   │                           │   when candidate speaks, and a softer
   │          Vaani            │   pulse when Vaani speaks
   └───────────────────────────┘
   Live caption (Devanagari or Latin, 2 lines max)

   [ Repeat question ]  [ I need a moment ]  [ End ]
```
   - The voice ring is the Booth's only animation. Use `Orb` or a canvas ring. Colors: `glow` when candidate speaks, `onair` dot pulse when recording.
   - Caption shows the last two lines, with the current speaker's text brighter.
   - A thin progress arc around the ring shows time used out of the cap.
5. **Reconnecting:** non-blocking banner "Connection dropped. Reconnecting, your answers are saved."
6. **Finished:** "Thanks, Sana. Meera's team reviews every interview. You'll hear back by email." If feedback reports are enabled: button "See your feedback".
7. **Errors:** mic denied shows how to enable it for this browser with an illustrated 3-step list. Expired link says what to do.

### 5.3 Candidate feedback report `/r/[token]`
- Simple page, Booth theme, 3 sections: "What you did well" (2 to 3 quoted moments from the candidate's own words, with play buttons), "One thing to practise" (one concrete suggestion), "Try again" (link to Practice mode).
- Shareable image of the top strength ("Clear and calm under pressure") for LinkedIn. Never shows raw numeric scores unless the recruiter allows it.

### 5.4 Practice mode `/practice`
- Same Booth, generic rubric, 2-minute interview. Optional email to receive the report. A small line at the end: "Hiring for customer support? Companies on Hirevoice can invite you directly." (Opt-in only.)
- This is the user acquisition and validation loop. Track completions in Analytics.

### 5.5 Onboarding wizard `/app/onboarding`
Five steps in a left rail (a real sequence, so numbering is appropriate here): Connect Google, Choose playbook, Review, Publish, Test yourself.
- **Connect Google:** list of connectors as a ruled list (not cards). Each row: icon, name, one sentence of what it does, scope names in a collapsible "What this allows", status, Connect button. Gmail and Calendar are required. A "Test" button sends a real test email to the recruiter.
- **Choose playbook:** three templates as a ruled list with preview on the right.
- **Review:** the compiled playbook summary with warnings.
- **Publish:** the invite link, QR code, copy button, and "Share by email" which uses Comms agent draft.
- **Test yourself:** opens the Booth in a new tab. When finished, the page updates live (Supabase Realtime) and shows your own score.

### 5.6 Home (Command Center) `/app`
```
┌─ Today ─────────────────────────────┬─ Crew ───────────────────┐
│ 14 interviews  6 need review        │ Interviewer  ● idle      │
│ 3 shortlisted  2 meetings today     │ Privacy      ● 1 run     │
│ Hours saved this week  11.5         │ Scoring      ● idle      │
├─ Needs you (3) ─────────────────────┤ Scheduler    ● waiting   │
│ Approve invite to Sana K.   [View]  │ Comms        ● waiting   │
│ Review: Rahul M. (low conf) [Open]  ├─ Live feed ──────────────┤
│ Approve rejection feedback  [View]  │ 14:02 Scoring → Sana K.  │
├─ Pipeline ──────────────────────────┤ 14:02 Verified 6/6 quotes│
│ Invited 42 → Interviewed 29 →       │ 14:03 Scheduler drafted  │
│ Review 6 → Shortlisted 11 → Sched 4 │ …                        │
└─────────────────────────────────────┴──────────────────────────┘
```
- "Needs you" is the most important block. It has real actions, not just counts.
- Funnel is a single horizontal bar chart, not four stat cards. Numbers use `CountUp` only on first load.
- Live feed uses `AnimatedList` and Supabase Realtime on `agent_steps`.
- Empty state: "No interviews yet. Send your invite link, or take the interview yourself." with two buttons.

### 5.6b Roles `/app/roles` and Role detail `/app/roles/[id]`
- **List:** table with role, language, playbook version, interviews, in review, shortlisted, status. Row click opens detail.
- **Detail tabs:** Pipeline, Candidates, Playbook, Invite, Settings.
- **Pipeline (kanban):** columns Invited, Interviewed, In review, Shortlisted, Scheduled, Closed. Cards are compact rows: alias or name, overall score as a small bar, confidence indicator, language tag. Drag to move (writes an audit event). Toggle to table view with filters (score range, confidence, language, stage).
- **Anonymised view toggle** in the toolbar: hides names, photos, and contact details, showing aliases such as "Candidate 4F2A".

### 5.7 Candidate Detail with Evidence Timeline `/app/roles/[id]/candidates/[cid]` (the signature screen)
```
┌────────────────────────────────────────────────────────────────────┐
│ Sana K. (Candidate 4F2A) · Support Exec · Hindi   [Shortlist][Review]│
├──────────────────────┬─────────────────────────────────────────────┤
│ Skills (left pane)   │ Transcript (right pane)                      │
│ Clarity        4.5 ▇▇▇│ 0:12 Vaani   Tell me about a time…         │
│ Empathy        4.0 ▇▇ │ 0:20 Sana    "I stayed calm and told the…"  │
│ Listening      3.5 ▇▇ │       ▲ evidence: Empathy, Clarity          │
│ Problem solving 4.0   │ 0:41 Sana    …                              │
│ Fluency        4.5    │                                             │
│                      │                                              │
│ Overall 4.2          │                                              │
│ Confidence ▂▄▆█ high │                                              │
├──────────────────────┴─────────────────────────────────────────────┤
│  Evidence timeline                                                  │
│  ▁▂▅▇▅▃▁▁▂▆▇▆▃▂▁▁▃▅▇▅▂▁▁▂▃▆▇▅▃▂▁▁▂▅▇▆▃▁   ← waveform + playhead    │
│  Clarity   ──◆───────────◆────────────◆──                           │
│  Empathy   ────◆──────────────◆───────────                          │
│  Listening ───────◇────────────────────── (◇ = unverified)          │
│  Flags     ─────────────⚑──────────────── (low audio, long silence) │
│  [▶ play] [0:41 / 3:48]   speed 1x                                  │
└────────────────────────────────────────────────────────────────────┘
```
**Behaviour (build this carefully):**
- The bottom dock is a **lane-based timeline**: one waveform lane, then one lane per rubric skill, then a flags lane.
- Each evidence marker `◆` sits at the quote's timestamp. Hover shows a tooltip with the quote and the skill. **Click plays the audio from 1 second before** and scrolls and highlights the same quote in the transcript. Clicking a transcript quote does the reverse.
- `◇` hollow markers mean the quote failed the verifier (not found verbatim). These reduce confidence and are listed in a "Needs attention" strip.
- **Evidence-quality meter** is four bars that are steady and tall when confidence is high and short and uneven when low (the "signal clarity" metaphor). Hovering shows the formula inputs (verified evidence ratio, self-consistency, audio quality).
- Left pane skill rows are expandable: reasoning text, all evidence quotes with timestamps, and an "Edit score" control that opens a popover (slider 1 to 5 + required reason). Edits write to `reviews` and show a "changed from 3.5" chip.
- The header holds the actions: Shortlist, Send to review, Reject (opens a confirm sheet that drafts a kind feedback email for approval). Reject never sends automatically.
- **PII:** names appear as aliases until the user clicks "Reveal details". Reveal asks for confirmation and logs an audit event. Redacted tokens in the transcript render as small `[NAME]` chips.
- **Agent trace drawer** (right sheet): "How was this decided?" shows the run steps (privacy, score, verify, router) with timings and model names.
- Keyboard: `Space` play/pause, `←/→` previous/next marker, `E` edit score.
- Mobile/tablet: the timeline dock becomes a bottom sheet.

### 5.8 Review Queue `/app/review`
- Single focused candidate view (same components as 5.7) with a small stack count at the top ("4 left"). Reason chips show why it's here ("low confidence", "borderline", "unverified quote", "shield triggered").
- Bottom bar: **Approve (A)**, **Reject (R)**, **Skip (S)**, **Edit (E)**. After a decision, the next candidate slides in. Show a quiet counter "AI and you agree 87%".
- Reject always requires picking a reason and opens the drafted feedback email for approval.

### 5.9 Playbook Studio `/app/playbooks/[id]`
```
┌───────────────────────────────┬───────────────────────────────────┐
│ playbook.md (CodeMirror)      │ Compiled flow  |  Rules  |  Diff   │
│ # Role: Support Executive     │   ┌────────┐                       │
│ ## Interview …                │   │Invite  │→ Interview → Score    │
│ ## Decisions                  │   └────────┘        │              │
│ - score >= 4 and confidence…  │        ┌────────────┼──────────┐   │
│ ## Output …                   │      Shortlist   Review    Feedback │
│                               │        │                           │
│  warnings: line 12 unclear    │   Simulate on last 10 candidates   │
└───────────────────────────────┴───────────────────────────────────┘
 [Compile]  [Simulate]  [Publish v4]   versions ▾
```
- Left: CodeMirror with markdown highlighting, line-level warnings from the compiler (red underline plus gutter icon), and an "Insert snippet" menu (add a decision rule, add an output action).
- Right tabs:
  - **Flow:** `@xyflow/react` graph auto-laid-out from the compiled JSON. Node types: Trigger, Interview, Score, Decision, Action. Nodes update with a short layout animation when you edit (this is the Studio's one motion moment).
  - **Rules:** the compiled JSON in readable form, plus the safe expression for each decision.
  - **Diff:** current vs last published.
- **Simulate:** replays the last N candidates' stored scores through the new rules (no new AI calls). Shows "2 more shortlisted, 1 fewer in review".
- Publish writes a new version. Previous versions list with restore.

### 5.10 Agent Crew `/app/crew`
- **Top strip:** one row per agent with name, model badge, status dot, last run time. (This is the same list as the Home Crew block but expanded.)
- **Tabs:** Runs, Approvals, Permissions, Skills.
  - **Runs:** table of runs (agent, trigger, status, duration, tokens). Click opens the step-by-step trace with inputs and outputs (PII redacted).
  - **Approvals:** inbox. Each item shows a **diff** of the proposed action (full email text, event time and attendees, sheet row). Buttons: Approve, Edit, Reject.
  - **Permissions:** a matrix. Rows are agents or actions, columns are Suggest, Ask, Auto. A radio per cell, with a lock icon on actions that cannot be Auto (reject, delete). Scope badges show which Google permissions each agent uses.
  - **Skills:** list of `agents/*.skill.md` with a read-only view and a "View tools" list. Message: "Adding a connector means adding a tool and a skill file."

### 5.11 Connections `/app/connections`
- Ruled list of connectors: Gmail, Calendar and Meet, Drive, Sheets, Forms, Docs (P2), Slack (roadmap), Jira (roadmap).
- Each row: status, connected account, scopes in plain words, **Test**, **Disconnect**.
- Drive: choose a resume folder with Google Picker. Sheets: choose or create the "Hiring Tracker" sheet with a "Create for me" button.
- Roadmap connectors are shown but disabled with a short line: "Planned".

### 5.12 Analytics `/app/analytics`
- Four charts max: funnel, time to shortlist (median), language mix, **AI-human agreement over time**.
- A "Practice and interviews this week" line chart showing candidate participation (useful for the pitch).
- Text insight line at top, generated server-side and cached: one sentence in plain language.

### 5.13 Settings `/app/settings`
Tabs: Organisation, Privacy, Consent text, Data, Team.
- **Privacy:** toggles for redaction categories (names, phone, email, address, IDs, employers). Retention days for audio and transcripts. "Anonymised view default" switch.
- **Data:** export all candidate data, delete a candidate (with confirm and audit event).

### 5.14 Command palette (global `⌘K`)
- Sections: Navigate, Actions ("Create role", "Sync Drive now"), and **Ask Hirevoice** (free text). Answers render inline as a small table with links. The model only calls read-only functions.

### 5.15 Demo mode `/demo`
- A pre-seeded workspace with 12 candidates (including edge cases: low confidence, unverified quote, injection attempt). A visible **Reset demo** button and a **Replay mode** toggle: plays a recorded interview if the network or Live API fails during the pitch.

## 6. Copy rules

Label the reviewer indicator **Evidence quality**, not candidate confidence. Tooltip: “A heuristic based on transcript quality, rubric coverage and verified evidence. It is not the probability that this person will perform well.”

- Sentence case. Plain verbs. "Approve invite", not "Submit".
- Same word for the same action everywhere ("Shortlist" always, never "Select" or "Advance").
- Errors say what happened and how to fix it. No apologies. Example: "We couldn't reach Gmail. Reconnect it in Connections, then retry."
- Empty states invite an action.
- Hindi strings are written by a native speaker, not machine-translated. Keep a `messages/hi.json`.

## 7. Accessibility and quality floor
- Visible 2px `ultramarine` focus ring on every interactive element.
- Contrast AA minimum on both themes. Never rely on color alone: markers use shape (filled and hollow), confidence uses bar height.
- Captions always on in the Booth. Text alternative to voice.
- All timeline interactions available by keyboard.
- Test at 360px width for the Booth.

## 8. Self-critique checklist (run before demo)
- Does the Desk look like it belongs to the same product as the Booth? (shared type and shapes)
- Is the Evidence Timeline the first thing people remember?
- Remove one decoration from every screen.
- Is there any screen that looks like a stock admin template? Replace its chrome.
