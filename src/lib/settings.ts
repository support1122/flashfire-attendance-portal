import "server-only";
import { env } from "./env";
import { Settings } from "./models";
import type { AppSettings } from "./types";

async function loadOrCreate() {
  return Settings.findOneAndUpdate(
    { key: "global" },
    { $setOnInsert: { allowedDomains: env.defaultAllowedDomains(), weeklyOffDays: [0], holidays: [] } },
    { upsert: true, returnDocument: "after", lean: true },
  );
}

/** Loads the single settings document, creating it from env defaults on first use. */
export async function getSettings(): Promise<AppSettings> {
  let doc: Awaited<ReturnType<typeof loadOrCreate>>;
  try {
    doc = await loadOrCreate();
  } catch (error) {
    // Two cold requests raced to create it; the document exists now, so read it again.
    if ((error as { code?: number }).code !== 11000) throw error;
    doc = await loadOrCreate();
  }
  return {
    allowedDomains: doc.allowedDomains ?? [],
    weeklyOffDays: doc.weeklyOffDays ?? [0],
    holidays: (doc.holidays ?? []).map((h: { date: string; name: string }) => ({ date: h.date, name: h.name })),
  };
}
