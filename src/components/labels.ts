import type { Tone } from "./ui";
import type { DayCell, DayStatus, LeaveStatus, LeaveType, PayType } from "@/lib/types";

export const LEAVE_TYPE_LABEL: Record<LeaveType, string> = {
  casual: "Casual",
  sick: "Sick",
  personal: "Personal",
  other: "Other",
};

export const LEAVE_STATUS: Record<LeaveStatus, { label: string; tone: Tone }> = {
  pending: { label: "Pending", tone: "amber" },
  approved: { label: "Approved", tone: "green" },
  rejected: { label: "Rejected", tone: "red" },
  cancelled: { label: "Withdrawn", tone: "slate" },
};

export const PAY_LABEL: Record<PayType, { label: string; tone: Tone }> = {
  paid: { label: "Paid", tone: "blue" },
  unpaid: { label: "Unpaid", tone: "orange" },
};

/** Calendar cell look. `short` is what fits in a grid cell. */
export const DAY_STYLE: Record<DayStatus, { label: string; short: string; cell: string }> = {
  present: { label: "Present", short: "P", cell: "bg-emerald-100 text-emerald-800" },
  half_day: { label: "Half day", short: "½", cell: "bg-lime-100 text-lime-800" },
  absent: { label: "Absent", short: "A", cell: "bg-red-100 text-red-700" },
  leave: { label: "Leave", short: "L", cell: "bg-sky-100 text-sky-800" },
  off: { label: "Off / holiday", short: "", cell: "bg-slate-100 text-slate-400" },
  not_marked: { label: "Not marked yet", short: "?", cell: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-300" },
  upcoming: { label: "Upcoming", short: "", cell: "bg-white text-slate-300" },
  before_joining: { label: "Before joining", short: "", cell: "bg-white text-slate-300" },
};

const UNPAID_LEAVE = { label: "Unpaid leave", short: "U", cell: "bg-orange-100 text-orange-800" };
const PAID_LEAVE = { label: "Paid leave", short: "L", cell: "bg-sky-100 text-sky-800" };

/** Look of one calendar cell. Leave splits by pay type so payroll can read the grid at a glance. */
export function cellStyle(cell: Pick<DayCell, "status" | "leave">) {
  if (cell.status === "leave") return cell.leave?.payType === "unpaid" ? UNPAID_LEAVE : PAID_LEAVE;
  return DAY_STYLE[cell.status];
}

export const LEGEND = [
  DAY_STYLE.present,
  DAY_STYLE.half_day,
  DAY_STYLE.absent,
  PAID_LEAVE,
  UNPAID_LEAVE,
  DAY_STYLE.not_marked,
  DAY_STYLE.off,
];

export function leaveRange(from: string, to: string, halfDay: boolean): string {
  const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
  if (from === to) return `${fmt(from)}${halfDay ? " (half day)" : ""}`;
  return `${fmt(from)} to ${fmt(to)}`;
}

export function dayCountLabel(count: number): string {
  return `${count} ${count === 1 ? "day" : "days"}`;
}
