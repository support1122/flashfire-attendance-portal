import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { HttpError, ok, readJson, route } from "@/lib/http";
import { emailSchema, nameFromEmail } from "@/lib/login";
import { ROLES, User, type UserDoc } from "@/lib/models";
import type { EmployeesResponse } from "@/lib/types";
import { toEmployeeView } from "@/lib/employees";

export const GET = route(async (request) => {
  await requireAdmin(request);
  const users = await User.find().sort({ isActive: -1, name: 1 }).lean<UserDoc[]>();
  return ok<EmployeesResponse>({ employees: users.map(toEmployeeView) });
});

const body = z.object({
  email: emailSchema,
  name: z.string().trim().max(80, { error: "Keep the name under 80 characters" }).optional(),
  role: z.enum(ROLES).default("employee"),
});

/** Adds someone by email, from any domain. They sign in with a code like everyone else. */
export const POST = route(async (request) => {
  await requireAdmin(request);
  const input = await readJson(request, body);
  try {
    const user = await User.create({ email: input.email, name: input.name || nameFromEmail(input.email), role: input.role });
    return ok({ employee: toEmployeeView(user.toObject() as UserDoc) }, 201);
  } catch (error) {
    if ((error as { code?: number }).code === 11000) throw new HttpError(409, `${input.email} is already in the list`);
    throw error;
  }
});
