import { requireUser } from "@/lib/auth";
import { ok, readJson, route } from "@/lib/http";
import { createLeave, createLeaveSchema } from "@/lib/leaves";
import { Leave, type LeaveDoc } from "@/lib/models";
import { notifyLeaveRequested } from "@/lib/notify";
import type { LeaveListResponse, LeaveResponse } from "@/lib/types";
import { toLeaveViews } from "@/lib/views";

export const GET = route(async (request) => {
  const user = await requireUser(request);
  const leaves = await Leave.find({ user: user._id }).sort({ fromDate: -1 }).limit(200).lean<LeaveDoc[]>();
  return ok<LeaveListResponse>({ leaves: await toLeaveViews(leaves) });
});

export const POST = route(async (request) => {
  const user = await requireUser(request);
  const input = await readJson(request, createLeaveSchema);
  const created = await createLeave(user, input);
  const [leave] = await toLeaveViews([created.toObject() as LeaveDoc]);
  notifyLeaveRequested(request, leave);
  return ok<LeaveResponse>({ leave }, 201);
});
