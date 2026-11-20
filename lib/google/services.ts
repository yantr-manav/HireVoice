import "server-only";
import crypto from "node:crypto";
import { google } from "googleapis";
import type { gmail_v1 } from "googleapis";
import { calendarTimeZone } from "@/lib/config";
import { getAuthorizedClient } from "@/lib/google/auth";
import type {
  CalendarEvent,
  CalendarEventKind,
  DriveFile,
  MailMessage,
  WorkspaceFile,
} from "@/lib/types";
import { istAt, istDateKey } from "@/lib/time";

export class GoogleScopeError extends Error {
  constructor(service: string) {
    super(`The connected Google account has not granted ${service} access. Reconnect Google to add it.`);
    this.name = "GoogleScopeError";
  }
}

function isScopeError(error: unknown) {
  const message = error instanceof Error ? error.message : JSON.stringify(error);
  return message.includes("insufficient") || message.includes("insufficientPermissions") || message.includes("403");
}

async function withGoogle<T>(service: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (isScopeError(error)) throw new GoogleScopeError(service);
    throw error;
  }
}

function decodeBase64Url(data: string) {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function stripHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

type BodyParts = { text: string; html: string; hasAttachment: boolean };

function walkPart(part: gmail_v1.Schema$MessagePart | undefined, acc: BodyParts) {
  if (!part) return;
  if (part.filename && part.body?.attachmentId) acc.hasAttachment = true;
  if (part.mimeType === "text/plain" && part.body?.data) acc.text += decodeBase64Url(part.body.data);
  if (part.mimeType === "text/html" && part.body?.data) acc.html += decodeBase64Url(part.body.data);
  if (part.parts) part.parts.forEach((child) => walkPart(child, acc));
}

function headerValue(message: gmail_v1.Schema$Message, name: string): string {
  const header = message.payload?.headers?.find((entry) => entry.name?.toLowerCase() === name.toLowerCase());
  return header?.value ?? "";
}

function parseAddressList(value: string): { name: string; email: string }[] {
  if (!value) return [];
  return value.split(/,(?=[^"]*(?:"[^"]*"[^"]*)*$)/).map((raw) => {
    const match = raw.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
    if (match) return { name: match[1].trim(), email: match[2].trim() };
    return { name: "", email: raw.trim().replace(/[<>]/g, "") };
  }).filter((address) => address.email);
}

function parseSingleAddress(value: string): { name: string; email: string } {
  const [first] = parseAddressList(value);
  if (first) return first;
  return { name: value || "Unknown sender", email: "" };
}

function mapMessage(message: gmail_v1.Schema$Message): MailMessage {
  const acc: BodyParts = { text: "", html: "", hasAttachment: false };
  walkPart(message.payload ?? undefined, acc);
  const body = acc.text.trim() || stripHtml(acc.html) || message.snippet || "";
  const labels = message.labelIds ?? [];
  return {
    id: message.id ?? crypto.randomUUID(),
    threadId: message.threadId ?? "",
    from: parseSingleAddress(headerValue(message, "From")),
    to: parseAddressList(headerValue(message, "To")),
    subject: headerValue(message, "Subject") || "(No subject)",
    snippet: message.snippet ?? body.slice(0, 160),
    body: body.slice(0, 20_000),
    date: new Date(Number(message.internalDate ?? Date.now())).toISOString(),
    unread: labels.includes("UNREAD"),
    starred: labels.includes("STARRED"),
    labels,
    hasAttachment: acc.hasAttachment,
  };
}

export async function listMail(
  owner: string,
  options: { query?: string; limit?: number } = {},
): Promise<MailMessage[]> {
  const { client } = await getAuthorizedClient(owner);
  const gmail = google.gmail({ version: "v1", auth: client });
  const limit = Math.min(Math.max(options.limit ?? 16, 1), 30);

  const list = await withGoogle("Gmail", () =>
    gmail.users.messages.list({
      userId: "me",
      q: options.query || undefined,
      maxResults: limit,
    }),
  );

  const ids = (list.data.messages ?? []).map((message) => message.id).filter((id): id is string => Boolean(id));
  const messages = await Promise.all(
    ids.map((id) =>
      withGoogle("Gmail", () =>
        gmail.users.messages.get({ userId: "me", id, format: "full" }).then((response) => response.data),
      ).catch(() => null),
    ),
  );

  return messages.filter((message): message is gmail_v1.Schema$Message => Boolean(message)).map(mapMessage);
}

export async function getMail(owner: string, id: string): Promise<MailMessage> {
  const { client } = await getAuthorizedClient(owner);
  const gmail = google.gmail({ version: "v1", auth: client });
  const response = await withGoogle("Gmail", () =>
    gmail.users.messages.get({ userId: "me", id, format: "full" }),
  );
  return mapMessage(response.data);
}

function encodeSubject(subject: string) {
  if (/^[\x20-\x7E]*$/.test(subject)) return subject;
  return `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
}

function buildRaw(input: {
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  threadId?: string;
  from?: string;
  inReplyTo?: string;
}) {
  const lines = [
    ...(input.from ? [`From: ${input.from}`] : []),
    `To: ${input.to.join(", ")}`,
    ...(input.cc && input.cc.length > 0 ? [`Cc: ${input.cc.join(", ")}`] : []),
    `Subject: ${encodeSubject(input.subject)}`,
    ...(input.inReplyTo ? [`In-Reply-To: ${input.inReplyTo}`, `References: ${input.inReplyTo}`] : []),
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(input.body, "utf8").toString("base64").replace(/(.{76})/g, "$1\r\n"),
  ];
  return Buffer.from(lines.join("\r\n"), "utf8").toString("base64url");
}

export async function sendMail(
  owner: string,
  input: { to: string[]; cc?: string[]; subject: string; body: string; threadId?: string; replyToMessageId?: string },
): Promise<{ id: string; threadId: string; link: string }> {
  const { client, account } = await getAuthorizedClient(owner);
  const gmail = google.gmail({ version: "v1", auth: client });
  const raw = buildRaw({
    to: input.to,
    cc: input.cc,
    subject: input.subject,
    body: input.body,
    threadId: input.threadId,
    from: account.email ?? undefined,
    inReplyTo: input.replyToMessageId,
  });

  const response = await withGoogle("Gmail", () =>
    gmail.users.messages.send({
      userId: "me",
      requestBody: { raw, threadId: input.threadId },
    }),
  );

  return {
    id: response.data.id ?? "",
    threadId: response.data.threadId ?? "",
    link: `https://mail.google.com/mail/u/0/#all/${response.data.id ?? ""}`,
  };
}

export async function createMailDraft(
  owner: string,
  input: { to: string[]; subject: string; body: string; threadId?: string },
): Promise<{ id: string; link: string }> {
  const { client } = await getAuthorizedClient(owner);
  const gmail = google.gmail({ version: "v1", auth: client });
  const raw = buildRaw(input);
  const response = await withGoogle("Gmail", () =>
    gmail.users.drafts.create({
      userId: "me",
      requestBody: { message: { raw, threadId: input.threadId } },
    }),
  );
  return {
    id: response.data.id ?? "",
    link: `https://mail.google.com/mail/u/0/#drafts/${response.data.message?.id ?? ""}`,
  };
}

export async function modifyMail(
  owner: string,
  id: string,
  change: { add?: string[]; remove?: string[] },
): Promise<void> {
  const { client } = await getAuthorizedClient(owner);
  const gmail = google.gmail({ version: "v1", auth: client });
  await withGoogle("Gmail", () =>
    gmail.users.messages.modify({
      userId: "me",
      id,
      requestBody: { addLabelIds: change.add ?? [], removeLabelIds: change.remove ?? [] },
    }),
  );
}

export async function trashMail(owner: string, id: string): Promise<void> {
  const { client } = await getAuthorizedClient(owner);
  const gmail = google.gmail({ version: "v1", auth: client });
  await withGoogle("Gmail", () => gmail.users.messages.trash({ userId: "me", id }));
}

function eventKind(title: string): CalendarEventKind {
  const lower = title.toLowerCase();
  if (lower.includes("interview") || lower.includes("screen")) return "interview";
  if (lower.includes("review") || lower.includes("debrief")) return "review";
  if (lower.includes("hold") || lower.includes("focus")) return "hold";
  return "personal";
}

function meetLinkOf(event: { hangoutLink?: string | null; conferenceData?: { entryPoints?: { entryPointType?: string | null; uri?: string | null }[] | null } | null }) {
  if (event.hangoutLink) return event.hangoutLink;
  const video = event.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === "video");
  return video?.uri ?? null;
}

export async function listCalendarEvents(
  owner: string,
  fromIso: string,
  toIso: string,
): Promise<CalendarEvent[]> {
  const { client } = await getAuthorizedClient(owner);
  const calendar = google.calendar({ version: "v3", auth: client });
  const response = await withGoogle("Calendar", () =>
    calendar.events.list({
      calendarId: "primary",
      timeMin: fromIso,
      timeMax: toIso,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 100,
      timeZone: calendarTimeZone,
    }),
  );

  return (response.data.items ?? []).map((event) => {
    const start = event.start?.dateTime ?? (event.start?.date ? istAt(event.start.date, 0, 0).toISOString() : new Date().toISOString());
    const end = event.end?.dateTime ?? (event.end?.date ? istAt(event.end.date, 23, 59).toISOString() : start);
    return {
      id: event.id ?? crypto.randomUUID(),
      title: event.summary ?? "(No title)",
      description: event.description ?? "",
      start,
      end,
      attendees: (event.attendees ?? []).map((attendee) => ({
        name: attendee.displayName ?? undefined,
        email: attendee.email ?? "",
      })).filter((attendee) => attendee.email),
      meetLink: meetLinkOf(event),
      htmlLink: event.htmlLink ?? null,
      location: event.location ?? null,
      status: event.status === "tentative" ? "tentative" : event.status === "cancelled" ? "cancelled" : "confirmed",
      kind: eventKind(event.summary ?? ""),
      organizer: event.organizer?.email ?? undefined,
    };
  });
}

export async function createCalendarEvent(
  owner: string,
  input: {
    title: string;
    description?: string;
    start: string;
    end: string;
    attendees?: { name?: string; email: string }[];
    meet?: boolean;
    location?: string;
    notify?: boolean;
    kind?: CalendarEventKind;
    candidateId?: string;
  },
): Promise<CalendarEvent> {
  const { client } = await getAuthorizedClient(owner);
  const calendar = google.calendar({ version: "v3", auth: client });
  const response = await withGoogle("Calendar", () =>
    calendar.events.insert({
      calendarId: "primary",
      conferenceDataVersion: input.meet ? 1 : 0,
      sendUpdates: input.notify ? "all" : "none",
      requestBody: {
        summary: input.title,
        description: input.description ?? "",
        location: input.location,
        start: { dateTime: input.start, timeZone: calendarTimeZone },
        end: { dateTime: input.end, timeZone: calendarTimeZone },
        attendees: input.attendees?.map((attendee) => ({
          email: attendee.email,
          displayName: attendee.name,
        })),
        conferenceData: input.meet
          ? {
              createRequest: {
                requestId: crypto.randomUUID(),
                conferenceSolutionKey: { type: "hangoutsMeet" },
              },
            }
          : undefined,
      },
    }),
  );

  const event = response.data;
  return {
    id: event.id ?? crypto.randomUUID(),
    title: event.summary ?? input.title,
    description: event.description ?? "",
    start: event.start?.dateTime ?? input.start,
    end: event.end?.dateTime ?? input.end,
    attendees: input.attendees ?? [],
    meetLink: meetLinkOf(event),
    htmlLink: event.htmlLink ?? null,
    location: event.location ?? null,
    status: "confirmed",
    kind: input.kind ?? "interview",
    candidateId: input.candidateId,
  };
}

export async function deleteCalendarEvent(owner: string, id: string): Promise<void> {
  const { client } = await getAuthorizedClient(owner);
  const calendar = google.calendar({ version: "v3", auth: client });
  await withGoogle("Calendar", () => calendar.events.delete({ calendarId: "primary", eventId: id }));
}

export async function listDriveFiles(owner: string, query?: string): Promise<DriveFile[]> {
  const { client } = await getAuthorizedClient(owner);
  const drive = google.drive({ version: "v3", auth: client });
  const q = query ? `fullText contains '${query.replace(/'/g, "\\'")}' and trashed = false` : "trashed = false";
  const response = await withGoogle("Drive", () =>
    drive.files.list({
      q,
      pageSize: 20,
      orderBy: "modifiedTime desc",
      fields: "files(id,name,mimeType,modifiedTime,size,webViewLink)",
    }),
  );

  return (response.data.files ?? []).map((file) => ({
    id: file.id ?? "",
    name: file.name ?? "Untitled",
    mimeType: file.mimeType ?? "application/octet-stream",
    modifiedTime: file.modifiedTime ?? new Date().toISOString(),
    size: file.size ? Number(file.size) : null,
    webViewLink: file.webViewLink ?? null,
  }));
}

export async function createDoc(owner: string, title: string, body: string): Promise<WorkspaceFile> {
  const { client } = await getAuthorizedClient(owner);
  const docs = google.docs({ version: "v1", auth: client });
  const created = await withGoogle("Google Docs", () =>
    docs.documents.create({ requestBody: { title } }),
  );
  const documentId = created.data.documentId;
  if (!documentId) throw new Error("Google Docs did not return a document id");

  await withGoogle("Google Docs", () =>
    docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: [{ insertText: { location: { index: 1 }, text: body } }],
      },
    }),
  );

  return {
    id: documentId,
    name: title,
    kind: "doc",
    url: `https://docs.google.com/document/d/${documentId}/edit`,
    createdAt: new Date().toISOString(),
  };
}

export async function appendSheetRow(
  owner: string,
  spreadsheetId: string,
  values: string[],
  range = "A1",
): Promise<{ updatedRange: string; url: string }> {
  const { client } = await getAuthorizedClient(owner);
  const sheets = google.sheets({ version: "v4", auth: client });
  const response = await withGoogle("Google Sheets", () =>
    sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [values] },
    }),
  );
  return {
    updatedRange: response.data.updates?.updatedRange ?? range,
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
  };
}

export async function createSheet(
  owner: string,
  title: string,
  header: string[],
  options: { rows?: string[][]; folderId?: string } = {},
): Promise<WorkspaceFile> {
  const { client } = await getAuthorizedClient(owner);
  const sheets = google.sheets({ version: "v4", auth: client });
  const created = await withGoogle("Google Sheets", () =>
    sheets.spreadsheets.create({
      requestBody: {
        properties: { title },
        sheets: header.length
          ? [{ properties: { title: "Hiring tracker" }, data: [{ startRow: 0, startColumn: 0, rowData: [header, ...(options.rows ?? [])].map((row) => ({ values: row.map((cell) => ({ userEnteredValue: { stringValue: cell } })) })) }] }]
          : undefined,
      },
    }),
  );
  const spreadsheetId = created.data.spreadsheetId;
  if (!spreadsheetId) throw new Error("Google Sheets did not return a spreadsheet id");

  if (header.length > 0 && !created.data.sheets?.length) {
    await withGoogle("Google Sheets", () =>
      sheets.spreadsheets.values.update({
        spreadsheetId,
        range: "A1",
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [header, ...(options.rows ?? [])] },
      }),
    );
  }

  if (options.folderId) {
    const drive = google.drive({ version: "v3", auth: client });
    const current = await withGoogle("Drive", () =>
      drive.files.get({ fileId: spreadsheetId, fields: "parents" }),
    );
    await withGoogle("Drive", () =>
      drive.files.update({
        fileId: spreadsheetId,
        addParents: options.folderId,
        removeParents: current.data.parents?.join(",") || undefined,
        fields: "id,parents",
      }),
    );
  }

  return {
    id: spreadsheetId,
    name: title,
    kind: "sheet",
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    createdAt: new Date().toISOString(),
  };
}

export async function updateSheet(
  owner: string,
  spreadsheetId: string,
  range: string,
  rows: string[][],
): Promise<{ updatedRange: string; url: string }> {
  if (rows.length === 0) throw new Error("No cells to write.");
  const { client } = await getAuthorizedClient(owner);
  const sheets = google.sheets({ version: "v4", auth: client });
  const response = await withGoogle("Google Sheets", () =>
    sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: rows },
    }),
  );
  return {
    updatedRange: response.data.updatedRange ?? range,
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
  };
}

export async function createDriveFolder(
  owner: string,
  name: string,
  parentId?: string,
): Promise<WorkspaceFile> {
  const { client } = await getAuthorizedClient(owner);
  const drive = google.drive({ version: "v3", auth: client });
  const created = await withGoogle("Drive", () =>
    drive.files.create({
      requestBody: {
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: parentId ? [parentId] : undefined,
      },
      fields: "id,name,webViewLink",
    }),
  );
  if (!created.data.id) throw new Error("Google Drive did not return a folder id");
  return {
    id: created.data.id,
    name: created.data.name ?? name,
    kind: "folder",
    url: created.data.webViewLink ?? `https://drive.google.com/drive/folders/${created.data.id}`,
    createdAt: new Date().toISOString(),
  };
}

export function todayRangeInIst() {
  const key = istDateKey(new Date());
  return {
    key,
    from: istAt(key, 0, 0).toISOString(),
    to: istAt(key, 23, 59).toISOString(),
  };
}
