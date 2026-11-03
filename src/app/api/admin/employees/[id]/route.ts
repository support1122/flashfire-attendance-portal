import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { toEmployeeView } from "@/lib/employees";
import { env } from "@/lib/env";
import { HttpError, ok, readJson, route } from "@/lib/http";
import { ROLES, User, type UserDoc } from "@/lib/models";

const body = z
  .object({
    name: z.string().trim().min(1, { error: "Name can't be empty" }).max(80).optional(),
    role: z.enum(ROLES).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => v.name !== undefined || v.role !== undefined || v.isActive !== undefined, {
    error: "Nothing to change",
  });

export const PATCH = route(async (request, ctx: RouteContext<"/api/admin/employees/[id]">) => {
  const admin = await requireAdmin(request);
  const { id } = await ctx.params;
  if (!isValidObjectId(id)) throw new HttpError(404, "Employee not found");
  const input = await readJson(request, body);

  const target = await User.findById(id).lean<UserDoc>();
  if (!target) throw new HttpError(404, "Employee not found");

  const losesAdmin = target.role === "admin" && (input.role === "employee" || input.isActive === false);
  if (losesAdmin) {
    if (String(target._id) === String(admin._id)) {
      throw new HttpError(403, "You can't remove your own admin access or turn yourself off. Ask another admin.");
    }
    if (env.lockedAdminEmails().includes(target.email)) {
      throw new HttpError(403, "This person is a built-in admin (ADMIN_EMAILS or DEFAULT_ADMIN_EMAIL). Change it there.");
    }
    const otherAdmins = await User.countDocuments({ role: "admin", isActive: true, _id: { $ne: target._id } });
    if (otherAdmins === 0) throw new HttpError(409, "There must be at least one active admin.");
  }

  const update: Record<string, unknown> = {};
  if (input.name !== undefined) update.name = input.name;
  if (input.role !== undefined) update.role = input.role;
  if (input.isActive !== undefined) update.isActive = input.isActive;
  // Turning someone off signs them out of every device right away.
  const inc = input.isActive === false && target.isActive ? { tokenVersion: 1 } : undefined;

  const updated = await User.findByIdAndUpdate(id, { $set: update, ...(inc ? { $inc: inc } : {}) }, {
    returnDocument: "after",
    lean: true,
  });
  if (!updated) throw new HttpError(404, "Employee not found");
  return ok({ employee: toEmployeeView(updated as UserDoc) });
});
