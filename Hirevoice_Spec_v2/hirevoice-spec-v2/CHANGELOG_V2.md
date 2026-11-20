# v2 change log

This archive preserves the original eight-file Hirevoice specification and corrects the highest-risk implementation and pitch issues.

- Reframed the product as BPO voice screening, not a generic AI employee or full ATS.
- Separated the Vercel + Supabase hackathon demo from a future customer-controlled deployment.
- Clarified that Gemini Live receives the live audio stream; transcript redaction happens afterwards and does not make audio local.
- Updated Live API guidance to the currently documented `gemini-3.8-live` / `v1beta` ephemeral-token pattern, subject to pinning and end-to-end testing.
- Added separate consent for voice processing and audio recording.
- Changed confidence wording: model self-confidence is not treated as a calibrated probability.
- Changed external Workspace writes to approval-first.
- Reduced the 2-day build scope to one complete candidate-to-review workflow plus one real Workspace action.
- Added metrics definitions, validation targets, pitch wording and claims to avoid.

The docs remain a design specification, not implemented or tested software. Apply only the P0 database tables and routes you actually use.

- Clarified that transcript quote matching is not semantic proof and replaced model self-confidence with an evidence-quality heuristic.
- Separated live-processing consent from optional audio-recording consent in the schema and API spec.
