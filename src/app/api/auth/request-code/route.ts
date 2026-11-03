import { z } from "zod";
import { connectDb } from "@/lib/db";
import { ok, readJson, route } from "@/lib/http";
import { CODE_TTL_MINUTES, emailSchema, requestLoginCode } from "@/lib/login";
import { clientIp, rateLimit } from "@/lib/rateLimit";

const body = z.object({ email: emailSchema });

export const POST = route(async (request) => {
  const { email } = await readJson(request, body);
  await connectDb();
  await rateLimit(`code-ip:${clientIp(request.headers)}`, 30, 60 * 60);
  await rateLimit(`code-email:${email}`, 6, 60 * 60);
  await requestLoginCode(email);
  return ok({ sent: true, expiresInMinutes: CODE_TTL_MINUTES });
});
