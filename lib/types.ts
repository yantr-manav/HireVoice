export type Stage =
  | "invited"
  | "interviewed"
  | "in_review"
  | "shortlisted"
  | "scheduled"
  | "closed";

export type Language = "en" | "hi" | "hinglish" | "mr";

export type SkillId = "clarity" | "empathy" | "listening" | "problem_solving";

export type DecisionKind = "shortlist_suggested" | "needs_review" | "feedback_suggested";

export type EvidencedQuote = {
  id: string;
  skill: SkillId;
  segmentSeq: number;
  quote: string;
  tStartMs: number;
  tEndMs: number;
  verified: boolean;
  matchKind?: "exact" | "near" | "unverified";
};

export type RoleFitMatch = {
  roleId: string;
  roleTitle: string;
  fitScore: number;
  fitLabel: "strong_fit" | "good_fit" | "needs_review";
  reason: string;
  recommended: boolean;
};

export type CandidateLogistics = {
  preferredLocation?: string;
  nightShiftOk?: boolean;
  noticePeriod?: string;
  expectedCtc?: string;
  languagesSpoken?: string[];
  confirmedByCandidate?: boolean;
  mismatchFlags?: string[];
};

export type LivenessCheck = {
  phrase: string;
  spoken?: string;
  matched: boolean;
  note: string;
};

export type CommitmentState = {
  status: "pending" | "confirmed" | "rescheduled" | "silent";
  slotLabel?: string;
  updatedAt?: string;
  whatsappUrl?: string;
};

export type SkillScore = {
  id: SkillId;
  label: string;
  value: number;
  weight: number;
  reasoning: string;
  evidence: EvidencedQuote[];
  insufficientEvidence?: boolean;
};

export type EvidenceQualityParts = {
  verifiedRatio: number;
  consistency: number;
  rubricCoverage: number;
  transcriptQuality: number;
};

export type CandidateScore = {
  overall: number;
  evidenceQuality: number;
  confidenceParts: EvidenceQualityParts;
  decision: DecisionKind;
  summary: string;
  model: string;
  scoredAt: string;
  items: SkillScore[];
};

export type TranscriptSegment = {
  seq: number;
  speaker: "interviewer" | "candidate";
  text: string;
  tStartMs: number;
  tEndMs: number;
  lang?: Language;
  flags?: string[];
};

export type Candidate = {
  id: string;
  alias: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  roleId: string;
  roleTitle: string;
  language: Language;
  stage: Stage;
  source: "invite" | "drive" | "form" | "practice" | "manual";
  appliedAt: string;
  interviewAt: string;
  durationMs: number;
  hasAudio: boolean;
  audioConsent: boolean;
  transcript: TranscriptSegment[];
  score: CandidateScore;
  reviewReasons: string[];
  flags: string[];
  notes?: string;
  isReal?: boolean;
  latencyMs?: number;
  driveToken?: string;
  roleFits?: RoleFitMatch[];
  logistics?: CandidateLogistics;
  liveness?: LivenessCheck;
  commitment?: CommitmentState;
  injectionFlags?: string[];
};

export type Role = {
  id: string;
  title: string;
  status: "draft" | "open" | "paused" | "closed";
  languages: Language[];
  playbookId: string;
  playbookName: string;
  playbookVersion: number;
  invited: number;
  interviewed: number;
  inReview: number;
  shortlisted: number;
  scheduled: number;
  createdAt: string;
  location: string;
  hiringManager: string;
};

export type Playbook = {
  id: string;
  name: string;
  roleTitle: string;
  version: number;
  status: "published" | "draft";
  updatedAt: string;
  updatedBy: string;
  markdown: string;
  warnings: { line: number; severity: "warn" | "error"; message: string }[];
  versions: { version: number; publishedAt: string; publishedBy: string; note: string }[];
};

export type AgentStatus = "idle" | "working" | "waiting" | "blocked";

export type Agent = {
  id: string;
  name: string;
  role: string;
  model: string;
  status: AgentStatus;
  lastRun: string;
  tier: "P0" | "P1";
  autonomy: "suggest" | "ask" | "auto";
  tools: string[];
  scopes: string[];
  runsToday: number;
  successRate: number;
};

export type AgentRun = {
  id: string;
  agentId: string;
  agentName: string;
  trigger: string;
  candidateAlias?: string;
  status: "queued" | "running" | "awaiting_approval" | "succeeded" | "failed";
  startedAt: string;
  durationMs: number;
  tokensIn: number;
  tokensOut: number;
  steps: { tool: string; level: string; status: string; durationMs: number; detail: string }[];
};

export type Approval = {
  id: string;
  kind: "calendar" | "gmail" | "sheets";
  title: string;
  candidateAlias: string;
  agent: string;
  createdAt: string;
  status: "pending" | "approved" | "rejected";
  proposal: {
    subject?: string;
    body?: string;
    when?: string;
    attendees?: string[];
    meet?: boolean;
    sheet?: string;
    row?: string[];
  };
  reason?: string;
};

export type Connection = {
  id: string;
  service: "gmail" | "calendar" | "drive" | "sheets" | "forms" | "docs" | "slack" | "jira";
  name: string;
  description: string;
  status: "connected" | "not_connected" | "error" | "planned";
  account?: string;
  scopes: string[];
  lastChecked?: string;
};

export type FeedItem = {
  id: string;
  time: string;
  agent: string;
  message: string;
  tone: "neutral" | "verified" | "flag" | "onair";
};

export type Workspace = {
  org: {
    id: string;
    name: string;
    plan: string;
    seats: number;
    region: string;
  };
  user: {
    name: string;
    email: string;
    role: string;
    initials: string;
  };
  roles: Role[];
  candidates: Candidate[];
  playbooks: Playbook[];
  agents: Agent[];
  runs: AgentRun[];
  approvals: Approval[];
  connections: Connection[];
  feed: FeedItem[];
  agentActions: AgentAction[];
  audit: AuditEvent[];
  google: GoogleConnection;
  metrics: {
    invites: number;
    completed: number;
    completionRate: number;
    inReview: number;
    shortlisted: number;
    scheduled: number;
    medianResultSeconds: number;
    verifiedQuotes: number;
    totalQuotes: number;
    hoursSaved: number;
    discoveryCalls: number;
    pilotRequests: number;
  };
  realMetrics?: {
    completed: number;
    medianLatencyMs: number;
    verifiedQuotes: number;
    totalQuotes: number;
    driveCount: number;
    uploadedCalls: number;
  };
  isDemo: boolean;
  sampleData: boolean;
};

export type TimelineMarker = {
  id: string;
  skill: SkillId;
  label: string;
  tMs: number;
  tEndMs: number;
  verified: boolean;
  quote: string;
  segmentSeq: number;
};

/* ---------------------------------------------------------------------------
 * Agentic workspace
 * ------------------------------------------------------------------------- */

export type AgentActionStatus = "proposed" | "approved" | "executed" | "rejected" | "failed";

export type AgentActionSource = "gemini" | "gemma" | "fallback" | "manual";

export type ActionLink = {
  label: string;
  href: string;
  external?: boolean;
};

export type ActionResult = {
  ok: boolean;
  title: string;
  detail: string;
  simulated?: boolean;
  links?: ActionLink[];
  rows?: { label: string; value: string }[];
};

export type AgentAction = {
  id: string;
  transcript: string | null;
  intent: string;
  tool: string;
  args: Record<string, unknown>;
  status: AgentActionStatus;
  mutating: boolean;
  summary: string;
  result: ActionResult | null;
  error: string | null;
  actor: string;
  source: AgentActionSource;
  createdAt: string;
  updatedAt: string;
};

export type AgentPlan = {
  id: string;
  transcript: string;
  intent: string;
  summary: string;
  source: AgentActionSource;
  model: string | null;
  steps: AgentAction[];
};

export type AuditEvent = {
  id: string;
  actor: string;
  action: string;
  target: string | null;
  detail: string | null;
  surface: "voice" | "review" | "mail" | "calendar" | "drive" | "forms" | "api" | "workspace";
  createdAt: string;
};

/* ---------------------------------------------------------------------------
 * Google Workspace
 * ------------------------------------------------------------------------- */

export type GoogleConnection = {
  configured: boolean;
  connected: boolean;
  email: string | null;
  scopes: string[];
  connectedAt: string | null;
};

export type MailMessage = {
  id: string;
  threadId: string;
  from: { name: string; email: string };
  to: { name: string; email: string }[];
  subject: string;
  snippet: string;
  body: string;
  date: string;
  unread: boolean;
  starred: boolean;
  labels: string[];
  hasAttachment: boolean;
  candidateId?: string;
  demo?: boolean;
};

export type CalendarEventKind = "interview" | "review" | "hold" | "personal";

export type CalendarEvent = {
  id: string;
  title: string;
  description: string;
  start: string;
  end: string;
  attendees: { name?: string; email: string }[];
  meetLink: string | null;
  htmlLink: string | null;
  location: string | null;
  status: "confirmed" | "tentative" | "cancelled";
  kind: CalendarEventKind;
  candidateId?: string;
  local?: boolean;
  demo?: boolean;
  organizer?: string;
};

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size: number | null;
  webViewLink: string | null;
};

export type WorkspaceFile = {
  id: string;
  name: string;
  kind: "doc" | "sheet" | "folder" | "form";
  url: string;
  createdAt: string;
};

export type FormQuestionKind = "text" | "paragraph" | "multiple_choice" | "checkbox";

export type FormQuestion = {
  title: string;
  description?: string;
  required?: boolean;
  kind?: FormQuestionKind;
  options?: string[];
};

export type FormFile = {
  formId: string;
  name: string;
  description?: string;
  formUrl: string;
  editUrl: string;
  responsesUrl: string;
  questionCount: number;
  createdAt?: string;
  demo?: boolean;
};

export type FormAnswerItem = {
  questionId: string;
  question: string;
  answer: string;
};

export type FormResponse = {
  responseId: string;
  createTime: string;
  lastSubmittedTime: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  location: string;
  experience: string;
  answers: Record<string, string>;
  items: FormAnswerItem[];
};

export type FormDetail = FormFile & {
  questions: { questionId: string; title: string; required: boolean; kind: FormQuestionKind }[];
  responseCount: number;
};

export type SheetSummary = {
  id: string;
  name: string;
  url: string;
  modifiedTime: string;
  demo?: boolean;
};

export type SheetCellIssue = {
  rowIndex: number;
  column: string;
  value: string;
  kind: "invalid_email" | "invalid_phone" | "duplicate" | "missing_required" | "messy_format";
  message: string;
};

export type SheetCellChange = {
  rowIndex: number;
  column: string;
  before: string;
  after: string;
  reason: string;
};

export type SheetCleanReport = {
  totalRawRows: number;
  cleanedRowCount: number;
  trimmedCells: number;
  normalizedNames: number;
  normalizedEmails: number;
  normalizedPhones: number;
  normalizedCities: number;
  normalizedStages: number;
  duplicatesDetected: number;
  blankRowsSkipped: number;
  issueCount: number;
  issues: SheetCellIssue[];
  changes: SheetCellChange[];
};

export type SheetData = {
  id: string;
  name: string;
  url: string;
  tabs: string[];
  activeTab: string;
  rows: string[][];
  health: SheetCleanReport;
  demo?: boolean;
};

/* ---------------------------------------------------------------------------
 * Models
 * ------------------------------------------------------------------------- */

export type ModelKeyStatus = {
  ref: string;
  provider: "gemini" | "gemma";
  label: string;
  cooling: boolean;
  cooldownUntil: string | null;
  calls: number;
  failures: number;
};

export type AiStatus = {
  configured: boolean;
  liveReady: boolean;
  provider: "google-ai-studio" | "none";
  models: { id: string; label: string; family: "gemini" | "gemma"; role: string }[];
  keys: ModelKeyStatus[];
  lastCall: { model: string; at: string; status: string } | null;
};
