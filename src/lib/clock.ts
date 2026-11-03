"use client";

import { useSyncExternalStore } from "react";
import { dayKey } from "./time";

/**
 * Current time for Client Components without baking the build time into prerendered HTML.
 * The server snapshot is null, so callers render a placeholder until the browser takes over.
 */
function subscribeEvery(ms: number) {
  return (onChange: () => void) => {
    const timer = setInterval(onChange, ms);
    return () => clearInterval(timer);
  };
}

const subscribeMinute = subscribeEvery(60_000);
const subscribeHalfMinute = subscribeEvery(30_000);

/** Today's IST day key, or null during prerender. Re-checks every minute so midnight rolls over. */
export function useToday(): string | null {
  return useSyncExternalStore(subscribeMinute, () => dayKey(), () => null);
}

/** Epoch ms rounded to 30s (a stable snapshot between ticks), or null during prerender. */
export function useNow(): number | null {
  return useSyncExternalStore(subscribeHalfMinute, () => Math.floor(Date.now() / 30_000) * 30_000, () => null);
}
