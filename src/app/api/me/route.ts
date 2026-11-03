import { requireUser, toPublicUser } from "@/lib/auth";
import { ok, route } from "@/lib/http";
import type { MeResponse } from "@/lib/types";

export const GET = route(async (request) => {
  const user = await requireUser(request);
  return ok<MeResponse>({ user: toPublicUser(user) });
});
