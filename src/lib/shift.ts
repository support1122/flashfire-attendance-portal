import "server-only";
import type { Types } from "mongoose";
import { Attendance, type AttendanceDoc } from "./models";
import { addDays, dayKey } from "./time";

/** A shift that started up to this long ago and has no check-out still counts as the current one. */
export const OPEN_SHIFT_HOURS = 20;

/**
 * The record the "today" card and check-out act on. Night shifts cross IST midnight, so an open
 * check-in from yesterday evening wins over today's (still empty) date.
 */
export async function currentShift(userId: Types.ObjectId, now = new Date()): Promise<AttendanceDoc | null> {
  const today = dayKey(now);
  const open = await Attendance.findOne({
    user: userId,
    date: { $in: [addDays(today, -1), today] },
    checkInAt: { $gte: new Date(now.getTime() - OPEN_SHIFT_HOURS * 3600 * 1000) },
    checkOutAt: null,
  })
    .sort({ date: -1 })
    .lean<AttendanceDoc>();
  if (open) return open;
  return Attendance.findOne({ user: userId, date: today }).lean<AttendanceDoc>();
}
