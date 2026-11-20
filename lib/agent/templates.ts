export function inviteEmail(candidateName: string, roleTitle: string, org = "Northstar BPO") {
  return `Hi ${candidateName.split(" ")[0]},

Thank you for your interest in the ${roleTitle} role at ${org}.

The next step is a short voice interview, about four minutes. You can do it on your phone, in English or Hindi, whenever you have a quiet moment.

What to expect:
· Four questions about customer situations.
· No trick questions and no timer counting down.
· A recruiter reads the transcript before any decision is made.

If you need more time or a different format, reply to this email and we will adjust.

Warmly,
Meera
${org}`;
}

export function feedbackEmail(
  candidateName: string,
  roleTitle: string,
  strength: string,
  gap: string | null,
  org = "Northstar BPO",
) {
  return `Hi ${candidateName.split(" ")[0]},

Thank you for taking the time to speak with us about the ${roleTitle} role.

I wanted to share what came through, because specific feedback is more useful than silence.

What came through: ${strength}
${gap ? `\nOne area that needed more evidence: ${gap}\n` : ""}
One thing that may help next time: when a customer has already tried the obvious step, name that and offer one concrete next action. Practising a short role-play with a friend can help.

You are welcome to use the free practice interview any time. If you would like your details removed from our records, reply and we will do that.

Warmly,
Meera
${org}`;
}

export function generalEmail(candidateName: string, roleTitle: string, org = "Northstar BPO") {
  return `Hi ${candidateName.split(" ")[0]},

A quick note about your ${roleTitle} application at ${org}. Nothing has gone wrong; we are still working through this week's interviews.

If anything has changed on your side — availability, notice period, or the format you need — just reply here and we will take it into account.

Warmly,
Meera
${org}`;
}

export function schedulingEmail(candidateName: string, roleTitle: string, slots: string[], org = "Northstar BPO") {
  return `Hi ${candidateName.split(" ")[0]},

Thank you for completing the voice screen for the ${roleTitle} role.

The team would like to meet you for a short conversation. Would either of these work?

${slots.map((slot) => `· ${slot}`).join("\n")}

Both are 30 minutes, on Google Meet. Reply with the one that suits you and we will send the invite.

Warmly,
Meera
${org}`;
}

export function followUpEmail(candidateName: string, roleTitle: string, org = "Northstar BPO") {
  return `Hi ${candidateName.split(" ")[0]},

A quick note about your ${roleTitle} application — we have not forgotten it. The team is reviewing this week's interviews and will come back to you by Friday.

If anything has changed on your side, just reply here.

Warmly,
Meera
${org}`;
}

export type OfferLetterDraftInput = {
  candidateName: string;
  candidateEmail?: string;
  roleTitle: string;
  compensation: string;
  startDate: string;
  location?: string;
  shift?: string;
  reportingManager?: string;
  noticePeriod?: string;
  probationMonths?: string;
  org?: string;
  recruiterName?: string;
};

export function offerLetterDocument(input: OfferLetterDraftInput): string {
  const org = input.org || "Northstar BPO";
  const recruiter = input.recruiterName || "Meera Nair, Hiring Lead";
  const today = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return `${org.toUpperCase()} — EMPLOYMENT OFFER LETTER

Date: ${today}
Candidate: ${input.candidateName}${input.candidateEmail ? `\nEmail: ${input.candidateEmail}` : ""}

Dear ${input.candidateName},

We are pleased to offer you the position of ${input.roleTitle} at ${org}. Following your voice assessment and recruiter review, we believe your communication clarity and customer-handling judgment will be a strong addition to the team.

KEY OFFER TERMS
• Position: ${input.roleTitle}
• Compensation: ${input.compensation}
• Joining Date: ${input.startDate}
• Work Location: ${input.location || "Bengaluru / Hybrid"}
• Shift Window: ${input.shift || "Rotational day shift (IST)"}
• Reporting To: ${input.reportingManager || "Operations Team Lead"}
• Probation Period: ${input.probationMonths || "3 months"}
• Notice Period: ${input.noticePeriod || "30 days"}

ONBOARDING & NEXT STEPS
1. Please review the terms above and reply with your written confirmation within 3 business days.
2. Carry a valid government ID, address proof, and prior relieving/experience documents (if applicable) on Day 1.
3. Our people team will share your induction schedule and system credentials 48 hours prior to joining.

This offer is contingent upon standard reference and document verification. If you have any questions about compensation, shift timings, or onboarding, please reach out directly.

Warm regards,

${recruiter}
${org}

------------------------------------------------------------
CANDIDATE ACCEPTANCE

I, ${input.candidateName}, accept the offer of employment for the role of ${input.roleTitle} under the terms outlined above.

Signature: ___________________________    Date: _______________`;
}

export function offerEmail(input: OfferLetterDraftInput): string {
  const org = input.org || "Northstar BPO";
  const first = input.candidateName.split(" ")[0] || input.candidateName;
  return `Hi ${first},

Congratulations! We are delighted to extend an offer for the ${input.roleTitle} role at ${org}.

Offer summary:
• Role: ${input.roleTitle}
• Compensation: ${input.compensation}
• Proposed Joining Date: ${input.startDate}
• Location: ${input.location || "Bengaluru / Hybrid"}
• Shift: ${input.shift || "Day shift (IST)"}

Please reply to confirm your acceptance or let us know if you would like a quick 10-minute call to walk through any details.

Warmly,
${input.recruiterName || "Meera"}
${org}`;
}
