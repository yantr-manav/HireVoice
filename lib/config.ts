const DEFAULT_SITE = "http://localhost:3000";

export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  process.env.APP_URL?.replace(/\/$/, "") ||
  DEFAULT_SITE;

export const googleOAuth = {
  clientId: process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID || "",
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET || "",
  redirectUri:
    process.env.GOOGLE_REDIRECT_URI ||
    process.env.GOOGLE_OAUTH_REDIRECT_URI ||
    `${siteUrl}/api/google/callback`,
};

export const googleConfigured = Boolean(googleOAuth.clientId && googleOAuth.clientSecret);

/**
 * Incremental scopes only. Gmail modify covers read, labels, drafts and send.
 * Calendar + Meet lets the crew propose slots and attach a Meet link.
 * Drive file creation is covered by drive.file; full listing needs drive.readonly.
 */
export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/meetings.space.created",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/forms.body",
  "https://www.googleapis.com/auth/forms.responses.readonly",
];

export const calendarTimeZone = process.env.HIREVOICE_TIME_ZONE || "Asia/Kolkata";

/** A role accepts either one model or a comma-separated fallback list. */
function modelList(value: string | undefined, fallback: string[]): string[] {
  const parsed = (value ?? "")
    .split(/[,;\s]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  return Array.from(new Set([...parsed, ...fallback]));
}

/**
 * Free-tier aware defaults. The cheap model leads every bulk path; the
 * expensive models are only reached after the cheap ones answer 404/429.
 * Override any role with a comma-separated AI_MODEL_* value.
 */
export const aiModels = {
  fast: modelList(process.env.AI_MODEL_FAST, [
    "gemini-3.5-flash-lite",
    "gemini-3.8-flash",
    "gemini-2.5-flash",
  ]),
  deep: modelList(process.env.AI_MODEL_DEEP, [
    "gemini-3.8-flash",
    "gemini-3.5-flash-lite",
    "gemini-2.5-pro",
  ]),
  small: modelList(process.env.AI_MODEL_SMALL, [
    "gemini-3.5-flash-lite",
    "gemini-3.8-flash",
    "gemini-2.5-flash-lite",
  ]),
  gemma: modelList(process.env.AI_MODEL_GEMMA, [
    "gemma-3-27b-it",
    "gemma-3-12b-it",
    "gemma-3-4b-it",
  ]),
  command: modelList(process.env.AI_MODEL_COMMAND, [
    "gemini-3.5-flash-lite",
    "gemini-3.8-flash",
    "gemma-3-27b-it",
  ]),
  live: modelList(process.env.AI_MODEL_LIVE, [
    "gemini-3.8-live",
    "gemini-2.5-flash-preview-native-audio-dialog",
    "gemini-2.0-flash-live-001",
  ]),
};

export const aiModelPrimary = {
  fast: aiModels.fast[0],
  deep: aiModels.deep[0],
  small: aiModels.small[0],
  gemma: aiModels.gemma[0],
  command: aiModels.command[0],
  live: aiModels.live[0],
};

/** Every model that can answer a normal text request, cheapest-safe first. */
export const aiFallbackChain = Array.from(
  new Set([...aiModels.small, ...aiModels.fast, ...aiModels.gemma, ...aiModels.deep]),
);

export const gemmaFallbackChain = Array.from(new Set([...aiModels.gemma, ...aiModels.small]));
