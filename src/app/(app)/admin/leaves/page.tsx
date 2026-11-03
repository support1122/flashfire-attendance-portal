"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AdminOnly } from "@/components/AppShell";
import { dayCountLabel, LEAVE_STATUS, LEAVE_TYPE_LABEL, leaveRange, PAY_LABEL } from "@/components/labels";
import { LeaveActions } from "@/components/LeaveActions";
import { MonthNav } from "@/components/MonthNav";
import { Alert, Badge, Card, Empty, PageHeader, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { keys } from "@/lib/queries";
import { useToday } from "@/lib/clock";
import type { LeaveListResponse, LeaveStatus } from "@/lib/types";

const TABS: { value: LeaveStatus | "all"; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Withdrawn" },
  { value: "all", label: "All" },
];

function Requests() {
  const [status, setStatus] = useState<LeaveStatus | "all">("pending");
  const today = useToday();
  const [month, setMonth] = useState<string | null>(null);
  const query = new URLSearchParams({ status, ...(month ? { month } : {}) });
  const leaves = useQuery({
    queryKey: keys.adminLeaves(status, month ?? ""),
    queryFn: () => api<LeaveListResponse>(`/api/admin/leaves?${query}`),
  });

  return (
    <>
      <PageHeader title="Leave requests" subtitle="Approve or reject, and decide whether each leave is paid." />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Filter by status" className="flex flex-wrap gap-1 rounded-lg bg-slate-200/70 p-1">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={status === tab.value}
              onClick={() => setStatus(tab.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${status === tab.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {month ? (
            <>
              <MonthNav month={month} onChange={setMonth} />
              <button type="button" onClick={() => setMonth(null)} className="rounded-lg px-2.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200/60">
                Any month
              </button>
            </>
          ) : (
            <button type="button" disabled={!today} onClick={() => today && setMonth(today.slice(0, 7))} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Filter by month
            </button>
          )}
        </div>
      </div>

      <Card>
        {leaves.isPending ? (
          <Spinner />
        ) : leaves.isError ? (
          <div className="p-5"><Alert>{errorMessage(leaves.error)}</Alert></div>
        ) : leaves.data.leaves.length === 0 ? (
          <Empty>No {status === "all" ? "" : `${LEAVE_STATUS[status].label.toLowerCase()} `}requests{month ? " in this month" : ""}.</Empty>
        ) : (
          <ul className="divide-y divide-slate-200">
            {leaves.data.leaves.map((leave) => (
              <li key={leave.id} className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-900">{leave.user.name}</p>
                    <Badge tone={LEAVE_STATUS[leave.status].tone}>{LEAVE_STATUS[leave.status].label}</Badge>
                    {leave.payType && <Badge tone={PAY_LABEL[leave.payType].tone}>{PAY_LABEL[leave.payType].label}</Badge>}
                  </div>
                  <p className="mt-0.5 text-sm text-slate-600">
                    {leaveRange(leave.fromDate, leave.toDate, leave.halfDay)} · {LEAVE_TYPE_LABEL[leave.type]} · {dayCountLabel(leave.dayCount)}
                  </p>
                  <p className="mt-1 break-words text-sm text-slate-700">{leave.reason}</p>
                  {leave.decidedBy && (
                    <p className="mt-1 text-xs text-slate-500">
                      Decided by {leave.decidedBy.name}
                      {leave.decidedAt ? ` on ${new Date(leave.decidedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}
                      {leave.decisionNote ? `: “${leave.decisionNote}”` : ""}
                    </p>
                  )}
                </div>
                <LeaveActions leave={leave} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

export default function AdminLeavesPage() {
  return <AdminOnly><Requests /></AdminOnly>;
}
