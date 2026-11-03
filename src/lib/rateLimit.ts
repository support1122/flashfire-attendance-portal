import "server-only";
import { HttpError } from "./http";
import { RateLimit } from "./models";

/**
 * Fixed-window counter stored in MongoDB, so the limit holds across serverless instances.
 * Throws 429 with Retry-After once `limit` hits inside `windowSeconds`.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<void> {
  const now = new Date();
  // Start a fresh window when the old one has expired but the TTL monitor has not deleted it yet.
  await RateLimit.deleteOne({ key, expiresAt: { $lte: now } });
  let doc;
  try {
    doc = await RateLimit.findOneAndUpdate(
      { key },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(now.getTime() + windowSeconds * 1000) } },
      { upsert: true, returnDocument: "after", lean: true },
    );
  } catch (error) {
    // Two first requests raced on the upsert; the loser retries once as a plain increment.
    if ((error as { code?: number }).code !== 11000) throw error;
    doc = await RateLimit.findOneAndUpdate({ key }, { $inc: { count: 1 } }, { returnDocument: "after", lean: true });
  }
  if (doc && doc.count > limit) {
    const retryAfter = Math.max(1, Math.ceil((doc.expiresAt.getTime() - now.getTime()) / 1000));
    throw new HttpError(429, "Too many attempts. Wait a bit and try again.", { retryAfter }, {
      "Retry-After": String(retryAfter),
    });
  }
}

export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}
