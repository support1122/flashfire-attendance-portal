import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { ok, readJson, route } from "@/lib/http";
import { Settings } from "@/lib/models";
import { getSettings } from "@/lib/settings";
import { isDayKey } from "@/lib/time";
import type { SettingsResponse } from "@/lib/types";

const domain = z
  .string()
  .trim()
  .toLowerCase()
  .transform((d) => d.replace(/^@/, ""))
  .pipe(z.string().regex(/^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/, { error: "Enter a domain like flashfirehq.com" }));

const body = z.object({
  allowedDomains: z.array(domain).max(50).transform((list) => [...new Set(list)]),
  weeklyOffDays: z
    .array(z.number().int().min(0).max(6))
    .max(6, { error: "At least one day of the week has to be a working day" })
    .transform((list) => [...new Set(list)].sort()),
  holidays: z
    .array(
      z.object({
        date: z.string().refine(isDayKey, { error: "Holiday date is not valid" }),
        name: z.string().trim().min(1, { error: "Give the holiday a name" }).max(80),
      }),
    )
    .max(200)
    .refine((list) => new Set(list.map((h) => h.date)).size === list.length, {
      error: "Two holidays share the same date",
    })
    .transform((list) => [...list].sort((a, b) => a.date.localeCompare(b.date))),
});

export const GET = route(async (request) => {
  await requireAdmin(request);
  return ok<SettingsResponse>({ settings: await getSettings() });
});

export const PUT = route(async (request) => {
  await requireAdmin(request);
  const input = await readJson(request, body);
  await getSettings(); // make sure the document exists
  await Settings.updateOne({ key: "global" }, { $set: input });
  return ok<SettingsResponse>({ settings: await getSettings() });
});
