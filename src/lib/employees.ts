import "server-only";
import { toPublicUser } from "./auth";
import { env } from "./env";
import type { UserDoc } from "./models";
import type { EmployeeView } from "./types";

export function toEmployeeView(user: UserDoc): EmployeeView {
  const withDates = user as UserDoc & { createdAt: Date };
  return {
    ...toPublicUser(user),
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    createdAt: withDates.createdAt.toISOString(),
    lockedAdmin: env.lockedAdminEmails().includes(user.email),
  };
}
