import { requireAdmin, toPublicUser } from "@/lib/auth";
import { ok, route } from "@/lib/http";
import { Attendance, Leave, User, type AttendanceDoc, type LeaveDoc, type UserDoc } from "@/lib/models";
import { nonWorking } from "@/lib/rules";
import { getSettings } from "@/lib/settings";
import { OPEN_SHIFT_HOURS } from "@/lib/shift";
import { addDays, dayKey } from "@/lib/time";
import type { OverviewResponse } from "@/lib/types";

export const GET = route(async (request) => {
  await requireAdmin(request);
  const now = new Date();
  const today = dayKey(now);

  const [users, records, leaves, pendingLeaves, settings] = await Promise.all([
    User.find({ isActive: true }).sort({ name: 1 }).lean<UserDoc[]>(),
    Attendance.find({
      checkInAt: { $ne: null },
      $or: [
        { date: today },
        // Night shifts that started yesterday evening and are still running.
        { date: addDays(today, -1), checkOutAt: null, checkInAt: { $gte: new Date(now.getTime() - OPEN_SHIFT_HOURS * 3600 * 1000) } },
      ],
    }).lean<AttendanceDoc[]>(),
    Leave.find({ status: "approved", days: today }).lean<LeaveDoc[]>(),
    Leave.countDocuments({ status: "pending" }),
    getSettings(),
  ]);

  const recordByUser = new Map<string, AttendanceDoc>();
  for (const record of records) {
    const key = String(record.user);
    const existing = recordByUser.get(key);
    // Prefer today's row over yesterday's open shift when both exist.
    if (!existing || record.date > existing.date) recordByUser.set(key, record);
  }
  const leaveByUser = new Map(leaves.map((l) => [String(l.user), l]));

  const checkedIn: OverviewResponse["checkedIn"] = [];
  const onLeave: OverviewResponse["onLeave"] = [];
  const notMarked: OverviewResponse["notMarked"] = [];
  for (const user of users) {
    const record = recordByUser.get(String(user._id));
    const leave = leaveByUser.get(String(user._id));
    if (record?.checkInAt) {
      checkedIn.push({
        user: toPublicUser(user),
        checkInAt: record.checkInAt.toISOString(),
        checkOutAt: record.checkOutAt?.toISOString() ?? null,
      });
    } else if (leave) {
      onLeave.push({ user: toPublicUser(user), halfDay: leave.halfDay, payType: leave.payType ?? null, type: leave.type });
    } else {
      notMarked.push(toPublicUser(user));
    }
  }
  // A half-day leave plus a check-in shows under checked in; the leave still counts for payroll.

  return ok<OverviewResponse>({
    today,
    isOffDay: nonWorking(today, settings),
    counts: {
      employees: users.length,
      checkedIn: checkedIn.length,
      onLeave: onLeave.length,
      notMarked: notMarked.length,
      pendingLeaves,
    },
    checkedIn,
    onLeave,
    notMarked,
  });
});
