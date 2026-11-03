import { NextResponse } from "next/server";
import { route } from "@/lib/http";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

export const POST = route(async () => {
  const response = NextResponse.json({ signedOut: true });
  response.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0));
  return response;
});
