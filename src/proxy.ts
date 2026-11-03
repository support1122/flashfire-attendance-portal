import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

/**
 * Optimistic redirect only: send signed-out visitors to /login and signed-in ones away from it.
 * Real authorization happens in every route handler against the database.
 */
export async function proxy(request: NextRequest) {
  const signedIn = (await verifySession(request.cookies.get(SESSION_COOKIE)?.value)) !== null;
  const onLogin = request.nextUrl.pathname === "/login";

  if (!signedIn && !onLogin) {
    const url = new URL("/login", request.url);
    if (request.nextUrl.pathname !== "/") url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  if (signedIn && onLogin) return NextResponse.redirect(new URL("/", request.url));
  return NextResponse.next();
}

export const config = {
  // Pages only. API routes answer 401 themselves; static files need no session.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|jpg|webp|ico)$).*)"],
};
