import { isValidObjectId } from "mongoose";
import type { QueryFilter } from "mongoose";
import { requireAdmin } from "@/lib/auth";
import { HttpError, ok, route } from "@/lib/http";
import { LEAVE_STATUSES, Leave, type LeaveDoc } from "@/lib/models";
import { daysInMonth, isMonthKey } from "@/lib/time";
import type { LeaveListResponse } from "@/lib/types";
import { toLeaveViews } from "@/lib/views";

export const GET = route(async (request) => {
  await requireAdmin(request);
  const params = request.nextUrl.searchParams;
  const status = params.get("status") ?? "pending";
  const month = params.get("month");
  const userId = params.get("userId");

  const filter: QueryFilter<LeaveDoc> = {};
  if (status !== "all") {
    if (!(LEAVE_STATUSES as readonly string[]).includes(status)) throw new HttpError(400, "Unknown status filter");
    filter.status = status as LeaveDoc["status"];
  }
  if (month) {
    if (!isMonthKey(month)) throw new HttpError(400, "month must look like 2026-11");
    const days = daysInMonth(month);
    filter.fromDate = { $lte: days[days.length - 1] };
    filter.toDate = { $gte: days[0] };
  }
  if (userId) {
    if (!isValidObjectId(userId)) throw new HttpError(400, "Unknown employee");
    filter.user = userId;
  }

  // Pending: soonest leave first, since those need a decision before the date arrives.
  const sort = status === "pending" ? { fromDate: 1 as const } : { fromDate: -1 as const };
  const leaves = await Leave.find(filter).sort(sort).limit(500).lean<LeaveDoc[]>();
  return ok<LeaveListResponse>({ leaves: await toLeaveViews(leaves) });
});
