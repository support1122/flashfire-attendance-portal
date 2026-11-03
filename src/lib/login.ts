import "server-only";
import { createHmac, randomInt } from "node:crypto";
import { z } from "zod";
import { isCrmAdmin } from "./crmAdmins";
import { sendLoginCode } from "./email";
import { env } from "./env";
import { HttpError } from "./http";
import { Otp, User, type UserDoc } from "./models";
import { getSettings } from "./settings";

export const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 45;

export const emailSchema = z
  .string({ error: "Enter your work email" })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Enter a valid email address" }).max(254));

export const codeSchema = z.string().trim().regex(/^\d{6}$/, { error: "The code is 6 digits" });

function domainOf(email: string): string {
  return email.slice(email.lastIndexOf("@") + 1);
}

function hashCode(email: string, code: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return createHmac("sha256", secret).update(`${email}:${code}`).digest("hex");
}

type Access =
  | { kind: "existing"; user: UserDoc }
  | { kind: "new"; role: "employee" | "admin" }
  | { kind: "denied"; reason: string };

/**
 * Who may sign in:
 * - an existing, active user (added by an admin, or created on an earlier login)
 * - anyone listed in ADMIN_EMAILS (or DEFAULT_ADMIN_EMAIL), who always gets admin
 * - an active CRM admin, who joins as an admin (see crmAdmins.ts)
 * - anyone whose email domain is in the allowed domains list, who joins as an employee on first login
 */
async function resolveAccess(email: string): Promise<Access> {
  const user = await User.findOne({ email }).lean<UserDoc>();
  if (user) {
    return user.isActive
      ? { kind: "existing", user }
      : { kind: "denied", reason: "This account is turned off. Ask an admin to turn it back on." };
  }
  if (env.lockedAdminEmails().includes(email) || (await isCrmAdmin(email))) return { kind: "new", role: "admin" };
  const { allowedDomains } = await getSettings();
  if (allowedDomains.includes(domainOf(email))) return { kind: "new", role: "employee" };
  return { kind: "denied", reason: "This email can't sign in here. Use your company email or ask an admin to add you." };
}

export async function requestLoginCode(email: string): Promise<void> {
  const access = await resolveAccess(email);
  if (access.kind === "denied") throw new HttpError(403, access.reason);

  const existing = await Otp.findOne({ email }).lean();
  if (existing && existing.expiresAt > new Date()) {
    const waitSeconds = Math.ceil((existing.lastSentAt.getTime() + RESEND_COOLDOWN_SECONDS * 1000 - Date.now()) / 1000);
    if (waitSeconds > 0) {
      throw new HttpError(429, `Wait ${waitSeconds}s before asking for another code.`, { retryAfter: waitSeconds }, {
        "Retry-After": String(waitSeconds),
      });
    }
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const now = new Date();
  await Otp.findOneAndUpdate(
    { email },
    {
      codeHash: hashCode(email, code),
      attemptsLeft: MAX_ATTEMPTS,
      lastSentAt: now,
      expiresAt: new Date(now.getTime() + CODE_TTL_MINUTES * 60 * 1000),
    },
    { upsert: true },
  );

  try {
    await sendLoginCode(email, code, CODE_TTL_MINUTES);
  } catch (error) {
    // A code nobody received must not block the resend cooldown.
    await Otp.deleteOne({ email });
    console.error("[login] sending code failed", error);
    throw new HttpError(503, "We couldn't send the email right now. Try again in a minute.");
  }
}

export async function verifyLoginCode(email: string, code: string): Promise<UserDoc> {
  const invalid = new HttpError(401, "That code is wrong or has expired. Check it or ask for a new one.");
  const now = new Date();

  // Delete-on-match is atomic, so one code can never sign in twice, even under concurrent requests.
  const matched = await Otp.findOneAndDelete({
    email,
    codeHash: hashCode(email, code),
    expiresAt: { $gt: now },
    attemptsLeft: { $gt: 0 },
  }).lean();

  if (!matched) {
    const after = await Otp.findOneAndUpdate(
      { email, expiresAt: { $gt: now } },
      { $inc: { attemptsLeft: -1 } },
      { returnDocument: "after", lean: true },
    );
    if (after && after.attemptsLeft <= 0) {
      await Otp.deleteOne({ email });
      throw new HttpError(401, "Too many wrong codes. Ask for a new one.");
    }
    throw invalid;
  }
  const access = await resolveAccess(email);
  if (access.kind === "denied") throw new HttpError(403, access.reason);

  const isEnvAdmin = env.lockedAdminEmails().includes(email);
  if (access.kind === "existing") {
    const promote = isEnvAdmin || (access.user.role !== "admin" && (await isCrmAdmin(email)));
    const updated = await User.findByIdAndUpdate(
      access.user._id,
      { lastLoginAt: now, ...(promote ? { role: "admin" } : {}) },
      { returnDocument: "after", lean: true },
    );
    if (!updated) throw invalid;
    return updated as UserDoc;
  }

  try {
    const created = await User.create({ email, name: nameFromEmail(email), role: access.role, lastLoginAt: now });
    return created.toObject() as UserDoc;
  } catch (error) {
    // Same person verified twice at once: the first insert won, so use that row.
    if ((error as { code?: number }).code !== 11000) throw error;
    const user = await User.findOne({ email }).lean<UserDoc>();
    if (!user) throw error;
    return user;
  }
}

/** "priya.sharma@x.com" becomes "Priya Sharma". Admins can rename people later. */
export function nameFromEmail(email: string): string {
  const local = email.slice(0, email.indexOf("@"));
  const words = local.split(/[._-]+/).filter(Boolean);
  const name = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  return name || local;
}
