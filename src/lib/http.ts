import "server-only";
import { unstable_rethrow } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";

/** Every error response has the same shape: { error: string, details?: unknown }. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
    public headers?: Record<string, string>,
  ) {
    super(message);
  }
}

type Handler<C> = (request: NextRequest, context: C) => Promise<Response>;

/**
 * Wraps a route handler: blocks cross-site writes, maps HttpError and ZodError to their status codes,
 * and logs anything unexpected before answering 500 without leaking internals.
 */
export function route<C>(handler: Handler<C>): Handler<C> {
  return async (request, context) => {
    try {
      assertSameOrigin(request);
      return await handler(request, context);
    } catch (error) {
      // Next signals prerender bailouts and redirects by throwing; those must reach the framework.
      unstable_rethrow(error);
      if (error instanceof HttpError) {
        return NextResponse.json(
          { error: error.message, ...(error.details === undefined ? {} : { details: error.details }) },
          { status: error.status, headers: error.headers },
        );
      }
      if (error instanceof ZodError) {
        return NextResponse.json(
          { error: error.issues[0]?.message ?? "Invalid input", details: error.issues },
          { status: 422 },
        );
      }
      console.error(`[api] ${request.method} ${request.nextUrl.pathname} failed`, error);
      return NextResponse.json({ error: "Something went wrong on our side. Try again." }, { status: 500 });
    }
  };
}

/** The session cookie is SameSite=Lax; this closes the remaining gap for state-changing requests. */
function assertSameOrigin(request: NextRequest) {
  if (request.method === "GET" || request.method === "HEAD") return;
  const origin = request.headers.get("origin");
  if (!origin) return; // Same-origin fetches from older browsers and server-side tools omit it.
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new HttpError(403, "Cross-site request blocked");
  }
  if (originHost !== host) throw new HttpError(403, "Cross-site request blocked");
}

export async function readJson<T>(request: NextRequest, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, "Request body must be JSON");
  }
  return schema.parse(body);
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}
