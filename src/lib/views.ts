import "server-only";
import type { Types } from "mongoose";
import { toPublicUser } from "./auth";
import { Attendance, Leave, User, type AttendanceDoc, type LeaveDoc, type UserDoc } from "./models";
import { dayStatus, summarize } from "./rules";
import { dayKey, daysInMonth } from "./time";
import type { AppSettings, DayCell, LeaveView, PersonMonth } from "./types";

const iso = (date: Date | null | undefined) => (date ? date.toISOString() : null);

/** Serializes leaves with one users query for the whole list, never one per row. */
export async function toLeaveViews(leaves: LeaveDoc[]): Promise<LeaveView[]> {
  const ids = new Set<string>();
  for (const leave of leaves) {
    ids.add(String(leave.user));
    if (leave.decidedBy) ids.add(String(leave.decidedBy));
  }
  const users = await User.find({ _id: { $in: [...ids] } }, { name: 1, email: 1 }).lean<UserDoc[]>();
  const byId = new Map(users.map((u) => [String(u._id), u]));

  return leaves.map((leave) => {
    const owner = byId.get(String(leave.user));
    const decider = leave.decidedBy ? byId.get(String(leave.decidedBy)) : undefined;
    return {
      id: String(leave._id),
      user: { id: String(leave.user), name: owner?.name ?? "Removed user", email: owner?.email ?? "" },
      type: leave.type,
      fromDate: leave.fromDate,
      toDate: leave.toDate,
      halfDay: leave.halfDay,
      days: leave.days,
      dayCount: leave.dayCount,
      reason: leave.reason,
      status: leave.status,
      payType: leave.payType ?? null,
      decidedBy: leave.decidedBy ? { id: String(leave.decidedBy), name: decider?.name ?? "Removed user" } : null,
      decidedAt: iso(leave.decidedAt),
      decisionNote: leave.decisionNote ?? null,
      createdAt: leave.createdAt.toISOString(),
    };
  });
}

/** Builds the month calendar for many people with exactly two queries, whatever the head count. */
export async function loadMonth(users: UserDoc[], month: string, settings: AppSettings): Promise<PersonMonth[]> {
  const days = daysInMonth(month);
  const today = dayKey();
  const userIds: Types.ObjectId[] = users.map((u) => u._id);

  const [records, leaves] = await Promise.all([
    Attendance.find({ user: { $in: userIds }, date: { $gte: days[0], $lte: days[days.length - 1] } }).lean<AttendanceDoc[]>(),
    Leave.find({ user: { $in: userIds }, status: "approved", days: { $in: days } }).lean<LeaveDoc[]>(),
  ]);

  const recordByKey = new Map(records.map((r) => [`${r.user}:${r.date}`, r]));
  const leaveByKey = new Map<string, LeaveDoc>();
  for (const leave of leaves) {
    for (const day of leave.days) leaveByKey.set(`${leave.user}:${day}`, leave);
  }
  const holidayByDay = new Map(settings.holidays.map((h) => [h.date, h.name]));

  return users.map((user) => {
    const joinedDay = dayKey((user as UserDoc & { createdAt: Date }).createdAt);
    const cells: DayCell[] = days.map((day) => {
      const record = recordByKey.get(`${user._id}:${day}`);
      const leave = leaveByKey.get(`${user._id}:${day}`);
      const leaveInfo = leave ? { halfDay: leave.halfDay, payType: leave.payType ?? null } : null;
      const recordInfo = record
        ? { checkInAt: iso(record.checkInAt), checkOutAt: iso(record.checkOutAt), override: record.override ?? null }
        : null;
      return {
        day,
        status: dayStatus({ day, today, joinedDay, settings, record: recordInfo, leave: leaveInfo }),
        checkInAt: recordInfo?.checkInAt ?? null,
        checkOutAt: recordInfo?.checkOutAt ?? null,
        override: recordInfo?.override ?? null,
        overrideNote: record?.overrideNote ?? null,
        leave: leave ? { id: String(leave._id), type: leave.type, ...leaveInfo! } : null,
        holiday: holidayByDay.get(day) ?? null,
      };
    });
    return { user: toPublicUser(user), days: cells, summary: summarize(cells) };
  });
}
