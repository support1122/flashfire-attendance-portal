"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, LogIn, LogOut } from "lucide-react";
import { Alert, Button, Card, Spinner } from "./ui";
import { api, errorMessage } from "@/lib/api";
import { useNow } from "@/lib/clock";
import { keys } from "@/lib/queries";
import { formatDay, formatDuration, formatTimeIST } from "@/lib/time";
import type { TodayResponse } from "@/lib/types";

export function TodayCard() {
  const queryClient = useQueryClient();
  const today = useQuery({ queryKey: keys.today, queryFn: () => api<TodayResponse>("/api/attendance/today") });

  const onDone = () => {
    queryClient.invalidateQueries({ queryKey: ["attendance"] });
    queryClient.invalidateQueries({ queryKey: ["admin"] });
  };
  const checkIn = useMutation({ mutationFn: () => api("/api/attendance/check-in", { body: {} }), onSuccess: onDone });
  const checkOut = useMutation({ mutationFn: () => api("/api/attendance/check-out", { body: {} }), onSuccess: onDone });

  const now = useNow();

  if (today.isPending) return <Card><Spinner /></Card>;
  if (today.isError) return <Alert>{errorMessage(today.error)}</Alert>;

  const { offReason, leaveToday } = today.data;
  const r = today.data.today;
  const working = Boolean(r.checkInAt && !r.checkOutAt);
  const end = r.checkOutAt ? Date.parse(r.checkOutAt) : (now ?? Date.parse(r.checkInAt ?? ""));
  const worked = r.checkInAt ? end - Date.parse(r.checkInAt) : 0;
  const error = checkIn.error ?? checkOut.error;

  return (
    <Card>
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{formatDay(r.date)}</p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {!r.checkInAt ? "You haven’t checked in yet" : working ? "You’re checked in" : "Done for the day"}
          </p>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
            <span>In: <strong className="text-slate-900">{formatTimeIST(r.checkInAt)}</strong></span>
            <span>Out: <strong className="text-slate-900">{formatTimeIST(r.checkOutAt)}</strong></span>
            {r.checkInAt && (
              <span className="inline-flex items-center gap-1">
                <Clock size={14} aria-hidden /> {formatDuration(worked)}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          {!r.checkInAt && (
            <Button onClick={() => checkIn.mutate()} loading={checkIn.isPending} className="px-6">
              <LogIn size={16} aria-hidden /> Check in
            </Button>
          )}
          {working && (
            <Button variant="secondary" onClick={() => checkOut.mutate()} loading={checkOut.isPending} className="px-6">
              <LogOut size={16} aria-hidden /> Check out
            </Button>
          )}
        </div>
      </div>
      {(offReason || leaveToday || error) && (
        <div className="space-y-2 border-t border-slate-200 px-5 py-3">
          {error && <Alert>{errorMessage(error)}</Alert>}
          {leaveToday && (
            <Alert tone="green">
              You’re on approved {leaveToday.halfDay ? "half-day " : ""}leave today
              {leaveToday.payType ? ` (${leaveToday.payType})` : ""}.
            </Alert>
          )}
          {offReason && !leaveToday && <Alert tone="orange">{offReason}. You can still check in if you’re working.</Alert>}
        </div>
      )}
    </Card>
  );
}
