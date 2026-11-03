import "server-only";
import type { Types } from "mongoose";
import { after, type NextRequest } from "next/server";
import { sendMail, type Mail } from "./email";
import { User, type UserDoc } from "./models";
import type { LeaveView } from "./types";

/**
 * Leave emails. Each one goes out after the response is sent (next/server `after`), so a slow or broken
 * SMTP server never delays or fails the click that triggered it. Failures are logged, never thrown.
 */

const TYPE: Record<LeaveView["type"], string> = { casual: "casual", sick: "sick", personal: "personal", other: "other" };
const capitalize = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function dateRange(leave: LeaveView): string {
  const fmt = (d: string) => {
    const date = new Date(`${d}T00:00:00Z`);
    const part = (o: Intl.DateTimeFormatOptions) => date.toLocaleDateString("en-IN", { ...o, timeZone: "UTC" });
    return `${part({ weekday: "short" })} ${part({ day: "numeric" })} ${part({ month: "short" })} ${part({ year: "numeric" })}`;
  };
  if (leave.fromDate === leave.toDate) return `${fmt(leave.fromDate)}${leave.halfDay ? " (half day)" : ""}`;
  return `${fmt(leave.fromDate)} to ${fmt(leave.toDate)}`;
}

const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

/** Public base URL for links: APP_URL when set, otherwise the host the request came in on. */
export function appUrl(request: NextRequest): string {
  return (process.env.APP_URL?.trim() || request.nextUrl.origin).replace(/\/$/, "");
}

interface Content {
  subject: string;
  heading: string;
  lines: [label: string, value: string][];
  note?: string;
  cta: { label: string; url: string };
}

function render(c: Content): Omit<Mail, "to"> {
  const rows = c.lines
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#64748b;font-size:14px;white-space:nowrap;vertical-align:top">${escapeHtml(label)}</td><td style="padding:4px 0;font-size:14px;color:#0f172a">${escapeHtml(value)}</td></tr>`,
    )
    .join("");
  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#0f172a">
  <p style="margin:0 0 6px;font-size:13px;color:#ea580c;font-weight:600">Flashfire Attendance</p>
  <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3">${escapeHtml(c.heading)}</h1>
  <table style="border-collapse:collapse;margin:0 0 16px">${rows}</table>
  ${c.note ? `<p style="margin:0 0 16px;padding:12px 14px;background:#f8fafc;border-left:3px solid #cbd5e1;font-size:14px;color:#334155">${escapeHtml(c.note)}</p>` : ""}
  <a href="${escapeHtml(c.cta.url)}" style="display:inline-block;background:#f97316;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 18px;border-radius:8px">${escapeHtml(c.cta.label)}</a>
</div>`;
  const text = [c.heading, "", ...c.lines.map(([l, v]) => `${l}: ${v}`), ...(c.note ? ["", c.note] : []), "", `${c.cta.label}: ${c.cta.url}`].join("\n");
  return { subject: c.subject, html, text };
}

/** Active admins' emails, minus the people who don't need telling (whoever acted, the employee). */
async function adminEmails(exclude: (Types.ObjectId | string)[]): Promise<string[]> {
  const admins = await User.find(
    { role: "admin", isActive: true, _id: { $nin: exclude } },
    { email: 1 },
  ).lean<Pick<UserDoc, "email">[]>();
  return admins.map((a) => a.email);
}

/** One email per person, so nobody sees the other recipients. */
async function deliver(recipients: string[], content: Omit<Mail, "to">, event: string) {
  const unique = [...new Set(recipients)];
  const results = await Promise.allSettled(unique.map((to) => sendMail({ ...content, to })));
  results.forEach((r, i) => {
    if (r.status === "rejected") console.error(`[notify] ${event} email to ${unique[i]} failed`, r.reason);
  });
}

function schedule(event: string, job: () => Promise<void>) {
  after(async () => {
    try {
      await job();
    } catch (error) {
      console.error(`[notify] ${event} failed`, error);
    }
  });
}

function leaveLines(leave: LeaveView): Content["lines"] {
  return [
    ["Employee", `${leave.user.name} (${leave.user.email})`],
    ["Dates", dateRange(leave)],
    ["Type", `${capitalize(TYPE[leave.type])}, ${days(leave.dayCount)}`],
    ["Reason", leave.reason],
  ];
}

/** New request: every admin except the requester hears about it. */
export function notifyLeaveRequested(request: NextRequest, leave: LeaveView) {
  const base = appUrl(request);
  schedule("leave_requested", async () => {
    const to = await adminEmails([leave.user.id]);
    await deliver(
      to,
      render({
        subject: `Leave request: ${leave.user.name}, ${days(leave.dayCount)}`,
        heading: `${leave.user.name} asked for ${days(leave.dayCount)} of ${TYPE[leave.type]} leave`,
        lines: leaveLines(leave),
        cta: { label: "Review request", url: `${base}/admin/leaves` },
      }),
      "leave_requested",
    );
  });
}

/** The employee withdrew a pending request: admins can stop worrying about it. */
export function notifyLeaveWithdrawn(request: NextRequest, leave: LeaveView) {
  const base = appUrl(request);
  schedule("leave_withdrawn", async () => {
    const to = await adminEmails([leave.user.id]);
    await deliver(
      to,
      render({
        subject: `Leave withdrawn: ${leave.user.name}`,
        heading: `${leave.user.name} withdrew a leave request`,
        lines: leaveLines(leave),
        cta: { label: "Open leave requests", url: `${base}/admin/leaves` },
      }),
      "leave_withdrawn",
    );
  });
}

export type DecisionAction = "approve" | "reject" | "revoke" | "set_pay";

/**
 * An admin acted on a request. The employee gets their own email; the other admins get a copy so
 * everyone sees the same decision. The admin who acted is not emailed about their own click.
 */
export function notifyLeaveDecision(request: NextRequest, leave: LeaveView, action: DecisionAction, actor: UserDoc) {
  const base = appUrl(request);
  const pay = leave.payType ? (leave.payType === "paid" ? "Paid" : "Unpaid") : "Not set";
  const verb = { approve: "approved", reject: "rejected", revoke: "revoked", set_pay: "updated" }[action];

  schedule(`leave_${action}`, async () => {
    const lines: Content["lines"] = [...leaveLines(leave)];
    if (leave.status === "approved") lines.push(["Pay", pay]);
    lines.push(["Decided by", actor.name]);
    const note = leave.decisionNote && action !== "set_pay" ? `Note from ${actor.name}: ${leave.decisionNote}` : undefined;

    const employeeHeading = {
      approve: `Your leave is approved (${pay.toLowerCase()})`,
      reject: "Your leave request was rejected",
      revoke: "Your approved leave was revoked",
      set_pay: `Your leave is now marked ${pay.toLowerCase()}`,
    }[action];
    const adminHeading = {
      approve: `${actor.name} approved ${leave.user.name}'s leave as ${pay.toLowerCase()}`,
      reject: `${actor.name} rejected ${leave.user.name}'s leave`,
      revoke: `${actor.name} revoked ${leave.user.name}'s approved leave`,
      set_pay: `${actor.name} marked ${leave.user.name}'s leave ${pay.toLowerCase()}`,
    }[action];

    const jobs: Promise<void>[] = [];
    if (String(actor._id) !== leave.user.id) {
      jobs.push(
        deliver(
          [leave.user.email],
          render({
            subject: `Leave ${verb}: ${dateRange(leave)}`,
            heading: employeeHeading,
            lines,
            note,
            cta: { label: "See my leave", url: `${base}/leaves` },
          }),
          `leave_${action}_employee`,
        ),
      );
    }
    const admins = await adminEmails([actor._id, leave.user.id]);
    jobs.push(
      deliver(
        admins,
        render({
          subject: `Leave ${verb}: ${leave.user.name}, ${dateRange(leave)}`,
          heading: adminHeading,
          lines,
          note,
          cta: { label: "Open leave requests", url: `${base}/admin/leaves` },
        }),
        `leave_${action}_admins`,
      ),
    );
    await Promise.all(jobs);
  });
}
