import { NextResponse } from "next/server";
import { z } from "zod";
import { toPublicUser } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { readJson, route } from "@/lib/http";
import { codeSchema, emailSchema, verifyLoginCode } from "@/lib/login";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/session";

const body = z.object({ email: emailSchema, code: codeSchema });

export const POST = route(async (request) => {
  const { email, code } = await readJson(request, body);
  await connectDb();
  await rateLimit(`verify-ip:${clientIp(request.headers)}`, 40, 15 * 60);
  const user = await verifyLoginCode(email, code);
  const token = await signSession({ sub: String(user._id), ver: user.tokenVersion });
  const response = NextResponse.json({ user: toPublicUser(user) });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return response;
});
