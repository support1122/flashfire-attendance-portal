import { requireUser } from "@/lib/auth";
import { HttpError, ok, route } from "@/lib/http";
import { getSettings } from "@/lib/settings";
import { dayKey, isMonthKey, monthKey } from "@/lib/time";
import type { MyMonthResponse } from "@/lib/types";
import { loadMonth } from "@/lib/views";

export const GET = route(async (request) => {
  const user = await requireUser(request);
  const month = request.nextUrl.searchParams.get("month") ?? monthKey();
  if (!isMonthKey(month)) throw new HttpError(400, "month must look like 2026-11");
  const settings = await getSettings();
  const [person] = await loadMonth([user], month, settings);
  return ok<MyMonthResponse>({ month, today: dayKey(), person });
});
