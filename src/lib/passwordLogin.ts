import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { env } from "./env";
import { HttpError } from "./http";
import { User, type UserDoc } from "./models";

const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();

/**
 * Password sign-in exists for exactly one account: DEFAULT_ADMIN_EMAIL. Its password lives only in the
 * environment, so rotating it is an env change plus a redeploy. Everyone else signs in with an email code.
 */
export async function verifyDefaultAdmin(email: string, password: string): Promise<UserDoc> {
  const admin = env.defaultAdmin();
  const wrong = new HttpError(401, "Wrong email or password.");
  // Hashing both sides first gives equal-length buffers, so the comparison takes the same time either way.
  const passwordOk = admin !== null && timingSafeEqual(digest(password), digest(admin.password));
  if (!admin || email !== admin.email || !passwordOk) throw wrong;

  const user = await User.findOneAndUpdate(
    { email },
    {
      $set: { role: "admin", isActive: true, lastLoginAt: new Date() },
      $setOnInsert: { name: "Admin" },
    },
    { upsert: true, returnDocument: "after", lean: true },
  );
  if (!user) throw wrong;
  return user as UserDoc;
}
