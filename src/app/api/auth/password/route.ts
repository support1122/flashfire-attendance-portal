import { NextResponse } from "next/server";
import { z } from "zod";
import { toPublicUser } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { readJson, route } from "@/lib/http";
import { emailSchema } from "@/lib/login";
import { verifyDefaultAdmin } from "@/lib/passwordLogin";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/session";

const body = z.object({
  email: emailSchema,
  password: z.string({ error: "Enter the password" }).min(1, { error: "Enter the password" }).max(200),
});

export const POST = route(async (request) => {
  const { email, password } = await readJson(request, body);
  await connectDb();
  // Tight limits: this is the only password on the site and it unlocks full admin access.
  await rateLimit(`pw-ip:${clientIp(request.headers)}`, 10, 15 * 60);
  await rateLimit(`pw-email:${email}`, 10, 60 * 60);
  const user = await verifyDefaultAdmin(email, password);
  const token = await signSession({ sub: String(user._id), ver: user.tokenVersion });
  const response = NextResponse.json({ user: toPublicUser(user) });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return response;
});
