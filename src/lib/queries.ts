"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { MeResponse } from "./types";

/** Query keys in one place so mutations invalidate exactly what they change. */
export const keys = {
  me: ["me"] as const,
  today: ["attendance", "today"] as const,
  myMonth: (month: string) => ["attendance", "month", month] as const,
  myLeaves: ["leaves", "mine"] as const,
  adminLeaves: (status: string, month: string) => ["admin", "leaves", status, month] as const,
  adminLeavesAll: ["admin", "leaves"] as const,
  overview: ["admin", "overview"] as const,
  team: (month: string) => ["admin", "attendance", month] as const,
  teamAll: ["admin", "attendance"] as const,
  employees: ["admin", "employees"] as const,
  settings: ["admin", "settings"] as const,
};

export function useMe() {
  return useQuery({ queryKey: keys.me, queryFn: () => api<MeResponse>("/api/me"), staleTime: 5 * 60_000 });
}
