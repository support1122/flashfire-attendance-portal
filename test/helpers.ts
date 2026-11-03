import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, vi } from "vitest";

/** Captures login codes and notification emails instead of sending them. */
export const sentCodes = new Map<string, string>();
export const sentMails: { to: string; subject: string; text: string; html: string }[] = [];
vi.mock("@/lib/email", () => ({
  sendLoginCode: async (to: string, code: string) => {
    sentCodes.set(to, code);
  },
  sendMail: async (mail: { to: string; subject: string; text: string; html: string }) => {
    sentMails.push(mail);
  },
}));

/** next/server `after` needs a live request scope; in tests, run the job and keep its promise. */
const pendingAfter: Promise<unknown>[] = [];
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: (job: () => unknown) => {
      pendingAfter.push(Promise.resolve().then(job));
    },
  };
});

/** Waits for every scheduled after() job, then returns the emails sent since the last call. */
export async function flushMails() {
  while (pendingAfter.length) await Promise.all(pendingAfter.splice(0));
  return sentMails.splice(0);
}

let server: MongoMemoryServer;

export function setupDatabase() {
  beforeAll(async () => {
    server = await MongoMemoryServer.create();
    process.env.MONGODB_URI = server.getUri();
    const { connectDb } = await import("@/lib/db");
    await connectDb();
    await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
  });
  beforeEach(async () => {
    await flushMails();
    sentCodes.clear();
    await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
  });
  afterAll(async () => {
    await mongoose.disconnect();
    await server?.stop();
  });
}

type Handler = (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

let ipCounter = 0;

export async function call(
  handler: unknown,
  opts: { method?: string; path?: string; body?: unknown; cookie?: string; params?: Record<string, string> } = {},
) {
  const headers = new Headers({ "content-type": "application/json", "x-forwarded-for": `10.0.0.${++ipCounter % 250}` });
  if (opts.cookie) headers.set("cookie", opts.cookie);
  const req = new NextRequest(`http://localhost${opts.path ?? "/api/test"}`, {
    method: opts.method ?? (opts.body === undefined ? "GET" : "POST"),
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const res = await (handler as Handler)(req, { params: Promise.resolve(opts.params ?? {}) });
  const json = await res.json();
  return { status: res.status, json, res };
}

/** Full login through the real routes. Returns the cookie header to send on later calls. */
export async function login(email: string): Promise<string> {
  const request = await import("@/app/api/auth/request-code/route");
  const verify = await import("@/app/api/auth/verify-code/route");
  const sent = await call(request.POST, { body: { email } });
  if (sent.status !== 200) throw new Error(`request-code ${sent.status}: ${JSON.stringify(sent.json)}`);
  const code = sentCodes.get(email.toLowerCase());
  const verified = await call(verify.POST, { body: { email, code } });
  if (verified.status !== 200) throw new Error(`verify-code ${verified.status}: ${JSON.stringify(verified.json)}`);
  const setCookie = verified.res.headers.get("set-cookie") ?? "";
  return setCookie.split(";")[0];
}
