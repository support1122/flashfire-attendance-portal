import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { HttpError, ok, readJson, route } from "@/lib/http";
import { Leave, PAY_TYPES, User, type LeaveDoc, type LeaveStatus } from "@/lib/models";
import { notifyLeaveDecision } from "@/lib/notify";
import type { LeaveResponse } from "@/lib/types";
import { toLeaveViews } from "@/lib/views";

const note = z.string().trim().max(500, { error: "Keep the note under 500 characters" }).optional();
const payType = z.enum(PAY_TYPES, { error: "Choose paid or unpaid" });

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), payType, note }),
  z.object({ action: z.literal("reject"), note }),
  z.object({ action: z.literal("set_pay"), payType }),
  z.object({ action: z.literal("revoke"), note }),
]);

/** Which status each action starts from, and where it leaves the request. */
const TRANSITIONS = {
  approve: { from: "pending", to: "approved" },
  reject: { from: "pending", to: "rejected" },
  set_pay: { from: "approved", to: "approved" },
  revoke: { from: "approved", to: "cancelled" },
} as const satisfies Record<string, { from: LeaveStatus; to: LeaveStatus }>;

export const PATCH = route(async (request, ctx: RouteContext<"/api/admin/leaves/[id]">) => {
  const admin = await requireAdmin(request);
  const { id } = await ctx.params;
  if (!isValidObjectId(id)) throw new HttpError(404, "Leave request not found");
  const input = await readJson(request, body);

  const current = await Leave.findById(id).lean<LeaveDoc>();
  if (!current) throw new HttpError(404, "Leave request not found");

  if (String(current.user) === String(admin._id)) {
    const otherAdmins = await User.countDocuments({ role: "admin", isActive: true, _id: { $ne: admin._id } });
    if (otherAdmins > 0) throw new HttpError(403, "Another admin has to decide your own leave.");
  }

  const { from, to } = TRANSITIONS[input.action];
  const update: Record<string, unknown> = { status: to };
  if (input.action === "set_pay") {
    update.payType = input.payType;
  } else {
    update.decidedBy = admin._id;
    update.decidedAt = new Date();
    update.decisionNote = input.note || null;
    if (input.action === "approve") update.payType = input.payType;
    if (input.action === "reject") update.payType = null;
  }

  // The status guard in the filter makes concurrent decisions safe: only the first one matches.
  const updated = await Leave.findOneAndUpdate({ _id: id, status: from }, { $set: update }, {
    returnDocument: "after",
    lean: true,
  });
  if (!updated) {
    const latest = await Leave.findById(id, { status: 1 }).lean();
    throw new HttpError(409, `This request is ${latest?.status ?? "gone"} now, so that action no longer applies. Refresh.`);
  }
  const [leave] = await toLeaveViews([updated as LeaveDoc]);
  // Switching to the pay type it already had is a no-op; nobody needs an email for that.
  if (!(input.action === "set_pay" && current.payType === input.payType)) {
    notifyLeaveDecision(request, leave, input.action, admin);
  }
  return ok<LeaveResponse>({ leave });
});
