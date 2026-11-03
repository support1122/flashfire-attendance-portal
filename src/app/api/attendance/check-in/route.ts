import { requireUser } from "@/lib/auth";
import { HttpError, ok, route } from "@/lib/http";
import { Attendance } from "@/lib/models";
import { currentShift } from "@/lib/shift";
import { dayKey } from "@/lib/time";

export const POST = route(async (request) => {
  const user = await requireUser(request);
  const now = new Date();
  const open = await currentShift(user._id, now);
  if (open?.checkInAt && !open.checkOutAt) {
    throw new HttpError(409, "You are already checked in. Check out first.");
  }
  const date = dayKey(now);
  try {
    // Matches today's row only while it has no check-in (it may exist because an admin set an override).
    await Attendance.updateOne(
      { user: user._id, date, checkInAt: null },
      { $set: { checkInAt: now } },
      { upsert: true },
    );
  } catch (error) {
    // The upsert hit the unique (user, date) index: today already has a check-in.
    if ((error as { code?: number }).code === 11000) {
      throw new HttpError(409, "You already checked in today.");
    }
    throw error;
  }
  return ok({ date, checkInAt: now.toISOString() });
});
