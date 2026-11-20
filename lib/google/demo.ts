import "server-only";
import type { CalendarEvent, CalendarEventKind, MailMessage } from "@/lib/types";
import { addDays, istAt, istDateKey, startOfIstDay } from "@/lib/time";

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

function daysAgo(days: number, hour = 10) {
  const day = addDays(startOfIstDay(new Date()), -days);
  return istAt(istDateKey(day), hour, 0).toISOString();
}

/**
 * A believable inbox for the demo workspace. Marked `demo: true` everywhere so
 * the UI never pretends these are live Gmail messages.
 */
export function demoMail(): MailMessage[] {
  return [
    {
      id: "demo-mail-1",
      threadId: "demo-thread-1",
      from: { name: "Sana Khan", email: "sana.k@example.com" },
      to: [{ name: "Meera Raghavan", email: "meera@northstar.example" }],
      subject: "Re: Next step · Customer Support Executive",
      snippet: "Friday at 3:00 PM works well for me. Could you confirm the Meet link?",
      body: `Hi Meera,

Thank you for the update — Friday at 3:00 PM works well for me. Could you confirm the Google Meet link when it is ready?

I have one question: will the conversation be in English, or should I be ready for a short Hindi role-play as well?

Thanks,
Sana`,
      date: hoursAgo(0.6),
      unread: true,
      starred: true,
      labels: ["INBOX", "UNREAD", "STARRED", "CATEGORY_PERSONAL"],
      hasAttachment: false,
      candidateId: "cand-sana",
      demo: true,
    },
    {
      id: "demo-mail-2",
      threadId: "demo-thread-2",
      from: { name: "Manoj Patil", email: "manoj.p@example.com" },
      to: [{ name: "Meera Raghavan", email: "meera@northstar.example" }],
      subject: "Thanks for the interview",
      snippet: "The questions felt practical, especially the refund scenario.",
      body: `Hi Meera,

Thanks for the conversation today. The questions felt practical, especially the refund scenario — that is close to what I handle now.

I have attached my shift preference: I can cover the 6 PM–2 AM IST window if that helps.

Regards,
Manoj`,
      date: hoursAgo(2.2),
      unread: true,
      starred: false,
      labels: ["INBOX", "UNREAD", "CATEGORY_PERSONAL"],
      hasAttachment: true,
      candidateId: "cand-manoj",
      demo: true,
    },
    {
      id: "demo-mail-3",
      threadId: "demo-thread-3",
      from: { name: "Priya Nair", email: "priya.n@example.com" },
      to: [{ name: "Meera Raghavan", email: "meera@northstar.example" }],
      subject: "Question about the role",
      snippet: "Is the role open to candidates who need a month of notice?",
      body: `Hello,

I completed the voice interview yesterday and had a quick question. Is the role open to candidates who need about a month of notice?

I am currently on a support desk and want to hand over properly before moving.

Thank you,
Priya`,
      date: hoursAgo(4.4),
      unread: true,
      starred: false,
      labels: ["INBOX", "UNREAD", "CATEGORY_PERSONAL"],
      hasAttachment: false,
      candidateId: "cand-priya",
      demo: true,
    },
    {
      id: "demo-mail-4",
      threadId: "demo-thread-4",
      from: { name: "Aisha Verma", email: "aisha@northstar.example" },
      to: [{ name: "Meera Raghavan", email: "meera@northstar.example" }],
      subject: "Panel debrief · support cohort",
      snippet: "Can we keep Thursday 5 PM for the debrief? Two candidates need a second look.",
      body: `Meera,

Can we keep Thursday 5 PM for the debrief? Two candidates need a second look — Rahul (unverified listening quote) and Neha (insufficient evidence).

I would rather take 20 minutes as a panel than send either of them forward on a weak signal.

Aisha
Hiring manager · Customer Operations`,
      date: hoursAgo(6),
      unread: false,
      starred: true,
      labels: ["INBOX", "STARRED", "CATEGORY_PERSONAL"],
      hasAttachment: false,
      demo: true,
    },
    {
      id: "demo-mail-5",
      threadId: "demo-thread-5",
      from: { name: "Google Calendar", email: "calendar-notification@google.com" },
      to: [{ name: "Meera Raghavan", email: "meera@northstar.example" }],
      subject: "Invitation: Interview · Manoj Patil @ Thu 20 Nov 10:00",
      snippet: "You have been invited to the following event: Interview · Manoj Patil.",
      body: `You have been invited to the following event.

Interview · Manoj Patil
Thursday 20 November · 10:00–10:30 IST
Google Meet joining info: https://meet.google.com/demo-hvx-abc

Attendees: Manoj Patil, Meera Raghavan`,
      date: hoursAgo(8),
      unread: false,
      starred: false,
      labels: ["INBOX", "CATEGORY_UPDATES"],
      hasAttachment: false,
      demo: true,
    },
    {
      id: "demo-mail-6",
      threadId: "demo-thread-6",
      from: { name: "Drive", email: "drive-shares-noreply@google.com" },
      to: [{ name: "Meera Raghavan", email: "meera@northstar.example" }],
      subject: "Rahul Mehta shared “Rahul-Mehta-Resume.pdf” with you",
      snippet: "Rahul Mehta shared a file with you.",
      body: `Rahul Mehta (rahul.m@example.com) shared a file with you.

Rahul-Mehta-Resume.pdf · 212 KB

Open in Drive: https://drive.google.com/file/d/demo-rahul-resume/view

This is a demo message. No file is attached.`,
      date: hoursAgo(11),
      unread: false,
      starred: false,
      labels: ["INBOX", "CATEGORY_UPDATES"],
      hasAttachment: true,
      candidateId: "cand-rahul",
      demo: true,
    },
    {
      id: "demo-mail-7",
      threadId: "demo-thread-7",
      from: { name: "Neha Desai", email: "neha.d@example.com" },
      to: [{ name: "Meera Raghavan", email: "meera@northstar.example" }],
      subject: "Rescheduling request",
      snippet: "I had network trouble during question 3. Could I redo the screen?",
      body: `Hi Meera,

I had network trouble during question 3 and my answers did not go through properly. Could I redo the screen?

I am free any evening this week after 7 PM.

Thank you,
Neha`,
      date: hoursAgo(13),
      unread: true,
      starred: false,
      labels: ["INBOX", "UNREAD", "CATEGORY_PERSONAL"],
      hasAttachment: false,
      candidateId: "cand-neha",
      demo: true,
    },
    {
      id: "demo-mail-8",
      threadId: "demo-thread-8",
      from: { name: "Karan Thakur", email: "karan.t@example.com" },
      to: [{ name: "Meera Raghavan", email: "meera@northstar.example" }],
      subject: "Re: Your Customer Support interview",
      snippet: "Thanks for the specific feedback — I practiced the refund scenario.",
      body: `Hi Meera,

Thanks for the specific feedback — I practised the refund scenario with a friend and it already feels less rushed.

If a future opening comes up, I would like to try again.

Karan`,
      date: daysAgo(1, 17),
      unread: false,
      starred: false,
      labels: ["INBOX", "CATEGORY_PERSONAL"],
      hasAttachment: false,
      candidateId: "cand-karan",
      demo: true,
    },
    {
      id: "demo-mail-9",
      threadId: "demo-thread-9",
      from: { name: "Vikram Joshi", email: "vikram.j@example.com" },
      to: [{ name: "Meera Raghavan", email: "meera@northstar.example" }],
      subject: "Assessment link did not open",
      snippet: "The link expired before I could finish. I have screenshots.",
      body: `Hello,

The assessment link expired before I could finish. I have screenshots of the error if that helps.

Can someone resend it? I am still interested in the role.

Vikram`,
      date: daysAgo(1, 12),
      unread: false,
      starred: false,
      labels: ["INBOX", "CATEGORY_PERSONAL"],
      hasAttachment: true,
      candidateId: "cand-vikram",
      demo: true,
    },
    {
      id: "demo-mail-10",
      threadId: "demo-thread-10",
      from: { name: "Meera Raghavan", email: "meera@northstar.example" },
      to: [{ name: "Aisha Verma", email: "aisha@northstar.example" }],
      subject: "Tracker · week of 17 Nov",
      snippet: "Updated the hiring tracker with this week's decisions.",
      body: `Aisha,

Updated the hiring tracker with this week's decisions. Six candidates are waiting for review, none has been rejected automatically.

Meera`,
      date: daysAgo(2, 18),
      unread: false,
      starred: false,
      labels: ["SENT"],
      hasAttachment: false,
      demo: true,
    },
  ];
}

function event(input: {
  id: string;
  title: string;
  dayOffset: number;
  hour: number;
  minute?: number;
  minutes: number;
  kind: CalendarEventKind;
  description?: string;
  attendees?: { name?: string; email: string }[];
  meet?: string;
  candidateId?: string;
}): CalendarEvent {
  const day = addDays(startOfIstDay(new Date()), input.dayOffset);
  const start = istAt(istDateKey(day), input.hour, input.minute ?? 0);
  const end = new Date(start.getTime() + input.minutes * 60_000);
  return {
    id: input.id,
    title: input.title,
    description: input.description ?? "",
    start: start.toISOString(),
    end: end.toISOString(),
    attendees: input.attendees ?? [],
    meetLink: input.meet ?? null,
    htmlLink: null,
    location: input.meet ? "Google Meet" : null,
    status: "confirmed",
    kind: input.kind,
    candidateId: input.candidateId,
    demo: true,
    organizer: "meera@northstar.example",
  };
}

export function demoCalendarEvents(): CalendarEvent[] {
  return [
    event({
      id: "demo-evt-1",
      title: "Interview · Manoj Patil",
      dayOffset: 0,
      hour: 10,
      minutes: 30,
      kind: "interview",
      description: "Second round · Customer Support Executive. Rubric: support-exec v3.",
      attendees: [
        { name: "Manoj Patil", email: "manoj.p@example.com" },
        { name: "Meera Raghavan", email: "meera@northstar.example" },
      ],
      meet: "https://meet.google.com/demo-hvx-abc",
      candidateId: "cand-manoj",
    }),
    event({
      id: "demo-evt-2",
      title: "Review · support cohort",
      dayOffset: 0,
      hour: 13,
      minutes: 30,
      kind: "review",
      description: "Four candidates need a human decision. Rahul has an unverified quote.",
      attendees: [{ name: "Aisha Verma", email: "aisha@northstar.example" }],
    }),
    event({
      id: "demo-evt-3",
      title: "Interview · Sana Khan",
      dayOffset: 0,
      hour: 15,
      minutes: 30,
      kind: "interview",
      description: "Final conversation · shift and language fit.",
      attendees: [
        { name: "Sana Khan", email: "sana.k@example.com" },
        { name: "Meera Raghavan", email: "meera@northstar.example" },
      ],
      meet: "https://meet.google.com/demo-hvx-sana",
      candidateId: "cand-sana",
    }),
    event({
      id: "demo-evt-4",
      title: "Interview · Ayesha Siddiqui",
      dayOffset: 1,
      hour: 11,
      minutes: 30,
      kind: "interview",
      description: "Hiring manager screen.",
      attendees: [
        { name: "Ayesha Siddiqui", email: "ayesha.s@example.com" },
        { name: "Aisha Verma", email: "aisha@northstar.example" },
      ],
      meet: "https://meet.google.com/demo-hvx-ayesha",
      candidateId: "cand-ayesha",
    }),
    event({
      id: "demo-evt-5",
      title: "Hold · deep work",
      dayOffset: 2,
      hour: 14,
      minutes: 60,
      kind: "hold",
      description: "No meetings. Playbook review for the back-office role.",
    }),
    event({
      id: "demo-evt-6",
      title: "Interview · Neha Desai",
      dayOffset: 3,
      hour: 16,
      minutes: 30,
      kind: "interview",
      description: "Re-run after a network drop. Evidence quality was low.",
      attendees: [
        { name: "Neha Desai", email: "neha.d@example.com" },
        { name: "Meera Raghavan", email: "meera@northstar.example" },
      ],
      meet: "https://meet.google.com/demo-hvx-neha",
      candidateId: "cand-neha",
    }),
    event({
      id: "demo-evt-7",
      title: "Panel debrief · week of 17 Nov",
      dayOffset: 1,
      hour: 17,
      minutes: 45,
      kind: "review",
      description: "Decide on the four in-review candidates. No automatic rejections.",
      attendees: [
        { name: "Aisha Verma", email: "aisha@northstar.example" },
        { name: "Meera Raghavan", email: "meera@northstar.example" },
      ],
    }),
    event({
      id: "demo-evt-8",
      title: "1:1 · Aisha",
      dayOffset: 5,
      hour: 12,
      minutes: 30,
      kind: "personal",
      description: "Weekly check-in.",
      attendees: [{ name: "Aisha Verma", email: "aisha@northstar.example" }],
    }),
    event({
      id: "demo-evt-9",
      title: "Interview · Vikram Joshi",
      dayOffset: -1,
      hour: 9,
      minutes: 30,
      kind: "interview",
      description: "Completed. Evidence: borderline, needs review.",
      attendees: [
        { name: "Vikram Joshi", email: "vikram.j@example.com" },
        { name: "Meera Raghavan", email: "meera@northstar.example" },
      ],
      candidateId: "cand-vikram",
    }),
  ];
}
