import { isValidObjectId } from "mongoose";
import { requireUser } from "@/lib/auth";
import { HttpError, ok, route } from "@/lib/http";
import { Leave, type LeaveDoc } from "@/lib/models";
import { notifyLeaveWithdrawn } from "@/lib/notify";
import type { LeaveResponse } from "@/lib/types";
import { toLeaveViews } from "@/lib/views";

/** Employees can withdraw their own request while it is still pending. Decided requests go through an admin. */
export const POST = route(async (request, ctx: RouteContext<"/api/leaves/[id]/cancel">) => {
  const user = await requireUser(request);
  const { id } = await ctx.params;
  if (!isValidObjectId(id)) throw new HttpError(404, "Leave request not found");

  const updated = await Leave.findOneAndUpdate(
    { _id: id, user: user._id, status: "pending" },
    { $set: { status: "cancelled" } },
    { returnDocument: "after", lean: true },
  );
  if (!updated) {
    const existing = await Leave.findOne({ _id: id, user: user._id }, { status: 1 }).lean();
    if (!existing) throw new HttpError(404, "Leave request not found");
    throw new HttpError(409, `This request is already ${existing.status}, so it can't be withdrawn. Ask an admin.`);
  }
  const [leave] = await toLeaveViews([updated as LeaveDoc]);
  notifyLeaveWithdrawn(request, leave);
  return ok<LeaveResponse>({ leave });
});
