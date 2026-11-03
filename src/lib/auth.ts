import "server-only";
import type { NextRequest } from "next/server";
import { connectDb } from "./db";
import { HttpError } from "./http";
import { User, type UserDoc } from "./models";
import { SESSION_COOKIE, verifySession } from "./session";
import type { PublicUser } from "./types";


export function toPublicUser(user: UserDoc): PublicUser {
  return {
    id: String(user._id),
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
  };
}

/** The authoritative check: a valid token AND an active user whose tokenVersion still matches. */
export async function requireUser(request: NextRequest): Promise<UserDoc> {
  const claims = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!claims) throw new HttpError(401, "Sign in to continue");
  await connectDb();
  const user = await User.findById(claims.sub).lean<UserDoc>();
  if (!user || !user.isActive || user.tokenVersion !== claims.ver) {
    throw new HttpError(401, "Your session has ended. Sign in again.");
  }
  return user;
}

export async function requireAdmin(request: NextRequest): Promise<UserDoc> {
  const user = await requireUser(request);
  if (user.role !== "admin") throw new HttpError(403, "Only admins can do this");
  return user;
}
