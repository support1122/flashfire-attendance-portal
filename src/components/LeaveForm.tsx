"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { LEAVE_TYPE_LABEL } from "./labels";
import { Alert, Button, Field, inputClass } from "./ui";
import { api, errorMessage } from "@/lib/api";
import { keys } from "@/lib/queries";
import { useToday } from "@/lib/clock";
import type { LeaveResponse, LeaveType } from "@/lib/types";

export function LeaveForm() {
  const queryClient = useQueryClient();
  const [type, setType] = useState<LeaveType>("casual");
  const today = useToday();
  // Empty means "today" until the person picks a date; avoids a build-time default in the HTML.
  const [fromPicked, setFromDate] = useState("");
  const [toPicked, setToDate] = useState("");
  const fromDate = fromPicked || today || "";
  const toDate = toPicked || fromDate;
  const [halfDay, setHalfDay] = useState(false);
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState<LeaveResponse["leave"] | null>(null);

  const submit = useMutation({
    mutationFn: () => api<LeaveResponse>("/api/leaves", { body: { type, fromDate, toDate, halfDay, reason } }),
    onSuccess: (data) => {
      setSent(data.leave);
      setReason("");
      setHalfDay(false);
      queryClient.invalidateQueries({ queryKey: keys.myLeaves });
      queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSent(null);
    submit.mutate();
  }

  const singleDay = fromDate === toDate;

  return (
    <form onSubmit={onSubmit} className="space-y-4 p-5">
      {submit.isError && <Alert>{errorMessage(submit.error)}</Alert>}
      {sent && (
        <Alert tone="green">
          Request sent for {sent.dayCount} {sent.dayCount === 1 ? "day" : "days"}. An admin will review it.
        </Alert>
      )}
      <Field label="Type" htmlFor="leave-type">
        <select id="leave-type" value={type} onChange={(e) => setType(e.target.value as LeaveType)} className={inputClass}>
          {Object.entries(LEAVE_TYPE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="From" htmlFor="leave-from">
          <input
            id="leave-from"
            type="date"
            value={fromDate}
            required
            onChange={(e) => {
              setFromDate(e.target.value);
              if (e.target.value > toDate) setToDate(e.target.value);
            }}
            className={inputClass}
          />
        </Field>
        <Field label="To" htmlFor="leave-to">
          <input id="leave-to" type="date" value={toDate} min={fromDate} required onChange={(e) => setToDate(e.target.value)} className={inputClass} />
        </Field>
      </div>
      <label className={`flex items-center gap-2 text-sm ${singleDay ? "text-slate-700" : "text-slate-400"}`}>
        <input
          type="checkbox"
          checked={singleDay && halfDay}
          disabled={!singleDay}
          onChange={(e) => setHalfDay(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 accent-orange-500"
        />
        Half day {singleDay ? "" : "(only for a single date)"}
      </label>
      <Field label="Reason" htmlFor="leave-reason" hint="Weekly offs and holidays inside the range are not counted.">
        <textarea
          id="leave-reason"
          rows={3}
          value={reason}
          required
          minLength={3}
          maxLength={1000}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Doctor's appointment, family function, travel..."
          className={inputClass}
        />
      </Field>
      <Button type="submit" loading={submit.isPending} className="w-full">
        Send request
      </Button>
    </form>
  );
}
