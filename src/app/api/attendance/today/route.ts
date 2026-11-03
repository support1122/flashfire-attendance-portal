import { requireUser } from "@/lib/auth";
import { ok, route } from "@/lib/http";
import { Leave } from "@/lib/models";
import { getSettings } from "@/lib/settings";
import { currentShift } from "@/lib/shift";
import { dayKey, weekdayOf } from "@/lib/time";
import type { TodayResponse } from "@/lib/types";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const GET = route(async (request) => {
  const user = await requireUser(request);
  const today = dayKey();
  const [shift, settings, leave] = await Promise.all([
    currentShift(user._id),
    getSettings(),
    Leave.findOne({ user: user._id, status: "approved", days: today }).lean(),
  ]);
  const holiday = settings.holidays.find((h) => h.date === today);
  const offReason = holiday
    ? `Holiday: ${holiday.name}`
    : settings.weeklyOffDays.includes(weekdayOf(today))
      ? `${WEEKDAYS[weekdayOf(today)]} is a weekly off`
      : null;

  return ok<TodayResponse>({
    today: {
      date: shift?.date ?? today,
      checkInAt: shift?.checkInAt?.toISOString() ?? null,
      checkOutAt: shift?.checkOutAt?.toISOString() ?? null,
    },
    offReason,
    leaveToday: leave ? { halfDay: leave.halfDay, payType: leave.payType ?? null } : null,
  });
});
